import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactECharts from 'echarts-for-react'
import Papa from 'papaparse'
import { computeKpis } from './analytics'
import { askCopilot, getModelProfile, getReasoningMode, initReasoningEngine, isReasoningReady, setModelProfile, type ModelProfile } from './copilot'
import { loadTestsToDuckDB, queryDashboardStats } from './duckdb'
import { initEmbeddingModel, embedText } from './embeddings'
import { generateSyntheticTests } from './synthetic'
import type { TestCaseRow } from './types'
import { clusterByThreshold } from './vector'
import { SqliteVecStore } from './sqliteVecStore'
import { buildClusterMeta } from './clusterMeta'

const store = new SqliteVecStore()

const KPI_HELP: Record<string, string> = {
  'Total Tests': `Concept: Number of test cases currently loaded in this workspace.\n\nTechnical: Simple row count from the canonical test-case table.\n\nDeterministic vs Non-deterministic: Deterministic (program logic only).\n\nBusiness value: Helps stakeholders confirm scope and confidence level of the analysis before interpreting advanced KPIs.`,
  'Exact Duplicate Groups': `Concept: Tests that are literal copies of each other.\n\nTechnical: Title + description + steps normalize to identical text key and are grouped.\n\nDeterministic vs Non-deterministic: Deterministic (program logic only).\n\nBusiness value: Indicates immediate cleanup opportunities that reduce suite cost without coverage loss.`,
  'Near Duplicate Groups': `Concept: Tests that are different text, but same intent.\n\nTechnical: Semantic clustering and near-neighbor logic over embeddings identifies high-overlap families.\n\nDeterministic vs Non-deterministic: Non-deterministic (LLM/embedding-assisted semantic meaning).\n\nBusiness value: Reveals hidden waste that normal text matching misses, improving regression efficiency.`,
  'Redundancy Score': `Concept: Overall repetition pressure in the suite.\n\nTechnical: Combined signal from exact + near-duplicate membership against total population.\n\nDeterministic vs Non-deterministic: Hybrid (deterministic exact duplicates + non-deterministic semantic duplicates).\n\nBusiness value: Higher redundancy means longer execution cycles, slower releases, and higher maintenance spend.`,
  'Entropy Score': `Concept: Diversity of test intent across the portfolio.\n\nTechnical: Normalized Shannon entropy on feature-intent distribution.\n\nDeterministic vs Non-deterministic: Deterministic for score math; interpretation can be LLM-assisted.\n\nBusiness value: Low entropy suggests concentration risk (over-testing some areas, under-testing others). High entropy signals healthier risk distribution.`,
  'Orphan Tag Ratio': `Concept: Tests with missing, inconsistent, or non-standard tags.\n\nTechnical: Rule-based detection for empty tags, casing mismatches, and taxonomy drift.\n\nDeterministic vs Non-deterministic: Deterministic for detection; LLM may assist remediation suggestions.\n\nBusiness value: High orphan ratio reduces traceability, ownership clarity, and governance quality for large QA programs.`,
}

const CHART_HELP: Record<string, string> = {
  'Semantic Cluster Map': `What this does: Visual map of semantic test families.\n\nTechnical method: Each bubble represents a cluster of similar test embeddings; larger bubble = larger family.\n\nType: Non-deterministic (LLM/embedding-assisted grouping).\n\nStakeholder value: Reveals duplication hotspots and consolidation opportunities.`,
  'Suite Distribution (DuckDB)': `What this does: Distribution of tests across suites.\n\nTechnical method: DuckDB aggregation of test counts by suite ID.\n\nType: Deterministic.\n\nStakeholder value: Shows balance/imbalance across test suites for planning and ownership.`,
  'Requirement Cluster Map': `What this does: Clusters requirements by semantic/feature similarity.\n\nTechnical method: Requirements are grouped by feature signals and plotted as cluster bubbles.\n\nType: Hybrid (deterministic grouping with semantic intent approximation).\n\nStakeholder value: Highlights overlapping requirement themes and potential requirement rationalization.`,
  'Defect Cluster Map': `What this does: Clusters defects by recurring defect patterns.\n\nTechnical method: Defects are grouped by severity/status-linked themes and plotted as cluster bubbles.\n\nType: Hybrid (deterministic signals with pattern grouping).\n\nStakeholder value: Speeds root-cause prioritization and defect reduction strategy.`,
  'Unified Cluster Map': `What this does: Consolidated cluster map across requirements, tests, and defects.\n\nTechnical method: Entity points are projected into one map and color-coded by entity type with feature anchoring.\n\nType: Hybrid.\n\nStakeholder value: Gives leadership one integrated quality-intelligence view across lifecycle entities.`,
  'Requirement Coverage Heatmap': `What this does: Shows requirement-to-test coverage intensity.\n\nTechnical method: Link-table aggregation from requirement_test_links into a feature matrix.\n\nType: Deterministic.\n\nStakeholder value: Immediately surfaces under-tested requirement areas.`,
  'Defect Leakage Funnel': `What this does: Shows flow from executions to failures to defects to open defects.\n\nTechnical method: Aggregated counts from execution_status and defect status.\n\nType: Deterministic.\n\nStakeholder value: Quantifies quality containment effectiveness.`,
  'Execution Reliability by Plan': `What this does: Passed/failed/blocked quality mix by test plan.\n\nTechnical method: Grouped execution rollups by plan and status.\n\nType: Deterministic.\n\nStakeholder value: Identifies unstable plans and release risk concentrations.`,
  'Traceability Completeness': `What this does: Measures linkage completeness across requirements, tests, and defects.\n\nTechnical method: Ratio checks over relationship tables and linked identifiers.\n\nType: Deterministic.\n\nStakeholder value: Governance readiness KPI for enterprise stakeholders.`,
}

const SAMPLE_QUESTIONS = [
  'Which duplicate families should we consolidate first?',
  'What are the top 3 coverage gaps by business risk?',
  'Which suites are over-indexed with redundant tests?',
  'Show tests with weak or inconsistent tagging.',
  'Which semantic clusters look too broad and need split?',
  'What is the fastest way to reduce regression runtime by 20%?',
  'Which tests are best candidates for parameterization?',
  'What should be the next governance cleanup backlog?',
  'Explain why entropy score changed after this dataset load.',
  'If we remove top duplicate clusters, what coverage risk remains?',
]

function parseJson(text: string): TestCaseRow[] {
  const raw = JSON.parse(text)
  if (!Array.isArray(raw)) throw new Error('JSON must be an array of test cases')
  return raw.map((r, i) => ({
    test_case_id: String(r.test_case_id ?? `TC-UP-${i}`),
    test_plan_id: String(r.test_plan_id ?? 'P-NA'),
    test_suite_id: String(r.test_suite_id ?? 'S-NA'),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    steps: String(r.steps ?? ''),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  }))
}

function parseCsv(text: string): TestCaseRow[] {
  const p = Papa.parse(text, { header: true, skipEmptyLines: true })
  return (p.data as any[]).map((r, i) => ({
    test_case_id: String(r.test_case_id ?? `TC-UP-${i}`),
    test_plan_id: String(r.test_plan_id ?? 'P-NA'),
    test_suite_id: String(r.test_suite_id ?? 'S-NA'),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    steps: String(r.steps ?? ''),
    tags: String(r.tags ?? '').split('|').filter(Boolean),
  }))
}

function downloadJson(rows: any, fileName = 'generated_testcases.json') {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function buildUnifiedSchema(rows: TestCaseRow[]) {
  const now = new Date().toISOString()

  const plans = new Map<string, any>()
  const suites = new Map<string, any>()
  const requirements = new Map<string, any>()
  const requirementTestLinks: any[] = []
  const executions: any[] = []
  const defects: any[] = []

  const getFeature = (r: TestCaseRow) => {
    const fromTag = (r.tags || []).find((t) => /^[a-z]+(?:-[a-z]+)*$/i.test(t) && !['regression', 'web', 'mobile', 'api'].includes(t.toLowerCase()))
    if (fromTag) return fromTag.toLowerCase()
    const left = (r.title || '').split(':')[0]?.trim()
    return (left || 'general').toLowerCase().replace(/\s+/g, '-')
  }

  const hash = (s: string) => Array.from(s).reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0), 7)

  rows.forEach((r, i) => {
    const feature = getFeature(r)
    const reqId = `REQ-${feature.toUpperCase()}`

    if (!plans.has(r.test_plan_id)) {
      plans.set(r.test_plan_id, {
        plan_id: r.test_plan_id,
        plan_name: `Plan ${r.test_plan_id}`,
        source_system: 'synthetic',
        source_key: r.test_plan_id,
        created_at: now,
        updated_at: now,
      })
    }

    if (!suites.has(r.test_suite_id)) {
      suites.set(r.test_suite_id, {
        suite_id: r.test_suite_id,
        suite_name: `Suite ${r.test_suite_id}`,
        test_plan_id: r.test_plan_id,
        source_system: 'synthetic',
        source_key: r.test_suite_id,
        created_at: now,
        updated_at: now,
      })
    }

    if (!requirements.has(reqId)) {
      requirements.set(reqId, {
        requirement_id: reqId,
        requirement_name: `${feature.replace(/-/g, ' ')} capability`,
        requirement_description: `Business requirement for ${feature.replace(/-/g, ' ')} behavior and reliability.`,
        requirement_acceptance_criteria: [
          'Behavior is validated under happy path and negative path conditions',
          'Traceability exists between requirement and linked test cases',
        ],
        tags: [feature, 'quality-signal'],
        source_system: 'synthetic',
        source_key: reqId,
        created_at: now,
        updated_at: now,
      })
    }

    requirementTestLinks.push({
      requirement_id: reqId,
      test_id: r.test_case_id,
      link_type: 'validates',
      confidence: 0.92,
    })

    const h = hash(r.test_case_id)
    const statusBucket = h % 100
    const execution_status = statusBucket < 72 ? 'passed' : statusBucket < 92 ? 'failed' : 'blocked'

    executions.push({
      run_id: `RUN-${(i + 1).toString().padStart(6, '0')}`,
      test_id: r.test_case_id,
      test_plan_id: r.test_plan_id,
      test_suite_id: r.test_suite_id,
      environment: ['qa', 'staging', 'prod-like'][h % 3],
      executed_at: now,
      execution_status,
      duration_ms: 1200 + (h % 9000),
    })

    if (execution_status === 'failed' && h % 5 === 0) {
      defects.push({
        defect_id: `DEF-${(defects.length + 1).toString().padStart(5, '0')}`,
        title: `Failure in ${r.title}`,
        severity: ['low', 'medium', 'high', 'critical'][h % 4],
        status: ['new', 'open', 'in-progress'][h % 3],
        linked_test_id: r.test_case_id,
        linked_requirement_id: reqId,
        source_system: 'synthetic',
        source_key: `BUG-${h % 100000}`,
        created_at: now,
      })
    }
  })

  return {
    schema_version: 'qaip-canonical-v1',
    generated_at: now,
    summary: {
      requirements: requirements.size,
      test_cases: rows.length,
      test_suites: suites.size,
      test_plans: plans.size,
      executions: executions.length,
      defects: defects.length,
      requirement_test_links: requirementTestLinks.length,
    },
    requirements: Array.from(requirements.values()),
    test_cases: rows.map((r) => ({
      test_id: r.test_case_id,
      test_plan_id: r.test_plan_id,
      test_suite_id: r.test_suite_id,
      test_case_name: r.title,
      test_case_description: r.description,
      test_steps: r.steps,
      tags: r.tags || [],
      source_system: 'synthetic',
      source_key: r.test_case_id,
      created_at: now,
      updated_at: now,
    })),
    test_suites: Array.from(suites.values()),
    test_plans: Array.from(plans.values()),
    requirement_test_links: requirementTestLinks,
    executions,
    defects,
  }
}

function downloadCsv(rows: TestCaseRow[], fileName = 'cluster_testcases.csv') {
  const header = ['test_case_id', 'test_plan_id', 'test_suite_id', 'title', 'description', 'steps', 'tags']
  const body = rows.map((r) => [
    r.test_case_id,
    r.test_plan_id,
    r.test_suite_id,
    r.title,
    r.description,
    r.steps,
    (r.tags || []).join('|'),
  ])
  const csv = [header, ...body]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function textKey(r: TestCaseRow) {
  return `${r.title}|${r.description}|${r.steps}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function nearDupKey(r: TestCaseRow) {
  return `${r.title}|${r.description}`.toLowerCase().replace(/\s+/g, ' ').split(' ').slice(0, 8).join(' ')
}

function emergencyCopilotAnswer(question: string, context: TestCaseRow[]) {
  const sample = context.slice(0, 6).map((t) => `${t.test_case_id} (${t.test_suite_id})`).join(', ')
  return `Summary:\nLocal LLM could not initialize on this device, so this is a deterministic advisory response.\n\nEvidence:\nTop evidence IDs: ${sample || 'No evidence available'}\n\nRecommended Actions:\n- Retry on a browser/device with WebGPU enabled or let CPU/WASM model warm up longer\n- Keep using semantic KPIs and cluster downloads for decision-making\n- Start consolidation with top duplicate families and tag-governance cleanup\n\nQuestion handled: ${question}`
}

function rankContextByQuestion(question: string, input: TestCaseRow[]) {
  const qTokens = question.toLowerCase().split(/\W+/).filter((x) => x.length > 2)
  const scored = input.map((t) => {
    const text = `${t.title} ${t.description} ${(t.tags || []).join(' ')}`.toLowerCase()
    const score = qTokens.reduce((s, tok) => s + (text.includes(tok) ? 1 : 0), 0)
    return { t, score }
  })
  return scored.sort((a, b) => b.score - a.score).map((x) => x.t)
}

function App() {
  const [rows, setRows] = useState<TestCaseRow[]>([])
  const [status, setStatus] = useState('No dataset loaded')
  const [embStatus, setEmbStatus] = useState('Not built')
  const [llmStatus, setLlmStatus] = useState('Not initialized')
  const [clusters, setClusters] = useState<any[]>([])
  const [suiteDist, setSuiteDist] = useState<any[]>([])
  const [question, setQuestion] = useState('What duplicate families should we consolidate first?')
  const [answer, setAnswer] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [askProgress, setAskProgress] = useState(0)
  const [askStage, setAskStage] = useState('Idle')
  const askRequestIdRef = useRef(0)
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false)
  const [generateProgress, setGenerateProgress] = useState(0)
  const [isBuildingSemantic, setIsBuildingSemantic] = useState(false)
  const [buildMode, setBuildMode] = useState<'quick' | 'full'>('quick')
  const [buildProgress, setBuildProgress] = useState(0)
  const [semanticReady, setSemanticReady] = useState(false)
  const [semanticVectors, setSemanticVectors] = useState<any[]>([])
  const [popup, setPopup] = useState<{ title: string; body: string } | null>(null)
  const [modelProfile, setModelProfileState] = useState<ModelProfile>(getModelProfile())
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<number | null>(null)
  const [clusterPopupOpen, setClusterPopupOpen] = useState(false)
  const [showAllClusters, setShowAllClusters] = useState(false)
  const [clusterSearch, setClusterSearch] = useState('')
  const [clusterSortBy, setClusterSortBy] = useState<'id' | 'size' | 'family' | 'risk'>('size')
  const [clusterSortDir, setClusterSortDir] = useState<'asc' | 'desc'>('desc')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 900 : false)
  const cancelBuildRef = useRef(false)

  useEffect(() => {
    // warm-start local LLM after first paint
    const t = setTimeout(async () => {
      if (!isReasoningReady()) {
        setLlmStatus('Warm-starting local LLM in background...')
        try {
          const mode = await initReasoningEngine()
          setLlmStatus(`Copilot mode: ${mode}`)
        } catch (err: any) {
          setLlmStatus(`Copilot warm-start pending: ${String(err?.message || err)}`)
        }
      }
    }, 900)

    const onResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', onResize)

    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const kpis = useMemo(() => computeKpis(rows), [rows])
  const unified = useMemo(() => buildUnifiedSchema(rows), [rows])
  const runtimeMode = getReasoningMode()

  const kpiItems = [
    { label: 'Total Tests', value: kpis.totalTests.toLocaleString(), type: 'deterministic' as const },
    { label: 'Exact Duplicate Groups', value: kpis.exactDuplicateGroups, type: 'deterministic' as const },
    { label: 'Near Duplicate Groups', value: semanticReady ? kpis.nearDuplicateGroups : '—', type: 'semantic' as const },
    { label: 'Redundancy Score', value: semanticReady ? `${kpis.redundancyScore}%` : '—', type: 'hybrid' as const },
    { label: 'Entropy Score', value: `${kpis.entropyScore}%`, type: 'deterministic' as const },
    { label: 'Orphan Tag Ratio', value: `${kpis.orphanTagRatio}%`, type: 'deterministic' as const },
  ]

  const clusterSummaries = useMemo(() => {
    const pop = semanticVectors.length || rows.length || 1
    return clusters.map((c: any, i: number) => {
      const family = c?.[0]?.meta?.title || 'Unknown family'
      const size = c.length || 0
      const ratio = size / pop
      const risk = ratio >= 0.04 ? 'high' : ratio >= 0.02 ? 'medium' : 'low'
      return { index: i, id: i + 1, family, size, risk }
    })
  }, [clusters, semanticVectors.length, rows.length])

  const filteredSortedClusters = useMemo(() => {
    const q = clusterSearch.trim().toLowerCase()
    const base = clusterSummaries.filter((c) => !q || c.family.toLowerCase().includes(q) || String(c.id).includes(q))

    const sorted = [...base].sort((a, b) => {
      let cmp = 0
      if (clusterSortBy === 'id') cmp = a.id - b.id
      else if (clusterSortBy === 'size') cmp = a.size - b.size
      else if (clusterSortBy === 'family') cmp = a.family.localeCompare(b.family)
      else {
        const order = { low: 1, medium: 2, high: 3 } as const
        cmp = order[a.risk] - order[b.risk]
      }
      return clusterSortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [clusterSummaries, clusterSearch, clusterSortBy, clusterSortDir])

  const visibleClusters = useMemo(() => (showAllClusters ? filteredSortedClusters : filteredSortedClusters.slice(0, 24)), [showAllClusters, filteredSortedClusters])

  const clusterChartOption = useMemo(() => {
    const points = visibleClusters.map((c) => [c.id, c.size, c.family, c.index])
    return {
      backgroundColor: 'transparent',
      xAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Cluster ID', nameTextStyle: { color: '#8ca4d4' } },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Size', nameTextStyle: { color: '#8ca4d4' } },
      tooltip: { formatter: (p: any) => `Cluster ${p.data[0]}<br/>Size: ${p.data[1]}<br/>${p.data[2]}` },
      series: [{ type: 'scatter', symbolSize: (v: any) => Math.max(10, Math.min(44, v[1] * 1.3)), data: points, itemStyle: { color: '#57d9ff' } }],
    }
  }, [visibleClusters])

  const suiteChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    xAxis: { type: 'category', data: suiteDist.map((r: any) => r.test_suite_id), axisLabel: { color: '#a4bbec' } },
    yAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
    series: [{ type: 'bar', data: suiteDist.map((r: any) => Number(r.c)), itemStyle: { color: '#6d8eff' }, barMaxWidth: 24 }],
  }), [suiteDist])

  const featureStats = useMemo(() => {
    const map = new Map<string, { requirements: number; tests: number; defects: number }>()
    const touch = (feature: string) => {
      if (!map.has(feature)) map.set(feature, { requirements: 0, tests: 0, defects: 0 })
      return map.get(feature)!
    }

    for (const r of unified.requirements || []) {
      const f = String(r.tags?.[0] || 'general')
      touch(f).requirements += 1
    }
    for (const t of unified.test_cases || []) {
      const f = String(t.tags?.[0] || 'general')
      touch(f).tests += 1
    }
    for (const d of unified.defects || []) {
      const req = String(d.linked_requirement_id || '')
      const f = req.startsWith('REQ-') ? req.replace('REQ-', '').toLowerCase() : 'general'
      touch(f).defects += 1
    }

    return [...map.entries()]
      .map(([feature, v]) => ({ feature, ...v }))
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 12)
  }, [unified])

  const executionStatusOption = useMemo(() => {
    const counts = { passed: 0, failed: 0, blocked: 0 } as Record<string, number>
    for (const e of unified.executions || []) counts[String(e.execution_status || 'blocked')] = (counts[String(e.execution_status || 'blocked')] || 0) + 1
    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#a4bbec' } },
      series: [{
        type: 'pie',
        radius: ['45%', '72%'],
        data: [
          { value: counts.passed || 0, name: 'Passed' },
          { value: counts.failed || 0, name: 'Failed' },
          { value: counts.blocked || 0, name: 'Blocked' },
        ],
      }],
    }
  }, [unified])

  const featureCoverageOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#a4bbec' } },
    xAxis: { type: 'category', data: featureStats.map((f) => f.feature), axisLabel: { color: '#a4bbec', rotate: 20 } },
    yAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
    series: [
      { name: 'Requirements', type: 'bar', data: featureStats.map((f) => f.requirements), itemStyle: { color: '#57d9ff' } },
      { name: 'Test Cases', type: 'bar', data: featureStats.map((f) => f.tests), itemStyle: { color: '#6d8eff' } },
      { name: 'Defects', type: 'bar', data: featureStats.map((f) => f.defects), itemStyle: { color: '#ff7c8f' } },
    ],
  }), [featureStats])

  const relationshipFlowOption = useMemo(() => {
    const planCount = new Map<string, number>()
    const suiteCount = new Map<string, number>()
    const defectBySuite = new Map<string, number>()

    for (const t of unified.test_cases || []) {
      const p = String(t.test_plan_id || 'P-NA')
      const s = String(t.test_suite_id || 'S-NA')
      planCount.set(p, (planCount.get(p) || 0) + 1)
      suiteCount.set(s, (suiteCount.get(s) || 0) + 1)
    }
    for (const d of unified.defects || []) {
      const test = (unified.test_cases || []).find((t: any) => t.test_id === d.linked_test_id)
      const s = String(test?.test_suite_id || 'S-NA')
      defectBySuite.set(s, (defectBySuite.get(s) || 0) + 1)
    }

    const topPlans = [...planCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    const topSuites = [...suiteCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    const nodes = [
      ...topPlans.map(([p]) => ({ name: `Plan ${p}` })),
      ...topSuites.map(([s]) => ({ name: `Suite ${s}` })),
      { name: 'Defects' },
    ]

    const links: any[] = []
    for (const [p] of topPlans) {
      for (const [s] of topSuites) {
        const count = (unified.test_cases || []).filter((t: any) => t.test_plan_id === p && t.test_suite_id === s).length
        if (count > 0) links.push({ source: `Plan ${p}`, target: `Suite ${s}`, value: count })
      }
    }
    for (const [s] of topSuites) {
      const d = defectBySuite.get(s) || 0
      if (d > 0) links.push({ source: `Suite ${s}`, target: 'Defects', value: d })
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item' },
      series: [{ type: 'sankey', data: nodes, links, lineStyle: { color: 'gradient', curveness: 0.5 }, label: { color: '#d7e5ff' } }],
    }
  }, [unified])

  const requirementClusterOption = useMemo(() => {
    const groups = new Map<string, number>()
    for (const r of unified.requirements || []) {
      const f = String(r.tags?.[0] || 'general')
      groups.set(f, (groups.get(f) || 0) + 1)
    }
    const points = [...groups.entries()].map(([feature, count], i) => [i + 1, count, feature])
    return {
      xAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Cluster' },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Requirements' },
      tooltip: { formatter: (p: any) => `Req Cluster ${p.data[0]}<br/>Feature: ${p.data[2]}<br/>Size: ${p.data[1]}` },
      series: [{ type: 'scatter', data: points, symbolSize: (v: any) => 10 + Math.min(36, v[1] * 2), itemStyle: { color: '#57d9ff' } }],
    }
  }, [unified])

  const defectClusterOption = useMemo(() => {
    const groups = new Map<string, number>()
    for (const d of unified.defects || []) {
      const key = `${d.severity || 'unknown'}-${d.status || 'open'}`
      groups.set(key, (groups.get(key) || 0) + 1)
    }
    const points = [...groups.entries()].map(([key, count], i) => [i + 1, count, key])
    return {
      xAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Cluster' },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Defects' },
      tooltip: { formatter: (p: any) => `Defect Cluster ${p.data[0]}<br/>Pattern: ${p.data[2]}<br/>Size: ${p.data[1]}` },
      series: [{ type: 'scatter', data: points, symbolSize: (v: any) => 10 + Math.min(36, v[1] * 2), itemStyle: { color: '#ff7c8f' } }],
    }
  }, [unified])

  const unifiedClusterOption = useMemo(() => {
    const hash = (s: string) => Array.from(s).reduce((a, c) => ((a * 33 + c.charCodeAt(0)) >>> 0), 9)
    const req = (unified.requirements || []).slice(0, 300).map((r: any) => {
      const k = hash(String(r.requirement_id))
      return [k % 100, Math.floor(k / 7) % 100, r.requirement_id]
    })
    const tc = (unified.test_cases || []).slice(0, 900).map((t: any) => {
      const k = hash(String(t.test_id))
      return [k % 100, Math.floor(k / 5) % 100, t.test_id]
    })
    const df = (unified.defects || []).slice(0, 300).map((d: any) => {
      const k = hash(String(d.defect_id))
      return [k % 100, Math.floor(k / 3) % 100, d.defect_id]
    })
    return {
      legend: { data: ['Requirements', 'Tests', 'Defects'], textStyle: { color: '#a4bbec' } },
      xAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
      tooltip: { trigger: 'item' },
      series: [
        { name: 'Requirements', type: 'scatter', data: req, symbolSize: 9, itemStyle: { color: '#57d9ff' } },
        { name: 'Tests', type: 'scatter', data: tc, symbolSize: 7, itemStyle: { color: '#6d8eff' } },
        { name: 'Defects', type: 'scatter', data: df, symbolSize: 11, itemStyle: { color: '#ff7c8f' } },
      ],
    }
  }, [unified])

  const coverageHeatmapOption = useMemo(() => {
    const reqs = (unified.requirements || []).slice(0, 15)
    const suites = [...new Set((unified.test_cases || []).map((t: any) => t.test_suite_id))].slice(0, 12)
    const data: any[] = []
    reqs.forEach((r: any, i: number) => {
      suites.forEach((s: any, j: number) => {
        const linked = (unified.requirement_test_links || []).filter((l: any) => l.requirement_id === r.requirement_id)
        const val = linked.filter((l: any) => (unified.test_cases || []).find((t: any) => t.test_id === l.test_id && t.test_suite_id === s)).length
        data.push([j, i, val])
      })
    })
    return {
      tooltip: { position: 'top' },
      xAxis: { type: 'category', data: suites, axisLabel: { color: '#a4bbec', rotate: 20 } },
      yAxis: { type: 'category', data: reqs.map((r: any) => r.requirement_id), axisLabel: { color: '#a4bbec' } },
      visualMap: { min: 0, max: Math.max(1, ...data.map((d) => d[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0, textStyle: { color: '#a4bbec' } },
      series: [{ type: 'heatmap', data }],
    }
  }, [unified])

  const defectFunnelOption = useMemo(() => {
    const totalExec = (unified.executions || []).length
    const failed = (unified.executions || []).filter((e: any) => e.execution_status === 'failed').length
    const defects = (unified.defects || []).length
    const openDefects = (unified.defects || []).filter((d: any) => ['new', 'open', 'in-progress'].includes(String(d.status))).length
    return {
      tooltip: { trigger: 'item' },
      series: [{ type: 'funnel', top: 10, bottom: 10, left: '10%', width: '80%', label: { color: '#d7e5ff' }, data: [
        { name: 'Executions', value: totalExec },
        { name: 'Failed Runs', value: failed },
        { name: 'Defects Raised', value: defects },
        { name: 'Open Defects', value: openDefects },
      ] }],
    }
  }, [unified])

  const reliabilityByPlanOption = useMemo(() => {
    const plans = [...new Set((unified.executions || []).map((e: any) => e.test_plan_id))].slice(0, 10)
    const counts = (status: string) => plans.map((p) => (unified.executions || []).filter((e: any) => e.test_plan_id === p && e.execution_status === status).length)
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['Passed', 'Failed', 'Blocked'], textStyle: { color: '#a4bbec' } },
      xAxis: { type: 'category', data: plans, axisLabel: { color: '#a4bbec' } },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
      series: [
        { name: 'Passed', type: 'bar', stack: 'total', data: counts('passed'), itemStyle: { color: '#38d39f' } },
        { name: 'Failed', type: 'bar', stack: 'total', data: counts('failed'), itemStyle: { color: '#ff7c8f' } },
        { name: 'Blocked', type: 'bar', stack: 'total', data: counts('blocked'), itemStyle: { color: '#f0c14b' } },
      ],
    }
  }, [unified])

  const traceabilityGaugeOption = useMemo(() => {
    const totalTests = Math.max(1, (unified.test_cases || []).length)
    const linkedTests = new Set((unified.requirement_test_links || []).map((l: any) => l.test_id)).size
    const defects = unified.defects || []
    const linkedDefects = defects.filter((d: any) => d.linked_test_id && d.linked_requirement_id).length
    const v1 = Math.round((linkedTests / totalTests) * 100)
    const v2 = defects.length ? Math.round((linkedDefects / defects.length) * 100) : 100
    return {
      series: [
        { type: 'gauge', center: ['28%', '55%'], radius: '50%', min: 0, max: 100, detail: { formatter: '{value}%' }, title: { offsetCenter: [0, '75%'], color: '#a4bbec' }, data: [{ value: v1, name: 'Test Linkage' }] },
        { type: 'gauge', center: ['72%', '55%'], radius: '50%', min: 0, max: 100, detail: { formatter: '{value}%' }, title: { offsetCenter: [0, '75%'], color: '#a4bbec' }, data: [{ value: v2, name: 'Defect Linkage' }] },
      ],
    }
  }, [unified])

  const selectedCluster = selectedClusterIndex !== null ? clusters[selectedClusterIndex] : null
  const selectedClusterRows: TestCaseRow[] = (selectedCluster || []).map((x: any) => x.meta).filter(Boolean)
  const totalClusterCount = clusters.length
  const visibleClusterCount = visibleClusters.length
  const totalPopulation = semanticVectors.length || rows.length
  const selectedClusterFamilyName = selectedClusterRows[0]?.title || selectedCluster?.[0]?.meta?.title || 'Unknown family'
  const clusterMeta = buildClusterMeta({
    selectedClusterIndex,
    totalClusterCount,
    selectedClusterSize: selectedClusterRows.length,
    totalPopulation,
    familyName: selectedClusterFamilyName,
  })

  const clusterEvents = {
    click: (params: any) => {
      const idx = Number(params?.data?.[3])
      if (!Number.isNaN(idx)) {
        setSelectedClusterIndex(idx)
        setClusterPopupOpen(true)
      }
    },
  }

  const loadRows = async (data: TestCaseRow[], source: string) => {
    setRows(data)
    setSemanticReady(false)
    setClusters([])
    setSemanticVectors([])
    setSelectedClusterIndex(null)
    setClusterPopupOpen(false)
    setStatus(`Loaded ${data.length.toLocaleString()} tests from ${source}`)
    await loadTestsToDuckDB(data)
    setSuiteDist((await queryDashboardStats()).suiteDist)
  }

  const onGenerate = async () => {
    if (isGeneratingSchema) return
    setIsGeneratingSchema(true)
    setGenerateProgress(8)
    setStatus('Generating unified schema records...')

    try {
      await new Promise((r) => setTimeout(r, 80))
      setGenerateProgress(28)
      const generated = generateSyntheticTests(10000)
      setGenerateProgress(72)
      await loadRows(generated, 'synthetic unified schema generator')
      setGenerateProgress(100)
      setStatus(`Loaded ${generated.length.toLocaleString()} tests from synthetic unified schema generator`)
    } finally {
      setTimeout(() => {
        setIsGeneratingSchema(false)
        setGenerateProgress(0)
      }, 400)
    }
  }

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      await loadRows(file.name.endsWith('.csv') ? parseCsv(text) : parseJson(text), file.name)
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`)
    }
  }

  const onBuildSemantic = async () => {
    if (!rows.length || isBuildingSemantic) return
    setIsBuildingSemantic(true)
    setSemanticReady(false)
    setSelectedClusterIndex(null)
    setClusterPopupOpen(false)
    cancelBuildRef.current = false
    setBuildProgress(0)

    const targetRows = buildMode === 'quick' ? rows.slice(0, Math.min(rows.length, 2000)) : rows
    setEmbStatus(`Initializing embedding + sqlite-vec index (${buildMode.toUpperCase()} mode, ${targetRows.length.toLocaleString()} tests)...`)

    if (!isReasoningReady()) {
      setLlmStatus('Initializing local LLM in background (optional for KPI build)...')
      try {
        const llmMode = await initReasoningEngine()
        setLlmStatus(`Copilot mode: ${llmMode}`)
      } catch (err: any) {
        setLlmStatus(`Copilot unavailable on this device/browser: ${String(err?.message || err)}`)
      }
    }

    const mode = await initEmbeddingModel()

    const chunkSize = buildMode === 'quick' ? 120 : 80
    const workerInput = targetRows.map((row) => ({
      id: row.test_case_id,
      text: `${row.title}. ${row.description}. Steps: ${row.steps}. Tags: ${(row.tags || []).join(', ')}`,
    }))

    const vectors: any[] = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./workers/embeddingWorker.ts', import.meta.url), { type: 'module' })

      worker.onmessage = (e: MessageEvent<any>) => {
        const m = e.data
        if (cancelBuildRef.current) {
          worker.terminate()
          reject(new Error('cancelled'))
          return
        }

        if (m?.type === 'progress') {
          setBuildProgress(m.progress)
          setEmbStatus(`Embedding progress: ${m.progress}% (${m.done.toLocaleString()}/${m.total.toLocaleString()})`)
        }

        if (m?.type === 'done') {
          worker.terminate()
          const vecs = m.vectors.map((v: any) => ({ ...v, meta: targetRows.find((r) => r.test_case_id === v.id) }))
          resolve(vecs)
        }
      }

      worker.onerror = (err) => {
        worker.terminate()
        reject(err)
      }

      worker.postMessage({ type: 'build', rows: workerInput, chunkSize })
    }).catch((err) => {
      if (String(err).includes('cancelled')) return []
      throw err
    })

    if (!vectors.length) {
      setEmbStatus(`Semantic build cancelled at ${buildProgress}%`)
      setIsBuildingSemantic(false)
      return
    }

    const vecReady = await store.init()
    let indexMode = 'in-memory fallback'
    if (vecReady) {
      await store.upsert(vectors)
      indexMode = 'sqlite-vec/zvec'
    }

    const c = clusterByThreshold(vectors, 0.9)
    setClusters(c)
    setSemanticVectors(vectors)
    setSemanticReady(true)
    setEmbStatus(`Embeddings ready (${mode}) · index: ${indexMode} · ${vectors.length.toLocaleString()} vectors · ${c.length} clusters`)
    setIsBuildingSemantic(false)
  }

  const onCancelSemanticBuild = () => {
    cancelBuildRef.current = true
  }

  const onAsk = async () => {
    if (isAsking) return
    const reqId = Date.now()
    askRequestIdRef.current = reqId

    setIsAsking(true)
    setAskProgress(10)
    setAskStage('Preparing context')
    setAnswer('')

    let context: TestCaseRow[] = []

    if (store.isReady()) {
      const qv = await embedText(question)
      const hits = store.search(qv, 10)
      context = hits.map((h: any) => h.doc?.meta).filter(Boolean)
    }

    if (askRequestIdRef.current !== reqId) return

    setAskProgress(35)
    setAskStage('Retrieving evidence')

    if (!context.length) context = (clusters[0] || []).slice(0, 20).map((x: any) => x.meta)
    if (!context.length) context = rows.slice(0, 20)
    context = rankContextByQuestion(question, context).slice(0, 8)

    setAskProgress(60)
    setAskStage('Checking local LLM runtime')

    if (!isReasoningReady()) {
      setLlmStatus('Starting local LLM for Copilot...')
      try {
        const initTimeoutMs = 45000
        const llmMode = await Promise.race([
          initReasoningEngine(),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`LLM initialization timed out after ${initTimeoutMs / 1000}s.`)), initTimeoutMs)),
        ])
        setLlmStatus(`Copilot mode: ${llmMode}`)
      } catch (err: any) {
        if (askRequestIdRef.current !== reqId) return
        setAskProgress(100)
        setAnswer(emergencyCopilotAnswer(question, context))
        setIsAsking(false)
        setAskProgress(0)
        setAskStage('Idle')
        return
      }
    }

    setAskProgress(78)
    setAskStage('Generating answer')

    try {
      const timeoutMs = 30000
      const timed = await Promise.race([
        askCopilot(question, context),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error(`Copilot timed out after ${timeoutMs / 1000}s. Try a shorter question or reduce context size.`)), timeoutMs)),
      ])

      if (askRequestIdRef.current !== reqId) return
      setAskProgress(92)
      // lightweight streaming UX
      const chunks = String(timed).split(/\s+/)
      let acc = ''
      for (let i = 0; i < chunks.length; i++) {
        if (askRequestIdRef.current !== reqId) return
        acc += (i === 0 ? '' : ' ') + chunks[i]
        if (i % 12 === 0 || i === chunks.length - 1) {
          setAnswer(acc)
          await new Promise((r) => setTimeout(r, 8))
        }
      }
      setAskProgress(100)
    } catch (err: any) {
      if (askRequestIdRef.current !== reqId) return
      setAskProgress(100)
      setAnswer(String(err?.message || err))
    } finally {
      if (askRequestIdRef.current === reqId) {
        setTimeout(() => {
          setIsAsking(false)
          setAskProgress(0)
          setAskStage('Idle')
        }, 250)
      }
    }
  }

  const onCancelAsk = () => {
    askRequestIdRef.current = 0
    setIsAsking(false)
    setAskProgress(0)
    setAskStage('Cancelled')
    setAnswer((prev) => prev || 'Request cancelled by user.')
  }

  const downloadKpiMatching = (label: string) => {
    if (!rows.length) return

    if (label === 'Total Tests') return downloadJson(rows, 'kpi_total_tests.json')

    if (label === 'Exact Duplicate Groups') {
      const map = new Map<string, TestCaseRow[]>()
      rows.forEach((r) => {
        const k = textKey(r)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(r)
      })
      const out = [...map.values()].filter((g) => g.length > 1).flat()
      return downloadJson(out, 'kpi_exact_duplicates.json')
    }

    if (label === 'Near Duplicate Groups') {
      if (semanticVectors.length) {
        const near = clusters.filter((c) => c.length > 1).flat().map((x: any) => x.meta)
        return downloadJson(near, 'kpi_near_duplicates.json')
      }
      const b = new Map<string, TestCaseRow[]>()
      rows.forEach((r) => {
        const k = nearDupKey(r)
        if (!b.has(k)) b.set(k, [])
        b.get(k)!.push(r)
      })
      const out = [...b.values()].filter((g) => g.length > 1).flat()
      return downloadJson(out, 'kpi_near_duplicates.json')
    }

    if (label === 'Redundancy Score') {
      const map = new Map<string, TestCaseRow[]>()
      rows.forEach((r) => {
        const k = textKey(r)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(r)
      })
      const exact = [...map.values()].filter((g) => g.length > 1).flat()
      const near = clusters.filter((c) => c.length > 1).flat().map((x: any) => x.meta)
      const merged = [...new Map([...exact, ...near].map((r) => [r.test_case_id, r])).values()]
      return downloadJson(merged, 'kpi_redundancy_candidates.json')
    }

    if (label === 'Entropy Score') {
      const byFeature = new Map<string, TestCaseRow[]>()
      rows.forEach((r) => {
        const f = (r.title.split(':')[0] || 'unknown').trim().toLowerCase()
        if (!byFeature.has(f)) byFeature.set(f, [])
        byFeature.get(f)!.push(r)
      })
      const least = [...byFeature.entries()].sort((a, b) => a[1].length - b[1].length).slice(0, 3).flatMap((x) => x[1])
      return downloadJson(least, 'kpi_entropy_low_coverage_features.json')
    }

    if (label === 'Orphan Tag Ratio') {
      const out = rows.filter((r) => !r.tags?.length || r.tags.some((t) => t !== t.toLowerCase()))
      return downloadJson(out, 'kpi_orphan_or_inconsistent_tags.json')
    }
  }

  return (
    <main style={{ fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif', padding: 24, background: 'radial-gradient(circle at 15% 0%, #12244f, #0a1220 45%)', color: '#e8f0ff', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 34 }}>QualiGraph</h1>
      <p style={{ marginTop: 0, marginBottom: 6, color: '#d9e7ff', fontWeight: 700, maxWidth: 980 }}>
        The Quality Signal Platform for Product Delivery
      </p>
      <p style={{ marginTop: 0, marginBottom: 6, color: '#c4d5f4', fontWeight: 600, maxWidth: 980 }}>
        The operating system for delivery quality
      </p>
      <p style={{ marginTop: 0, color: '#abc0ea', maxWidth: 980 }}>
        Unify requirements, tests, executions, and defects into one intelligence graph, so teams can measure risk, prioritize action, and ship with confidence.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={onGenerate} disabled={isGeneratingSchema} style={btn('#2a6cff', isGeneratingSchema)}>{isGeneratingSchema ? `Generating... ${generateProgress}%` : 'Generate 10,000 Unified Schema Records'}</button>
        <label style={{ ...btn('#1a315e'), border: '1px solid #3a5388' }}>Upload Test Data JSON/CSV<input type="file" accept="application/json,text/csv,.csv" onChange={onUpload} style={{ display: 'none' }} /></label>
        <button onClick={() => downloadJson(rows)} disabled={!rows.length} style={btn('#245f4a', !rows.length)}>Export Test Cases</button>
        <button onClick={() => downloadJson(unified, 'qaip_unified_schema_bundle.json')} disabled={!rows.length} style={btn('#5f3ca4', !rows.length)}>Download Complete Schema Bundle</button>

        <div style={{ display: 'inline-flex', border: '1px solid #3a5388', borderRadius: 10, overflow: 'hidden' }}>
          <button onClick={() => setBuildMode('quick')} style={{ ...btn(buildMode === 'quick' ? '#1f6b56' : '#1b2f5a'), borderRadius: 0 }}>Quick (2k)</button>
          <button onClick={() => setBuildMode('full')} style={{ ...btn(buildMode === 'full' ? '#1f6b56' : '#1b2f5a'), borderRadius: 0 }}>Full (10k)</button>
        </div>

        <button onClick={onBuildSemantic} disabled={isBuildingSemantic} style={btn('#11856b', isBuildingSemantic)}>
          {isBuildingSemantic ? `Building... ${buildProgress}%` : 'Build Embeddings + Clusters'}
        </button>
        <button onClick={onCancelSemanticBuild} disabled={!isBuildingSemantic} style={btn('#9a3240', !isBuildingSemantic)}>Cancel Build</button>
      </div>

      <div style={{ color: '#95aedf', marginBottom: 4 }}>{status}</div>
      {!!rows.length && (
        <div style={{ color: '#b8c9ef', marginBottom: 8, fontSize: 12 }}>
          Schema snapshot: {unified.summary.requirements} requirements · {unified.summary.test_cases} tests · {unified.summary.executions} runs · {unified.summary.defects} defects
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #324978', borderRadius: 999, background: '#111c34', color: '#c7d8fa', fontSize: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: runtimeMode.startsWith('webgpu') ? '#39d98a' : runtimeMode.startsWith('cpu-wasm') ? '#f0c14b' : '#f36f6f' }} />
          Copilot Runtime: {runtimeMode}
        </div>
        <label style={{ fontSize: 12, color: '#a9bee9' }}>Model profile:</label>
        <select
          value={modelProfile}
          onChange={(e) => {
            const p = e.target.value as ModelProfile
            setModelProfileState(p)
            setModelProfile(p)
            setLlmStatus(`Model profile changed to ${p}. Runtime will re-initialize on next ask/build.`)
          }}
          style={{ background: '#111c34', color: '#d7e5ff', border: '1px solid #324978', borderRadius: 8, padding: '6px 8px' }}
        >
          <option value="ultra-light">Ultra-light</option>
          <option value="balanced">Balanced</option>
          <option value="quality">Quality</option>
        </select>
      </div>
      {isGeneratingSchema && (
        <div style={{ marginBottom: 10, width: '100%', maxWidth: 560, height: 10, background: '#1a2742', borderRadius: 999, overflow: 'hidden', border: '1px solid #324978' }}>
          <div style={{ width: `${generateProgress}%`, height: '100%', background: 'linear-gradient(90deg,#6d8eff,#57d9ff)' }} />
        </div>
      )}
      <div style={{ color: '#95aedf', marginBottom: 4 }}>{embStatus}</div>
      {isBuildingSemantic && (
        <div style={{ marginBottom: 10, width: '100%', maxWidth: 560, height: 10, background: '#1a2742', borderRadius: 999, overflow: 'hidden', border: '1px solid #324978' }}>
          <div style={{ width: `${buildProgress}%`, height: '100%', background: 'linear-gradient(90deg,#2ccf8f,#4ad0ff)' }} />
        </div>
      )}
      <div style={{ color: '#95aedf', marginBottom: 14 }}>{llmStatus}</div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {kpiItems.map((k) => {
          const pending = !semanticReady && (k.label === 'Near Duplicate Groups' || k.label === 'Redundancy Score')
          const modeLabel = k.type === 'deterministic' ? 'Deterministic' : k.type === 'semantic' ? 'Semantic' : 'Hybrid'
          return (
          <div key={k.label} style={{ background: 'linear-gradient(165deg, #121d34, #101a2f)', border: '1px solid #30446f', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#a8bce8', fontSize: 12, fontWeight: 700 }}>{k.label}</div>
              <button onClick={() => setPopup({ title: k.label, body: KPI_HELP[k.label] })} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #4a6396', background: '#1a2b4f', color: '#d8e6ff', cursor: 'pointer', fontWeight: 700 }}>i</button>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{k.value}</div>
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <span style={{ fontSize:11, padding:'2px 7px', border:'1px solid #3a5388', borderRadius:999, color:'#b7c9ef' }}>{modeLabel}</span>
              <span style={{ fontSize:11, padding:'2px 7px', border:'1px solid #3a5388', borderRadius:999, color: pending ? '#ffd28a' : '#97e5b2' }}>{pending ? 'Pending Semantic Build' : 'Ready'}</span>
            </div>
            <button disabled={pending} onClick={() => downloadKpiMatching(k.label)} style={{ ...btn('#243f73', pending), marginTop: 8, width: '100%' }}>Download matching tests</button>
          </div>
        )})}
      </section>

      <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <Panel title="Semantic Cluster Map (Test Cases)" onInfo={() => setPopup({ title: 'Semantic Cluster Map', body: CHART_HELP['Semantic Cluster Map'] })}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
            <button onClick={() => setShowAllClusters(false)} style={btn(!showAllClusters ? '#1f6b56' : '#1b2f5a')}>Top clusters view</button>
            <button onClick={() => setShowAllClusters(true)} style={btn(showAllClusters ? '#1f6b56' : '#1b2f5a')}>Show all clusters</button>
            <input
              value={clusterSearch}
              onChange={(e) => setClusterSearch(e.target.value)}
              placeholder="Search cluster/family..."
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #324978', background: '#0b1220', color: '#e8f0ff', minWidth: 180 }}
            />
          </div>
          <ReactECharts option={clusterChartOption} onEvents={clusterEvents} style={{ height: 320 }} />
          <div style={{ marginTop: 8, fontSize: 12, color: '#9fb2df' }}>
            Click a bubble to inspect that cluster and download its test cases.
          </div>
        </Panel>
        <Panel title="Suite Distribution (DuckDB)" onInfo={() => setPopup({ title: 'Suite Distribution (DuckDB)', body: CHART_HELP['Suite Distribution (DuckDB)'] })}>
          <ReactECharts option={suiteChartOption} style={{ height: 320 }} />
        </Panel>
      </section>

      <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <Panel title="Requirement / Test / Defect Coverage by Feature">
          <ReactECharts option={featureCoverageOption} style={{ height: 320 }} />
        </Panel>
        <Panel title="Execution Outcome Mix">
          <ReactECharts option={executionStatusOption} style={{ height: 320 }} />
        </Panel>
      </section>

      <section style={{ marginTop: 12 }}>
        <Panel title="Consolidated Relationship Flow (Plan → Suite → Defects)" onInfo={() => setPopup({ title: 'Consolidated Relationship Flow', body: CHART_HELP['Unified Cluster Map'] })}>
          <ReactECharts option={relationshipFlowOption} style={{ height: 360 }} />
        </Panel>
      </section>

      <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
        <Panel title="Requirement Cluster Map" onInfo={() => setPopup({ title: 'Requirement Cluster Map', body: CHART_HELP['Requirement Cluster Map'] })}>
          <ReactECharts option={requirementClusterOption} style={{ height: 300 }} />
        </Panel>
        <Panel title="Defect Cluster Map" onInfo={() => setPopup({ title: 'Defect Cluster Map', body: CHART_HELP['Defect Cluster Map'] })}>
          <ReactECharts option={defectClusterOption} style={{ height: 300 }} />
        </Panel>
        <Panel title="Unified Cluster Map" onInfo={() => setPopup({ title: 'Unified Cluster Map', body: CHART_HELP['Unified Cluster Map'] })}>
          <ReactECharts option={unifiedClusterOption} style={{ height: 300 }} />
        </Panel>
      </section>

      <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <Panel title="Requirement Coverage Heatmap" onInfo={() => setPopup({ title: 'Requirement Coverage Heatmap', body: CHART_HELP['Requirement Coverage Heatmap'] })}>
          <ReactECharts option={coverageHeatmapOption} style={{ height: 320 }} />
        </Panel>
        <Panel title="Defect Leakage Funnel" onInfo={() => setPopup({ title: 'Defect Leakage Funnel', body: CHART_HELP['Defect Leakage Funnel'] })}>
          <ReactECharts option={defectFunnelOption} style={{ height: 320 }} />
        </Panel>
      </section>

      <section style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <Panel title="Execution Reliability by Plan" onInfo={() => setPopup({ title: 'Execution Reliability by Plan', body: CHART_HELP['Execution Reliability by Plan'] })}>
          <ReactECharts option={reliabilityByPlanOption} style={{ height: 320 }} />
        </Panel>
        <Panel title="Traceability Completeness" onInfo={() => setPopup({ title: 'Traceability Completeness', body: CHART_HELP['Traceability Completeness'] })}>
          <ReactECharts option={traceabilityGaugeOption} style={{ height: 320 }} />
        </Panel>
      </section>

      <Panel title="All Clusters" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#a9bee9' }}>Sort by:</label>
          <select value={clusterSortBy} onChange={(e) => setClusterSortBy(e.target.value as any)} style={{ background: '#111c34', color: '#d7e5ff', border: '1px solid #324978', borderRadius: 8, padding: '6px 8px' }}>
            <option value="size">Size</option>
            <option value="risk">Risk</option>
            <option value="family">Family</option>
            <option value="id">Cluster ID</option>
          </select>
          <select value={clusterSortDir} onChange={(e) => setClusterSortDir(e.target.value as any)} style={{ background: '#111c34', color: '#d7e5ff', border: '1px solid #324978', borderRadius: 8, padding: '6px 8px' }}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <span style={{ fontSize: 12, color: '#9fb2df' }}>Showing {visibleClusterCount}/{filteredSortedClusters.length} filtered clusters ({totalClusterCount} total)</span>
        </div>

        <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #2a3b62', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#9fb2df', position: 'sticky', top: 0, background: '#101a30' }}>
                <th style={th}>Cluster ID</th><th style={th}>Family</th><th style={th}>Size</th><th style={th}>Risk</th><th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleClusters.map((c) => (
                <tr key={c.index}>
                  <td style={td}>{c.id}</td>
                  <td style={td}>{c.family}</td>
                  <td style={td}>{c.size}/{totalPopulation}</td>
                  <td style={td}>{c.risk}</td>
                  <td style={td}><button onClick={() => { setSelectedClusterIndex(c.index); setClusterPopupOpen(true) }} style={{ ...btn('#2a6cff'), padding: '6px 10px', fontSize: 12 }}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedCluster ? (
          <div style={{ color: '#9fb2df', fontSize: 13, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Selected Cluster ID {clusterMeta.selectedClusterDisplayIndex} · Family: {clusterMeta.familyName} · Size: {clusterMeta.sizeLabel} · Total clusters: {clusterMeta.totalClusterCount}</span>
            <button onClick={() => setClusterPopupOpen(true)} style={btn('#2a6cff')}>Open Cluster Details</button>
          </div>
        ) : (
          <div style={{ color: '#9fb2df', fontSize: 13, marginTop: 10 }}>No cluster selected yet. Click a bubble in the map or a row in this table.</div>
        )}
      </Panel>

      <Panel title="Sample Unified Schema Records" style={{ marginTop: 16 }}>
        <div style={{ maxHeight: 260, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#9fb2df' }}>
                <th style={th}>Entity</th><th style={th}>ID</th><th style={th}>Name / Title</th><th style={th}>Relationship Context</th>
              </tr>
            </thead>
            <tbody>
              {(unified.requirements || []).slice(0, 6).map((r: any) => (
                <tr key={`req-${r.requirement_id}`}><td style={td}>Requirement</td><td style={td}>{r.requirement_id}</td><td style={td}>{r.requirement_name}</td><td style={td}>Linked Tests: {(unified.requirement_test_links || []).filter((l: any) => l.requirement_id === r.requirement_id).length}</td></tr>
              ))}
              {(unified.test_cases || []).slice(0, 8).map((t: any) => (
                <tr key={`tc-${t.test_id}`}><td style={td}>Test Case</td><td style={td}>{t.test_id}</td><td style={td}>{t.test_case_name}</td><td style={td}>Plan {t.test_plan_id} · Suite {t.test_suite_id}</td></tr>
              ))}
              {(unified.defects || []).slice(0, 6).map((d: any) => (
                <tr key={`def-${d.defect_id}`}><td style={td}>Defect</td><td style={td}>{d.defect_id}</td><td style={td}>{d.title}</td><td style={td}>{d.severity}/{d.status} · Test {d.linked_test_id}</td></tr>
              ))}
              {(unified.executions || []).slice(0, 6).map((e: any) => (
                <tr key={`run-${e.run_id}`}><td style={td}>Execution</td><td style={td}>{e.run_id}</td><td style={td}>{e.execution_status.toUpperCase()}</td><td style={td}>Test {e.test_id} · {e.environment}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="QA Copilot" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#9fb2df', marginBottom: 6 }}>Quick discovery questions:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SAMPLE_QUESTIONS.map((q) => (
              <button key={q} onClick={() => setQuestion(q)} style={{ ...btn('#223a6b'), padding: '6px 10px', fontSize: 12 }}>{q}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #324978', background: '#0b1220', color: '#e8f0ff' }} />
          <button onClick={onAsk} disabled={isAsking} style={btn('#2a6cff', isAsking)}>{isAsking ? 'Thinking...' : 'Ask'}</button>
          <button onClick={onCancelAsk} disabled={!isAsking} style={btn('#8f3242', !isAsking)}>Cancel</button>
        </div>

        {isAsking && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#9fb2df', marginBottom: 5 }}>{askStage} (local LLM)</div>
            <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#1b2a47', border: '1px solid #324978', overflow: 'hidden' }}>
              <div style={{ width: `${askProgress}%`, height: '100%', background: 'linear-gradient(90deg,#7c5cff,#4ad0ff)' }} />
            </div>
          </div>
        )}

        <pre style={{ marginTop: 10, background: '#0b1220', border: '1px solid #324978', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', color: '#c9d7f8' }}>{answer || (isAsking ? 'Working on your question...' : 'No response yet.')}</pre>
      </Panel>

      {clusterPopupOpen && selectedCluster && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,20,0.78)', display: 'grid', placeItems: 'center', zIndex: 45 }}>
          <div style={{ width: 'min(980px, 96vw)', maxHeight: '88vh', overflow: 'auto', background: '#101a30', border: '1px solid #314a79', borderRadius: 14, padding: 16, boxShadow: '0 20px 70px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Cluster ID {clusterMeta.selectedClusterDisplayIndex} Details</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => downloadJson(selectedClusterRows, `cluster_${clusterMeta.selectedClusterDisplayIndex}_testcases.json`)} style={btn('#2a6cff', !selectedClusterRows.length)} disabled={!selectedClusterRows.length}>Download JSON</button>
                <button onClick={() => downloadCsv(selectedClusterRows, `cluster_${clusterMeta.selectedClusterDisplayIndex}_testcases.csv`)} style={btn('#245f4a', !selectedClusterRows.length)} disabled={!selectedClusterRows.length}>Download CSV</button>
                <button onClick={() => setClusterPopupOpen(false)} style={{ ...btn('#273e6c'), padding: '6px 10px' }}>Close</button>
              </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #35528a', borderRadius: 999, color: '#d4e3ff' }}><strong>Cluster ID:</strong> {clusterMeta.selectedClusterDisplayIndex}</span>
              <span style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #35528a', borderRadius: 999, color: '#d4e3ff' }}><strong>Family:</strong> {clusterMeta.familyName}</span>
              <span style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #35528a', borderRadius: 999, color: '#d4e3ff' }}><strong>Size:</strong> {clusterMeta.sizeLabel}</span>
              <span style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #35528a', borderRadius: 999, color: '#d4e3ff' }}><strong>Total Clusters:</strong> {clusterMeta.totalClusterCount}</span>
              <span style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #35528a', borderRadius: 999, color: '#d4e3ff' }}><strong>Visible on map:</strong> {visibleClusterCount}</span>
            </div>

            <div style={{ marginTop: 10, color: '#c8d7f8', fontSize: 13, lineHeight: 1.55 }}>
              <p><strong>Concept:</strong> A cluster is a semantic family of test cases that appear to validate similar intent.</p>
              <p><strong>Technical:</strong> Cluster formed from embedding similarity (non-deterministic semantic grouping) after deterministic preprocessing.</p>
              <p><strong>Business value:</strong> Helps stakeholders identify duplication hotspots, consolidation opportunities, and potential test-suite cost reduction.</p>
              <p><strong>Deterministic vs Non-deterministic:</strong> Hybrid — deterministic pipeline orchestration and indexing, non-deterministic semantic meaning from embeddings/LLM-assisted interpretation.</p>
            </div>

            <div style={{ marginTop: 10, maxHeight: '48vh', overflow: 'auto', border: '1px solid #2a3b62', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#9fb2df', position: 'sticky', top: 0, background: '#101a30' }}>
                    <th style={th}>ID</th><th style={th}>Title</th><th style={th}>Suite</th><th style={th}>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClusterRows.map((r) => (
                    <tr key={r.test_case_id}><td style={td}>{r.test_case_id}</td><td style={td}>{r.title}</td><td style={td}>{r.test_suite_id}</td><td style={td}>{(r.tags || []).join(', ')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,8,20,0.7)', display: 'grid', placeItems: 'center', zIndex: 40 }}>
          <div style={{ width: 'min(680px, 92vw)', background: '#101a30', border: '1px solid #314a79', borderRadius: 14, padding: 16, boxShadow: '0 20px 70px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{popup.title}</h3>
              <button onClick={() => setPopup(null)} style={{ ...btn('#273e6c'), padding: '6px 10px' }}>Close</button>
            </div>
            <p style={{ color: '#c8d7f8', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{popup.body}</p>
          </div>
        </div>
      )}
    </main>
  )
}

function Panel({ title, children, style = {} as React.CSSProperties, onInfo }: any) {
  return (
    <section style={{ background: '#121a2d', border: '1px solid #2a3b62', borderRadius: 12, padding: 12, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {onInfo && <button onClick={onInfo} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #4a6396', background: '#1a2b4f', color: '#d8e6ff', cursor: 'pointer', fontWeight: 700 }}>i</button>}
      </div>
      {children}
    </section>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #273b62' }
const td: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #1a2d50', color: '#c9d7f8' }
const btn = (bg: string, disabled = false): React.CSSProperties => ({ background: bg, color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1 })

createRoot(document.getElementById('root')!).render(<App />)

import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactECharts from 'echarts-for-react'
import Papa from 'papaparse'
import { computeKpis } from './analytics'
import { askCopilot, getReasoningMode, initReasoningEngine, isReasoningReady } from './copilot'
import { loadTestsToDuckDB, queryDashboardStats } from './duckdb'
import { initEmbeddingModel, embedText } from './embeddings'
import { generateSyntheticTests } from './synthetic'
import type { TestCaseRow } from './types'
import { clusterByThreshold } from './vector'
import { SqliteVecStore } from './sqliteVecStore'

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
  'Semantic Cluster Map': `Concept: Visual map of semantic test families.\n\nTechnical: Each bubble represents a cluster of similar embeddings; larger bubble = larger family.\n\nDeterministic vs Non-deterministic: Non-deterministic (LLM/embedding-assisted grouping).\n\nBusiness value: Helps leadership quickly see duplication hotspots and prioritize consolidation waves.`,
  'Suite Distribution (DuckDB)': `Concept: Distribution of tests across suites.\n\nTechnical: DuckDB aggregation of test counts by suite ID.\n\nDeterministic vs Non-deterministic: Deterministic (programmatic aggregation).\n\nBusiness value: Detects imbalance and potential blind spots; supports rational rebalancing of QA investment.`,
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

function downloadJson(rows: TestCaseRow[], fileName = 'generated_testcases.json') {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
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
  const [isBuildingSemantic, setIsBuildingSemantic] = useState(false)
  const [buildMode, setBuildMode] = useState<'quick' | 'full'>('quick')
  const [buildProgress, setBuildProgress] = useState(0)
  const [semanticReady, setSemanticReady] = useState(false)
  const [semanticVectors, setSemanticVectors] = useState<any[]>([])
  const [popup, setPopup] = useState<{ title: string; body: string } | null>(null)
  const cancelBuildRef = useRef(false)

  const kpis = useMemo(() => computeKpis(rows), [rows])
  const runtimeMode = getReasoningMode()

  const kpiItems = [
    { label: 'Total Tests', value: kpis.totalTests.toLocaleString(), type: 'deterministic' as const },
    { label: 'Exact Duplicate Groups', value: kpis.exactDuplicateGroups, type: 'deterministic' as const },
    { label: 'Near Duplicate Groups', value: semanticReady ? kpis.nearDuplicateGroups : '—', type: 'semantic' as const },
    { label: 'Redundancy Score', value: semanticReady ? `${kpis.redundancyScore}%` : '—', type: 'hybrid' as const },
    { label: 'Entropy Score', value: `${kpis.entropyScore}%`, type: 'deterministic' as const },
    { label: 'Orphan Tag Ratio', value: `${kpis.orphanTagRatio}%`, type: 'deterministic' as const },
  ]

  const clusterChartOption = useMemo(() => {
    const points = clusters.slice(0, 24).map((c: any, i: number) => [i, c.length, c[0]?.meta?.title || ''])
    return {
      backgroundColor: 'transparent',
      xAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Cluster', nameTextStyle: { color: '#8ca4d4' } },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Size', nameTextStyle: { color: '#8ca4d4' } },
      tooltip: { formatter: (p: any) => `Cluster ${p.data[0]}<br/>Size: ${p.data[1]}<br/>${p.data[2]}` },
      series: [{ type: 'scatter', symbolSize: (v: any) => Math.max(10, Math.min(44, v[1] * 1.3)), data: points, itemStyle: { color: '#57d9ff' } }],
    }
  }, [clusters])

  const suiteChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    xAxis: { type: 'category', data: suiteDist.map((r: any) => r.test_suite_id), axisLabel: { color: '#a4bbec' } },
    yAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
    series: [{ type: 'bar', data: suiteDist.map((r: any) => Number(r.c)), itemStyle: { color: '#6d8eff' }, barMaxWidth: 24 }],
  }), [suiteDist])

  const loadRows = async (data: TestCaseRow[], source: string) => {
    setRows(data)
    setSemanticReady(false)
    setClusters([])
    setSemanticVectors([])
    setStatus(`Loaded ${data.length.toLocaleString()} tests from ${source}`)
    await loadTestsToDuckDB(data)
    setSuiteDist((await queryDashboardStats()).suiteDist)
  }

  const onGenerate = async () => loadRows(generateSyntheticTests(10000), 'synthetic generator')

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
    setIsAsking(true)
    setAskProgress(10)
    setAnswer('')

    let context: TestCaseRow[] = []

    if (store.isReady()) {
      const qv = await embedText(question)
      const hits = store.search(qv, 10)
      context = hits.map((h: any) => h.doc?.meta).filter(Boolean)
    }

    setAskProgress(35)

    if (!context.length) context = (clusters[0] || []).slice(0, 10).map((x: any) => x.meta)
    if (!context.length) context = rows.slice(0, 10)

    setAskProgress(60)

    if (!isReasoningReady()) {
      setLlmStatus('Starting local LLM for Copilot...')
      try {
        const llmMode = await initReasoningEngine()
        setLlmStatus(`Copilot mode: ${llmMode}`)
      } catch (err: any) {
        setAskProgress(100)
        setAnswer(`Copilot unavailable on this device/browser. Semantic KPIs still work.\n\nReason: ${String(err?.message || err)}`)
        setIsAsking(false)
        setAskProgress(0)
        return
      }
    }

    setAskProgress(78)

    try {
      const res = await askCopilot(question, context)
      setAskProgress(100)
      setAnswer(res)
    } catch (err: any) {
      setAskProgress(100)
      setAnswer(String(err?.message || err))
    } finally {
      setTimeout(() => {
        setIsAsking(false)
        setAskProgress(0)
      }, 250)
    }
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
      <h1 style={{ marginTop: 0, marginBottom: 6, fontSize: 34 }}>Test Case Intelligence Platform</h1>
      <p style={{ marginTop: 0, color: '#abc0ea', maxWidth: 980 }}>
        Upload or generate test cases, analyze quality KPIs, build semantic clusters, and ask Copilot for actionable guidance.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={onGenerate} style={btn('#2a6cff')}>Generate 10,000 High-Quality Tests</button>
        <label style={{ ...btn('#1a315e'), border: '1px solid #3a5388' }}>Upload JSON/CSV<input type="file" accept="application/json,text/csv,.csv" onChange={onUpload} style={{ display: 'none' }} /></label>
        <button onClick={() => downloadJson(rows)} disabled={!rows.length} style={btn('#245f4a', !rows.length)}>Export Generated Tests</button>

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
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', border: '1px solid #324978', borderRadius: 999, background: '#111c34', color: '#c7d8fa', fontSize: 12 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: runtimeMode.startsWith('webgpu') ? '#39d98a' : runtimeMode.startsWith('cpu-wasm') ? '#f0c14b' : '#f36f6f' }} />
        Copilot Runtime: {runtimeMode}
      </div>
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

      <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="Semantic Cluster Map" onInfo={() => setPopup({ title: 'Semantic Cluster Map', body: CHART_HELP['Semantic Cluster Map'] })}>
          <ReactECharts option={clusterChartOption} style={{ height: 320 }} />
        </Panel>
        <Panel title="Suite Distribution (DuckDB)" onInfo={() => setPopup({ title: 'Suite Distribution (DuckDB)', body: CHART_HELP['Suite Distribution (DuckDB)'] })}>
          <ReactECharts option={suiteChartOption} style={{ height: 320 }} />
        </Panel>
      </section>

      <Panel title="Sample Generated Test Cases" style={{ marginTop: 16 }}>
        <div style={{ maxHeight: 220, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#9fb2df' }}>
                <th style={th}>ID</th><th style={th}>Title</th><th style={th}>Suite</th><th style={th}>Tags</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.test_case_id}><td style={td}>{r.test_case_id}</td><td style={td}>{r.title}</td><td style={td}>{r.test_suite_id}</td><td style={td}>{(r.tags || []).join(', ')}</td></tr>
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
        </div>

        {isAsking && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, color: '#9fb2df', marginBottom: 5 }}>Processing with local LLM...</div>
            <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#1b2a47', border: '1px solid #324978', overflow: 'hidden' }}>
              <div style={{ width: `${askProgress}%`, height: '100%', background: 'linear-gradient(90deg,#7c5cff,#4ad0ff)' }} />
            </div>
          </div>
        )}

        <pre style={{ marginTop: 10, background: '#0b1220', border: '1px solid #324978', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', color: '#c9d7f8' }}>{answer || (isAsking ? 'Working on your question...' : 'No response yet.')}</pre>
      </Panel>

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

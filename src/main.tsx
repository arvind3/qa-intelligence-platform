import React, { useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactECharts from 'echarts-for-react'
import Papa from 'papaparse'
import { computeKpis } from './analytics'
import { askCopilot, initReasoningEngine } from './copilot'
import { loadTestsToDuckDB, queryDashboardStats } from './duckdb'
import { initEmbeddingModel, embedText } from './embeddings'
import { generateSyntheticTests } from './synthetic'
import type { TestCaseRow } from './types'
import { clusterByThreshold } from './vector'
import { SqliteVecStore } from './sqliteVecStore'

const store = new SqliteVecStore()

const KPI_HELP: Record<string, string> = {
  'Total Tests': 'Total number of test cases currently loaded.',
  'Exact Duplicate Groups': 'Identical tests (same title + description + steps).',
  'Near Duplicate Groups': 'Semantically similar tests that likely overlap in intent.',
  'Redundancy Score': 'Higher means more repeated coverage and better consolidation opportunity.',
  'Entropy Score': 'Higher means better diversity of test intent across features.',
  'Orphan Tag Ratio': 'Share of tests with missing or inconsistent tags.',
}

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

function downloadJson(rows: TestCaseRow[]) {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `generated_testcases_${rows.length}.json`
  a.click()
  URL.revokeObjectURL(url)
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
  const [openHelp, setOpenHelp] = useState<string | null>(null)
  const [isBuildingSemantic, setIsBuildingSemantic] = useState(false)
  const [buildMode, setBuildMode] = useState<'quick' | 'full'>('quick')
  const [buildProgress, setBuildProgress] = useState(0)
  const cancelBuildRef = useRef(false)

  const kpis = useMemo(() => computeKpis(rows), [rows])

  const kpiItems = [
    { label: 'Total Tests', value: kpis.totalTests.toLocaleString() },
    { label: 'Exact Duplicate Groups', value: kpis.exactDuplicateGroups },
    { label: 'Near Duplicate Groups', value: kpis.nearDuplicateGroups },
    { label: 'Redundancy Score', value: `${kpis.redundancyScore}%` },
    { label: 'Entropy Score', value: `${kpis.entropyScore}%` },
    { label: 'Orphan Tag Ratio', value: `${kpis.orphanTagRatio}%` },
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
    cancelBuildRef.current = false
    setBuildProgress(0)

    const targetRows = buildMode === 'quick' ? rows.slice(0, Math.min(rows.length, 2000)) : rows
    setEmbStatus(`Initializing embedding + sqlite-vec index (${buildMode.toUpperCase()} mode, ${targetRows.length.toLocaleString()} tests)...`)

    const mode = await initEmbeddingModel()
    const vectors: any[] = []
    const chunkSize = buildMode === 'quick' ? 120 : 80

    for (let i = 0; i < targetRows.length; i += chunkSize) {
      if (cancelBuildRef.current) {
        setEmbStatus(`Semantic build cancelled at ${buildProgress}%`) 
        setIsBuildingSemantic(false)
        return
      }
      const batch = targetRows.slice(i, i + chunkSize)
      const batchVecs = await Promise.all(
        batch.map(async (row) => {
          const text = `${row.title}. ${row.description}. Steps: ${row.steps}. Tags: ${(row.tags || []).join(', ')}`
          const vec = await embedText(text)
          return { id: row.test_case_id, text, vec, meta: row }
        }),
      )
      vectors.push(...batchVecs)
      const pct = Math.round((vectors.length / targetRows.length) * 100)
      setBuildProgress(pct)
      setEmbStatus(`Embedding progress: ${pct}% (${vectors.length.toLocaleString()}/${targetRows.length.toLocaleString()})`)
      await new Promise((r) => setTimeout(r, 0))
    }

    const vecReady = await store.init()
    let indexMode = 'in-memory fallback'
    if (vecReady) {
      await store.upsert(vectors)
      indexMode = 'sqlite-vec/zvec'
    }

    const c = clusterByThreshold(vectors, 0.9)
    setClusters(c)
    setEmbStatus(`Embeddings ready (${mode}) · index: ${indexMode} · ${vectors.length.toLocaleString()} vectors · ${c.length} clusters`)
    setIsBuildingSemantic(false)
  }

  const onCancelSemanticBuild = () => {
    cancelBuildRef.current = true
  }

  const onInitLlm = async () => {
    setLlmStatus('Initializing QA Copilot...')
    setLlmStatus(`Copilot mode: ${await initReasoningEngine()}`)
  }

  const onAsk = async () => {
    let context: TestCaseRow[] = []

    if (store.isReady()) {
      const qv = await embedText(question)
      const hits = store.search(qv, 10)
      context = hits.map((h: any) => h.doc?.meta).filter(Boolean)
    }

    if (!context.length) context = (clusters[0] || []).slice(0, 10).map((x: any) => x.meta)
    if (!context.length) context = rows.slice(0, 10)

    setAnswer(await askCopilot(question, context))
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
        <button onClick={onInitLlm} style={btn('#6f51ff')}>Initialize QA Copilot</button>
      </div>

      <div style={{ color: '#95aedf', marginBottom: 4 }}>{status}</div>
      <div style={{ color: '#95aedf', marginBottom: 4 }}>{embStatus}</div>
      {isBuildingSemantic && (
        <div style={{ marginBottom: 10, width: '100%', maxWidth: 560, height: 10, background: '#1a2742', borderRadius: 999, overflow: 'hidden', border: '1px solid #324978' }}>
          <div style={{ width: `${buildProgress}%`, height: '100%', background: 'linear-gradient(90deg,#2ccf8f,#4ad0ff)' }} />
        </div>
      )}
      <div style={{ color: '#95aedf', marginBottom: 14 }}>{llmStatus}</div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {kpiItems.map((k) => (
          <div key={k.label} style={{ background: 'linear-gradient(165deg, #121d34, #101a2f)', border: '1px solid #30446f', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#a8bce8', fontSize: 12, fontWeight: 700 }}>{k.label}</div>
              <button onClick={() => setOpenHelp(openHelp === k.label ? null : k.label)} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #4a6396', background: '#1a2b4f', color: '#d8e6ff', cursor: 'pointer', fontWeight: 700 }}>i</button>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{k.value}</div>
            {openHelp === k.label && <div style={{ marginTop: 8, fontSize: 12, color: '#bdd0f7', background: '#0b1530', border: '1px solid #2f446f', borderRadius: 10, padding: 10 }}>{KPI_HELP[k.label]}</div>}
          </div>
        ))}
      </section>

      <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel title="Semantic Cluster Map"><ReactECharts option={clusterChartOption} style={{ height: 320 }} /></Panel>
        <Panel title="Suite Distribution (DuckDB)"><ReactECharts option={suiteChartOption} style={{ height: 320 }} /></Panel>
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
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #324978', background: '#0b1220', color: '#e8f0ff' }} />
          <button onClick={onAsk} style={btn('#2a6cff')}>Ask</button>
        </div>
        <pre style={{ marginTop: 10, background: '#0b1220', border: '1px solid #324978', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', color: '#c9d7f8' }}>{answer || 'No response yet.'}</pre>
      </Panel>
    </main>
  )
}

function Panel({ title, children, style = {} as React.CSSProperties }: any) {
  return <section style={{ background: '#121a2d', border: '1px solid #2a3b62', borderRadius: 12, padding: 12, ...style }}><h3 style={{ marginTop: 0 }}>{title}</h3>{children}</section>
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid #273b62' }
const td: React.CSSProperties = { padding: '8px 6px', borderBottom: '1px solid #1a2d50', color: '#c9d7f8' }
const btn = (bg: string, disabled = false): React.CSSProperties => ({ background: bg, color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1 })

createRoot(document.getElementById('root')!).render(<App />)

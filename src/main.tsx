import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import ReactECharts from 'echarts-for-react'
import Papa from 'papaparse'
import { computeKpis } from './analytics'
import { askCopilot, initReasoningEngine } from './copilot'
import { loadTestsToDuckDB, queryDashboardStats } from './duckdb'
import { embedTests, initEmbeddingModel } from './embeddings'
import { generateSyntheticTests } from './synthetic'
import type { TestCaseRow } from './types'
import { clusterByThreshold, LocalVectorStore } from './vector'

const store = new LocalVectorStore()

const KPI_HELP: Record<string, string> = {
  'Total Tests': 'Total number of test cases currently loaded into the platform.',
  'Exact Duplicate Groups': 'Groups of test cases that are exactly the same in title, description, and steps.',
  'Near Duplicate Groups': 'Groups of test cases that are very similar in meaning but not exact text copies.',
  'Redundancy Score': 'Higher score means more repeated test intent across the suite (more cleanup opportunity).',
  'Entropy Score': 'Higher score means better diversity across features and test intent (healthier suite spread).',
  'Orphan Tag Ratio': 'Percentage of tests with missing/inconsistent tags, which hurts discoverability and governance.',
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

function KpiCard({ label, value, help, open, onToggle }: { label: string; value: string | number; help: string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ background: 'linear-gradient(165deg, #121d34, #101a2f)', border: '1px solid #30446f', borderRadius: 14, padding: 14, position: 'relative', boxShadow: '0 10px 26px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#a8bce8', fontSize: 12, fontWeight: 700, letterSpacing: '.02em' }}>{label}</div>
        <button onClick={onToggle} aria-label={`Explain ${label}`} style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #4a6396', background: '#1a2b4f', color: '#d8e6ff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>i</button>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>{value}</div>
      {open && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#bdd0f7', background: '#0b1530', border: '1px solid #2f446f', borderRadius: 10, padding: 10 }}>
          {help}
        </div>
      )}
    </div>
  )
}

function App() {
  const [rows, setRows] = useState<TestCaseRow[]>([])
  const [status, setStatus] = useState('No dataset loaded')
  const [embStatus, setEmbStatus] = useState('idle')
  const [llmStatus, setLlmStatus] = useState('idle')
  const [clusters, setClusters] = useState<any[]>([])
  const [suiteDist, setSuiteDist] = useState<any[]>([])
  const [question, setQuestion] = useState('What duplicates should be consolidated first?')
  const [answer, setAnswer] = useState('')
  const [openHelp, setOpenHelp] = useState<string | null>(null)

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
    const points = clusters.slice(0, 20).map((c: any, i: number) => [i, c.length, c[0]?.meta?.title || ''])
    return {
      backgroundColor: 'transparent',
      xAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Cluster Index', nameTextStyle: { color: '#8ca4d4' } },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' }, name: 'Cluster Size', nameTextStyle: { color: '#8ca4d4' } },
      tooltip: { formatter: (p: any) => `Cluster ${p.data[0]}<br/>Size: ${p.data[1]}<br/>${p.data[2]}` },
      series: [{ type: 'scatter', symbolSize: (v: any) => Math.max(10, Math.min(42, v[1] * 1.2)), data: points, itemStyle: { color: '#56d9ff' } }],
    }
  }, [clusters])

  const suiteChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      xAxis: { type: 'category', data: suiteDist.map((r: any) => r.test_suite_id), axisLabel: { color: '#a4bbec' } },
      yAxis: { type: 'value', axisLabel: { color: '#a4bbec' } },
      series: [{ type: 'bar', data: suiteDist.map((r: any) => Number(r.c)), itemStyle: { color: '#6d8eff' }, barMaxWidth: 28 }],
    }),
    [suiteDist],
  )

  const loadRows = async (data: TestCaseRow[], source: string) => {
    setRows(data)
    setStatus(`Loaded ${data.length.toLocaleString()} tests from ${source}`)
    await loadTestsToDuckDB(data)
    const stats = await queryDashboardStats()
    setSuiteDist(stats.suiteDist)
  }

  const onGenerate = async () => loadRows(generateSyntheticTests(10000), 'synthetic generator')

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = file.name.endsWith('.csv') ? parseCsv(text) : parseJson(text)
      await loadRows(parsed, file.name)
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`)
    }
  }

  const onBuildSemantic = async () => {
    if (!rows.length) return
    setEmbStatus('initializing embedding model...')
    const mode = await initEmbeddingModel()
    setEmbStatus(`embedding mode: ${mode}; embedding ${rows.length.toLocaleString()} tests...`)
    const vectors = await embedTests(rows)
    store.upsert(vectors)
    const c = clusterByThreshold(vectors, 0.9)
    setClusters(c)
    setEmbStatus(`done: ${vectors.length.toLocaleString()} vectors, ${c.length} semantic clusters`)
  }

  const onInitLlm = async () => {
    setLlmStatus('initializing reasoning engine...')
    const mode = await initReasoningEngine()
    setLlmStatus(`reasoning mode: ${mode}`)
  }

  const onAsk = async () => {
    const context = (clusters[0] || []).slice(0, 10).map((x: any) => x.meta)
    setAnswer(await askCopilot(question, context.length ? context : rows.slice(0, 10)))
  }

  return (
    <main style={{ fontFamily: 'Segoe UI Variable, Segoe UI, sans-serif', padding: 24, background: 'radial-gradient(circle at 10% 0%, #13244d, #0b1220 42%)', color: '#e8f0ff', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0, fontSize: 34 }}>Test Case Intelligence Platform</h1>
      <p style={{ color: '#a7bde9', maxWidth: 980, marginTop: -4 }}>
        Browser-only QA intelligence platform with KPI storytelling, semantic understanding, and local reasoning.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={onGenerate} style={{ background: '#2a6cff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Generate 10,000 Synthetic Tests</button>
        <label style={{ border: '1px solid #3a5388', borderRadius: 10, padding: '10px 14px', cursor: 'pointer', background: '#132346' }}>Upload JSON/CSV<input type="file" accept="application/json,text/csv,.csv" onChange={onUpload} style={{ display: 'none' }} /></label>
        <button onClick={onBuildSemantic} style={{ background: '#11856b', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Build Embeddings + Clusters</button>
        <button onClick={onInitLlm} style={{ background: '#6f51ff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Initialize QA Copilot Engine</button>
      </div>

      <div style={{ color: '#95aedf', marginBottom: 8 }}>{status}</div>
      <div style={{ color: '#95aedf', marginBottom: 6 }}>{embStatus}</div>
      <div style={{ color: '#95aedf', marginBottom: 16 }}>{llmStatus}</div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: 12 }}>
        {kpiItems.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} help={KPI_HELP[k.label]} open={openHelp === k.label} onToggle={() => setOpenHelp(openHelp === k.label ? null : k.label)} />
        ))}
      </section>

      <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ background: '#121a2d', border: '1px solid #2a3b62', borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Semantic Cluster Map</h3>
          <ReactECharts option={clusterChartOption} style={{ height: 320 }} />
        </div>
        <div style={{ background: '#121a2d', border: '1px solid #2a3b62', borderRadius: 12, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Suite Distribution (DuckDB)</h3>
          <ReactECharts option={suiteChartOption} style={{ height: 320 }} />
        </div>
      </section>

      <section style={{ marginTop: 16, background: '#121a2d', border: '1px solid #2a3b62', borderRadius: 12, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>QA Copilot</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #324978', background: '#0b1220', color: '#e8f0ff' }} />
          <button onClick={onAsk} style={{ background: '#2a6cff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Ask</button>
        </div>
        <pre style={{ marginTop: 10, background: '#0b1220', border: '1px solid #324978', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', color: '#c9d7f8' }}>{answer || 'No response yet.'}</pre>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

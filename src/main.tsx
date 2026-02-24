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

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#141d33', border: '1px solid #2a3a65', borderRadius: 12, padding: 14 }}>
      <div style={{ color: '#9fb2df', fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>
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

  const kpis = useMemo(() => computeKpis(rows), [rows])

  const clusterChartOption = useMemo(() => {
    const points = clusters.slice(0, 20).map((c: any, i: number) => [i, c.length, c[0]?.meta?.title || ''])
    return {
      backgroundColor: 'transparent',
      xAxis: { type: 'value', axisLabel: { color: '#9fb2df' } },
      yAxis: { type: 'value', axisLabel: { color: '#9fb2df' } },
      tooltip: {
        formatter: (p: any) => `Cluster ${p.data[0]}<br/>Size: ${p.data[1]}<br/>${p.data[2]}`,
      },
      series: [{
        type: 'scatter',
        symbolSize: (v: any) => Math.max(10, Math.min(40, v[1] * 1.2)),
        data: points,
        itemStyle: { color: '#55d7ff' },
      }],
    }
  }, [clusters])

  const suiteChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    xAxis: { type: 'category', data: suiteDist.map((r: any) => r.test_suite_id), axisLabel: { color: '#9fb2df' } },
    yAxis: { type: 'value', axisLabel: { color: '#9fb2df' } },
    series: [{ type: 'bar', data: suiteDist.map((r: any) => Number(r.c)), itemStyle: { color: '#6c8cff' } }],
  }), [suiteDist])

  const loadRows = async (data: TestCaseRow[], source: string) => {
    setRows(data)
    setStatus(`Loaded ${data.length.toLocaleString()} tests from ${source}`)
    await loadTestsToDuckDB(data)
    const stats = await queryDashboardStats()
    setSuiteDist(stats.suiteDist)
  }

  const onGenerate = async () => {
    const generated = generateSyntheticTests(10000)
    await loadRows(generated, 'synthetic generator')
  }

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
    const res = await askCopilot(question, context.length ? context : rows.slice(0, 10))
    setAnswer(res)
  }

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', padding: 24, background: '#0b1220', color: '#e8f0ff', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>Test Case Intelligence Platform</h1>
      <p style={{ color: '#9db0da', maxWidth: 980 }}>
        Browser-only QA intelligence platform: DuckDB analytics + semantic vector understanding + local reasoning.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={onGenerate} style={{ background: '#2a6cff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
          Generate 10,000 Synthetic Tests
        </button>
        <label style={{ border: '1px solid #324978', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
          Upload JSON/CSV
          <input type="file" accept="application/json,text/csv,.csv" onChange={onUpload} style={{ display: 'none' }} />
        </label>
        <button onClick={onBuildSemantic} style={{ background: '#0f8f6f', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
          Build Embeddings + Semantic Clusters
        </button>
        <button onClick={onInitLlm} style={{ background: '#6f51ff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
          Init Qwen Reasoning Engine
        </button>
      </div>

      <div style={{ color: '#8fa6d8', marginBottom: 16 }}>{status}</div>
      <div style={{ color: '#8fa6d8', marginBottom: 16 }}>{embStatus}</div>
      <div style={{ color: '#8fa6d8', marginBottom: 16 }}>{llmStatus}</div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <Card label="Total Tests" value={kpis.totalTests.toLocaleString()} />
        <Card label="Exact Duplicate Groups" value={kpis.exactDuplicateGroups} />
        <Card label="Near Duplicate Groups" value={kpis.nearDuplicateGroups} />
        <Card label="Redundancy Score" value={`${kpis.redundancyScore}%`} />
        <Card label="Entropy Score" value={`${kpis.entropyScore}%`} />
        <Card label="Orphan Tag Ratio" value={`${kpis.orphanTagRatio}%`} />
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
        <h3 style={{ marginTop: 0 }}>QA Copilot (RAG-style local reasoning)</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #324978', background: '#0b1220', color: '#e8f0ff' }} />
          <button onClick={onAsk} style={{ background: '#2a6cff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>Ask</button>
        </div>
        <pre style={{ marginTop: 10, background: '#0b1220', border: '1px solid #324978', borderRadius: 8, padding: 10, whiteSpace: 'pre-wrap', color: '#c9d7f8' }}>
          {answer || 'No response yet.'}
        </pre>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

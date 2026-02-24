import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { computeKpis, topFamilyGroups } from './analytics'
import { generateSyntheticTests } from './synthetic'
import type { TestCaseRow } from './types'

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

  const kpis = useMemo(() => computeKpis(rows), [rows])
  const families = useMemo(() => topFamilyGroups(rows), [rows])

  const onGenerate = () => {
    const generated = generateSyntheticTests(10000)
    setRows(generated)
    setStatus(`Generated ${generated.length.toLocaleString()} synthetic Azure DevOps-style tests`)
  }

  const onUpload: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed = parseJson(text)
      setRows(parsed)
      setStatus(`Loaded ${parsed.length.toLocaleString()} tests from ${file.name}`)
    } catch (err) {
      setStatus(`Upload failed: ${(err as Error).message}`)
    }
  }

  return (
    <main style={{ fontFamily: 'Segoe UI, sans-serif', padding: 24, background: '#0b1220', color: '#e8f0ff', minHeight: '100vh' }}>
      <h1 style={{ marginTop: 0 }}>Test Case Intelligence Platform</h1>
      <p style={{ color: '#9db0da', maxWidth: 900 }}>
        Browser-only MVP for semantic QA analytics. Upload Azure DevOps-style test case metadata or generate synthetic 10k data.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <button onClick={onGenerate} style={{ background: '#2a6cff', color: '#fff', border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}>
          Generate 10,000 Synthetic Tests
        </button>
        <label style={{ border: '1px solid #324978', borderRadius: 10, padding: '10px 14px', cursor: 'pointer' }}>
          Upload JSON
          <input type="file" accept="application/json" onChange={onUpload} style={{ display: 'none' }} />
        </label>
        <span style={{ color: '#8fa6d8' }}>{status}</span>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <Card label="Total Tests" value={kpis.totalTests.toLocaleString()} />
        <Card label="Exact Duplicate Groups" value={kpis.exactDuplicateGroups} />
        <Card label="Near Duplicate Groups" value={kpis.nearDuplicateGroups} />
        <Card label="Redundancy Score" value={`${kpis.redundancyScore}%`} />
        <Card label="Entropy Score" value={`${kpis.entropyScore}%`} />
        <Card label="Orphan Tag Ratio" value={`${kpis.orphanTagRatio}%`} />
      </section>

      <section style={{ marginTop: 22, background: '#121a2d', border: '1px solid #2a3b62', borderRadius: 12, padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Top Semantic Family Groups</h3>
        {families.length === 0 ? (
          <p style={{ color: '#9db0da' }}>Load data to compute family grouping.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#8fa6d8', borderBottom: '1px solid #2a3b62', paddingBottom: 8 }}>Family Signature</th>
                <th style={{ textAlign: 'right', color: '#8fa6d8', borderBottom: '1px solid #2a3b62', paddingBottom: 8 }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {families.map(([name, count]) => (
                <tr key={name}>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #1f2c4a' }}>{name}</td>
                  <td style={{ textAlign: 'right', borderBottom: '1px solid #1f2c4a' }}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 18, color: '#8fa6d8', fontSize: 13 }}>
        Next integration: DuckDB-WASM tables + Zvec vector store adapter + Qwen reasoning panel.
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

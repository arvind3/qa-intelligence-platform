import React from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <main style={{fontFamily:'Segoe UI, sans-serif', padding: 24, background:'#0b1220', color:'#e8f0ff', minHeight:'100vh'}}>
      <h1>Test Case Intelligence Platform</h1>
      <p>MVP bootstrapped. Next: upload, embeddings, clustering, KPIs.</p>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<App />)

import type { TestCaseRow } from './types'

let extractor: any | null = null

function hashEmbedding(text: string, dim = 128) {
  const vec = new Array(dim).fill(0)
  const words = text.toLowerCase().split(/\s+/)
  for (const w of words) {
    let h = 2166136261
    for (let i = 0; i < w.length; i++) h = (h ^ w.charCodeAt(i)) * 16777619
    const idx = Math.abs(h) % dim
    vec[idx] += 1
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1
  return vec.map((v) => v / norm)
}

export async function initEmbeddingModel() {
  if (extractor) return 'transformers-ready'
  try {
    const mod = await import('@huggingface/transformers')
    extractor = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    return 'transformers-ready'
  } catch {
    return 'fallback-hash'
  }
}

export async function embedText(text: string): Promise<number[]> {
  if (!extractor) return hashEmbedding(text)
  try {
    const out = await extractor(text, { pooling: 'mean', normalize: true })
    return Array.from(out.data as Float32Array)
  } catch {
    return hashEmbedding(text)
  }
}

export async function embedTests(rows: TestCaseRow[]) {
  const vectors: { id: string; text: string; vec: number[]; meta: TestCaseRow }[] = []
  for (const row of rows) {
    const text = `${row.title}. ${row.description}. Steps: ${row.steps}. Tags: ${(row.tags || []).join(', ')}`
    const vec = await embedText(text)
    vectors.push({ id: row.test_case_id, text, vec, meta: row })
  }
  return vectors
}

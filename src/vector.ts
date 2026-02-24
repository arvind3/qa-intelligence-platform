import type { TestCaseRow } from './types'

export type VectorDoc = {
  id: string
  text: string
  vec: number[]
  meta: TestCaseRow
}

// Zvec-style adapter interface (browser local).
export class LocalVectorStore {
  private docs: VectorDoc[] = []

  upsert(items: VectorDoc[]) {
    this.docs = items
  }

  all() {
    return this.docs
  }

  search(vec: number[], k = 8) {
    const scored = this.docs
      .map((d) => ({ doc: d, score: cosine(vec, d.vec) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
    return scored
  }
}

export function cosine(a: number[], b: number[]) {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9)
}

export function clusterByThreshold(items: VectorDoc[], threshold = 0.89) {
  const visited = new Set<string>()
  const clusters: VectorDoc[][] = []

  for (const item of items) {
    if (visited.has(item.id)) continue
    const c = [item]
    visited.add(item.id)

    for (const other of items) {
      if (visited.has(other.id)) continue
      if (cosine(item.vec, other.vec) >= threshold) {
        visited.add(other.id)
        c.push(other)
      }
    }

    clusters.push(c)
  }

  return clusters.sort((a, b) => b.length - a.length)
}

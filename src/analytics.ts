import { QAKpis, TestCaseRow } from './types'

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function hashKey(t: TestCaseRow) {
  return normalize(`${t.title} ${t.description} ${t.steps}`)
}

function jaccard(a: Set<string>, b: Set<string>) {
  const i = [...a].filter((x) => b.has(x)).length
  const u = new Set([...a, ...b]).size
  return u ? i / u : 0
}

export function computeKpis(rows: TestCaseRow[]): QAKpis {
  if (!rows.length) {
    return {
      totalTests: 0,
      exactDuplicateGroups: 0,
      nearDuplicateGroups: 0,
      redundancyScore: 0,
      entropyScore: 0,
      orphanTagRatio: 0,
    }
  }

  const hashMap = new Map<string, number>()
  const tokenSets = rows.map((r) => new Set(normalize(`${r.title} ${r.description}`).split(' ')))

  rows.forEach((r) => {
    const key = hashKey(r)
    hashMap.set(key, (hashMap.get(key) || 0) + 1)
  })

  const exactDuplicateGroups = [...hashMap.values()].filter((c) => c > 1).length

  // Lightweight near-duplicate grouping using bucketing + Jaccard checks
  const buckets = new Map<string, number[]>()
  rows.forEach((r, i) => {
    const toks = normalize(`${r.title} ${r.description}`).split(' ').slice(0, 5).join('|')
    if (!buckets.has(toks)) buckets.set(toks, [])
    buckets.get(toks)!.push(i)
  })

  let nearDuplicateGroups = 0
  let nearMembers = 0
  for (const indices of buckets.values()) {
    if (indices.length < 2) continue
    let groupHasNear = false
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        if (jaccard(tokenSets[indices[i]], tokenSets[indices[j]]) > 0.72) {
          groupHasNear = true
          nearMembers += 2
          break
        }
      }
      if (groupHasNear) break
    }
    if (groupHasNear) nearDuplicateGroups++
  }

  const duplicateMembers = [...hashMap.values()].filter((c) => c > 1).reduce((a, b) => a + b, 0)
  const redundancyScore = Math.min(100, ((duplicateMembers + nearMembers) / rows.length) * 100)

  const featureCounts = new Map<string, number>()
  rows.forEach((r) => {
    const feature = r.title.split(':')[0] || 'unknown'
    featureCounts.set(feature, (featureCounts.get(feature) || 0) + 1)
  })
  const probs = [...featureCounts.values()].map((c) => c / rows.length)
  const entropy = -probs.reduce((sum, p) => sum + p * Math.log2(p), 0)
  const maxEntropy = Math.log2(Math.max(featureCounts.size, 2))
  const entropyScore = (entropy / maxEntropy) * 100

  const orphanTagRatio =
    (rows.filter((r) => !r.tags?.length || r.tags.some((t) => t !== t.toLowerCase())).length / rows.length) * 100

  return {
    totalTests: rows.length,
    exactDuplicateGroups,
    nearDuplicateGroups,
    redundancyScore: Number(redundancyScore.toFixed(1)),
    entropyScore: Number(entropyScore.toFixed(1)),
    orphanTagRatio: Number(orphanTagRatio.toFixed(1)),
  }
}

export function topFamilyGroups(rows: TestCaseRow[]) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const key = normalize(r.title).split(' ').slice(0, 3).join(' ')
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
}

type BuildRequest = {
  type: 'build'
  rows: Array<{ id: string; text: string }>
  chunkSize: number
}

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

self.onmessage = (event: MessageEvent<BuildRequest>) => {
  const msg = event.data
  if (msg.type !== 'build') return

  const { rows, chunkSize } = msg
  const vectors: Array<{ id: string; text: string; vec: number[] }> = []

  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize)
    for (const r of batch) {
      vectors.push({ id: r.id, text: r.text, vec: hashEmbedding(r.text) })
    }
    const progress = Math.round((vectors.length / rows.length) * 100)
    ;(self as any).postMessage({ type: 'progress', progress, done: vectors.length, total: rows.length })
  }

  ;(self as any).postMessage({ type: 'done', vectors })
}

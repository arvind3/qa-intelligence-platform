import sqlite3InitModule from 'sqlite-vec-wasm/dist/sqlite3-bundler-friendly.mjs'
import sqliteWasmUrl from 'sqlite-vec-wasm/dist/sqlite3.wasm?url'
import type { TestCaseRow } from './types'

export type VectorDoc = {
  id: string
  text: string
  vec: number[]
  meta: TestCaseRow
}

function vecLiteral(v: number[]) {
  return `[${v.map((n) => Number(n).toFixed(6)).join(',')}]`
}

export class SqliteVecStore {
  private sqlite: any | null = null
  private db: any | null = null
  private docs: VectorDoc[] = []
  private dim = 0
  private ready = false

  async init() {
    if (this.ready) return true
    try {
      this.sqlite = await sqlite3InitModule({
        locateFile: (f: string) => (f.endsWith('.wasm') ? sqliteWasmUrl : f),
      })
      this.db = new this.sqlite.oo1.DB('/vec.db', 'ct')
      const v = this.db.exec({ sql: 'select vec_version() as v', rowMode: 'object', returnValue: 'resultRows' })
      this.ready = !!v?.[0]?.v
      return this.ready
    } catch {
      this.ready = false
      return false
    }
  }

  isReady() {
    return this.ready
  }

  async upsert(items: VectorDoc[]) {
    if (!this.ready || !this.db) return false
    this.docs = items
    this.dim = items[0]?.vec?.length || 0
    if (!this.dim) return false

    this.db.exec('DROP TABLE IF EXISTS vec_items;')
    this.db.exec(`CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[${this.dim}]);`)

    this.db.exec('BEGIN')
    for (let i = 0; i < items.length; i++) {
      const lit = vecLiteral(items[i].vec)
      this.db.exec(`INSERT INTO vec_items(rowid, embedding) VALUES (${i + 1}, '${lit}');`)
    }
    this.db.exec('COMMIT')
    return true
  }

  search(vec: number[], k = 8) {
    if (!this.ready || !this.db || !this.docs.length) return []
    const q = vecLiteral(vec)
    const rows = this.db.exec({
      sql: `SELECT rowid, distance FROM vec_items WHERE embedding MATCH '${q}' ORDER BY distance LIMIT ${k};`,
      rowMode: 'object',
      returnValue: 'resultRows',
    })

    return (rows || []).map((r: any) => {
      const idx = Number(r.rowid) - 1
      const doc = this.docs[idx]
      return { doc, score: 1 / (1 + Number(r.distance || 0)) }
    })
  }

  all() {
    return this.docs
  }
}

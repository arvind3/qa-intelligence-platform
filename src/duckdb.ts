import * as duckdb from '@duckdb/duckdb-wasm'
import type { TestCaseRow } from './types'

let db: duckdb.AsyncDuckDB | null = null

export async function getDb() {
  if (db) return db

  const bundles = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(bundles)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.ConsoleLogger()
  db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  return db
}

export async function loadTestsToDuckDB(rows: TestCaseRow[]) {
  const d = await getDb()
  const conn = await d.connect()

  await conn.query(`
    CREATE OR REPLACE TABLE tests (
      test_case_id VARCHAR,
      test_plan_id VARCHAR,
      test_suite_id VARCHAR,
      title VARCHAR,
      description VARCHAR,
      steps VARCHAR,
      tags VARCHAR,
      token_count INTEGER
    )
  `)

  const values = rows
    .map((r) => {
      const tags = (r.tags || []).join('|').replace(/'/g, "''")
      const title = r.title.replace(/'/g, "''")
      const description = r.description.replace(/'/g, "''")
      const steps = r.steps.replace(/'/g, "''")
      const tokenCount = `${r.title} ${r.description} ${r.steps}`.split(/\s+/).length
      return `('${r.test_case_id}','${r.test_plan_id}','${r.test_suite_id}','${title}','${description}','${steps}','${tags}',${tokenCount})`
    })
    .join(',')

  if (values.length) {
    await conn.query(`INSERT INTO tests VALUES ${values}`)
  }

  await conn.close()
}

export async function queryDashboardStats() {
  const d = await getDb()
  const conn = await d.connect()

  const counts = await conn.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(DISTINCT test_plan_id) AS plans,
      COUNT(DISTINCT test_suite_id) AS suites,
      AVG(token_count) AS avg_tokens
    FROM tests
  `)

  const suites = await conn.query(`
    SELECT test_suite_id, COUNT(*) AS c
    FROM tests
    GROUP BY test_suite_id
    ORDER BY c DESC
    LIMIT 12
  `)

  await conn.close()

  return {
    counts: counts.toArray()[0],
    suiteDist: suites.toArray(),
  }
}

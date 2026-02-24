import { TestCaseRow } from './types'

const FEATURES = [
  'Authentication',
  'Checkout',
  'Catalog',
  'Search',
  'Payments',
  'Orders',
  'Profile',
  'Notifications',
  'Admin',
  'Reporting',
  'Returns',
  'Inventory',
]

const SCENARIOS = ['happy path', 'negative path', 'edge case', 'permissions', 'recovery', 'validation']
const CHANNELS = ['web', 'mobile', 'api']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function mutateText(text: string) {
  const replacements: Record<string, string[]> = {
    validate: ['verify', 'confirm', 'check'],
    should: ['must', 'needs to', 'is expected to'],
    user: ['customer', 'buyer', 'operator'],
    error: ['failure', 'validation error', 'rejection'],
  }
  let out = text
  for (const [k, vals] of Object.entries(replacements)) {
    if (out.includes(k) && Math.random() < 0.55) out = out.replace(k, pick(vals))
  }
  return out
}

function createBaseCase(i: number): TestCaseRow {
  const feature = pick(FEATURES)
  const scenario = pick(SCENARIOS)
  const channel = pick(CHANNELS)
  const plan = `P-${(i % 9) + 1}`
  const suite = `S-${feature.slice(0, 3).toUpperCase()}-${(i % 12) + 1}`

  const title = `${feature}: ${scenario} on ${channel}`
  const description = `${feature} ${scenario} coverage to ensure business-critical behavior is stable for ${channel} interactions.`
  const stepsArr = [
    `Open ${feature} module on ${channel}`,
    `Execute ${scenario} workflow with representative data`,
    `Validate expected result and audit logs`,
  ]

  if (Math.random() < 0.35) stepsArr.push('Verify telemetry and event tracking consistency')
  if (Math.random() < 0.22) stepsArr.push('Validate rollback/retry behavior under transient failures')

  const weakTagChance = Math.random()
  const tags =
    weakTagChance < 0.08
      ? []
      : weakTagChance < 0.22
      ? [feature.toLowerCase(), 'Regression', 'regression']
      : [feature.toLowerCase(), scenario.replace(' ', '-'), channel, 'regression']

  return {
    test_case_id: `TC-${100000 + i}`,
    test_plan_id: plan,
    test_suite_id: suite,
    title,
    description,
    steps: stepsArr.join(' | '),
    tags,
  }
}

export function generateSyntheticTests(count = 10000): TestCaseRow[] {
  const rows = Array.from({ length: count }, (_, i) => createBaseCase(i))

  // 1) Exact duplicates (~9%)
  const exactCount = Math.floor(count * 0.09)
  for (let i = 0; i < exactCount; i++) {
    const src = rows[Math.floor(Math.random() * rows.length)]
    rows[i] = { ...src, test_case_id: `TC-EX-${i}` }
  }

  // 2) Near-duplicates (~18%)
  const nearStart = exactCount
  const nearEnd = nearStart + Math.floor(count * 0.18)
  for (let i = nearStart; i < nearEnd; i++) {
    const src = rows[Math.floor(Math.random() * rows.length)]
    rows[i] = {
      ...src,
      test_case_id: `TC-ND-${i}`,
      title: mutateText(src.title),
      description: mutateText(src.description),
      steps: `${mutateText(src.steps)} | Optional business assertion`,
    }
  }

  // 3) Parameterized family variants (~20%)
  const famStart = nearEnd
  const famEnd = famStart + Math.floor(count * 0.2)
  for (let i = famStart; i < famEnd; i++) {
    const src = rows[Math.floor(Math.random() * rows.length)]
    const locale = pick(['US', 'EU', 'IN', 'APAC'])
    const persona = pick(['guest', 'new-user', 'power-user', 'admin'])
    rows[i] = {
      ...src,
      test_case_id: `TC-FAM-${i}`,
      title: `${src.title} [${locale}/${persona}]`,
      description: `${src.description} Parameterization: locale=${locale}, persona=${persona}.`,
      tags: [...new Set([...(src.tags || []), locale.toLowerCase(), persona])],
    }
  }

  return rows
}

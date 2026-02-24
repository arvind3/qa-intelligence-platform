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
]

const ACTIONS = ['validate', 'verify', 'ensure', 'check', 'confirm']
const ENTITIES = ['workflow', 'form', 'response', 'state', 'permission', 'session']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sentence(feature: string) {
  return `${pick(ACTIONS)} ${feature.toLowerCase()} ${pick(ENTITIES)} behavior under expected conditions`
}

function buildBase(i: number): TestCaseRow {
  const feature = pick(FEATURES)
  const suite = `S-${(i % 25) + 1}`
  const plan = `P-${(i % 8) + 1}`
  const title = `${feature}: ${sentence(feature)}`
  const steps = [
    `Open ${feature} module`,
    'Perform primary user action',
    'Validate expected result',
  ].join(' | ')

  const weakTagChance = Math.random()
  const tags =
    weakTagChance < 0.1
      ? []
      : weakTagChance < 0.25
      ? [feature.toLowerCase(), 'smoke', 'SMOKE']
      : [feature.toLowerCase(), 'regression']

  return {
    test_case_id: `TC-${100000 + i}`,
    test_plan_id: plan,
    test_suite_id: suite,
    title,
    description: `${feature} scenario coverage for enterprise QA intelligence benchmarking.`,
    steps,
    tags,
  }
}

export function generateSyntheticTests(count = 10000): TestCaseRow[] {
  const rows: TestCaseRow[] = []

  for (let i = 0; i < count; i++) {
    rows.push(buildBase(i))
  }

  // Inject exact duplicates (~10%)
  const exactCount = Math.floor(count * 0.1)
  for (let i = 0; i < exactCount; i++) {
    const src = rows[Math.floor(Math.random() * rows.length)]
    rows[i] = { ...src, test_case_id: `TC-EX-${i}` }
  }

  // Inject near duplicates (~20%)
  const nearStart = exactCount
  const nearEnd = nearStart + Math.floor(count * 0.2)
  for (let i = nearStart; i < nearEnd; i++) {
    const src = rows[Math.floor(Math.random() * rows.length)]
    rows[i] = {
      ...src,
      test_case_id: `TC-ND-${i}`,
      title: src.title.replace('validate', pick(['verify', 'confirm', 'check'])),
      steps: `${src.steps} | Optional edge assertion`,
    }
  }

  return rows
}

export type TestCaseRow = {
  test_case_id: string
  test_plan_id: string
  test_suite_id: string
  title: string
  description: string
  steps: string
  tags: string[]
}

export type QAKpis = {
  totalTests: number
  exactDuplicateGroups: number
  nearDuplicateGroups: number
  redundancyScore: number
  entropyScore: number
  orphanTagRatio: number
}

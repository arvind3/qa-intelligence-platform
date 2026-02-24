import { describe, expect, it } from 'vitest'
import { askCopilot } from '../../src/copilot'

const context = [
  {
    test_case_id: 'TC-1', test_plan_id: 'P-1', test_suite_id: 'S-1',
    title: 'Auth: validate duplicate account prevention',
    description: 'Ensure duplicate user registration is rejected',
    steps: 'Open auth | submit duplicate | assert error',
    tags: ['auth', 'negative']
  }
]

describe('LLM evaluation strategy (evil/eval)', () => {
  it('returns actionable duplicate guidance', async () => {
    const q = 'Find duplicate tests and suggest consolidation'
    const answer = await askCopilot(q, context as any)
    expect(answer.toLowerCase()).toContain('duplicate')
  })

  it('returns coverage guidance for gap question', async () => {
    const q = 'Where is our coverage gap?'
    const answer = await askCopilot(q, context as any)
    expect(answer.toLowerCase()).toContain('coverage')
  })
})

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
  it('enforces local LLM initialization before answering', async () => {
    await expect(askCopilot('Find duplicate tests and suggest consolidation', context as any))
      .rejects.toThrow(/copilot-not-initialized/i)
  })

  it('documents no-template-fallback policy', async () => {
    await expect(askCopilot('Where is our coverage gap?', context as any))
      .rejects.toThrow(/local in-browser LLM required/i)
  })
})

import { describe, expect, it } from 'vitest'
import { computeKpis } from '../../src/analytics'
import { generateSyntheticTests } from '../../src/synthetic'

describe('analytics', () => {
  it('computes KPIs for synthetic dataset', () => {
    const data = generateSyntheticTests(1000)
    const k = computeKpis(data)
    expect(k.totalTests).toBe(1000)
    expect(k.redundancyScore).toBeGreaterThan(0)
    expect(k.entropyScore).toBeGreaterThan(0)
  })
})

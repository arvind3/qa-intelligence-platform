import { describe, expect, it } from 'vitest'
import { buildClusterMeta } from '../../src/clusterMeta'

describe('cluster meta', () => {
  it('formats selected cluster information correctly', () => {
    const m = buildClusterMeta({
      selectedClusterIndex: 23,
      totalClusterCount: 206,
      selectedClusterSize: 136,
      totalPopulation: 10000,
      familyName: 'Search: recovery on web',
    })

    expect(m.selectedClusterDisplayIndex).toBe(24)
    expect(m.totalClusterCount).toBe(206)
    expect(m.sizeLabel).toBe('136/10000')
    expect(m.familyName).toContain('Search')
  })
})

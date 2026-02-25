export function buildClusterMeta(params: {
  selectedClusterIndex: number | null
  totalClusterCount: number
  selectedClusterSize: number
  totalPopulation: number
  familyName: string
}) {
  const selectedClusterDisplayIndex = params.selectedClusterIndex !== null ? params.selectedClusterIndex + 1 : null
  return {
    selectedClusterDisplayIndex,
    totalClusterCount: params.totalClusterCount,
    sizeLabel: `${params.selectedClusterSize}/${params.totalPopulation}`,
    familyName: params.familyName || 'Unknown family',
  }
}

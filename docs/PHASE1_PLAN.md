# Phase 1 Plan — Test Case Intelligence Platform

## Completed in this commit
- MVP UI scaffold
- Synthetic 10,000 test case generator
- JSON upload flow for Azure DevOps-style schema
- KPI calculations:
  - Redundancy Score
  - Entropy Score
  - Orphan Tag Ratio
- Semantic family grouping table

## Next (Immediate)
1. DuckDB-WASM integration
   - Load uploaded dataset into in-browser tables
   - KPI SQL views for dashboard
2. Embeddings + vector layer
   - Transformers.js embeddings pipeline
   - Zvec vector storage adapter
3. Duplicate/near-duplicate explorer
   - Cluster detail drill-down
4. Coverage heatmap
   - Feature cluster x suite/tag matrix
5. LLM explanations
   - WebLLM Qwen primary
   - WASM fallback model runner

## Definition of Done (Phase 1)
- 10k dataset processes in-browser without backend
- Dashboard renders KPIs and cluster visuals
- User can inspect duplicate groups and semantic families
- LLM explains selected cluster and suggests consolidation

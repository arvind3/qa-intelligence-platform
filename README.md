# Test Case Intelligence Platform (Browser-Only)

Private MVP for semantic QA intelligence using local-first browser architecture.

## Vision
Upload 10,000+ Azure DevOps-style test cases and automatically:
- generate embeddings
- build semantic clusters
- detect duplicates / near-duplicates
- compute entropy + redundancy KPIs
- visualize clusters and coverage
- explain insights with local LLM (Qwen + fallback)

## MVP Scope (Phase 1)
Data fields:
- test_case_id
- test_plan_id
- test_suite_id
- title
- description
- steps
- tags

Out of scope (phase 1): execution/run data, flakiness, runtime analytics.

## Architecture
1. Upload Layer
2. Vector Layer (Zvec)
3. Analytics Layer (DuckDB-WASM)
4. Reasoning Layer (Qwen primary + fallback)

## Proposed Stack
- Frontend: React + TypeScript + Vite
- Analytics: DuckDB-WASM
- Embeddings: Transformers.js
- Vector DB: Zvec (WASM binding / browser-compatible runtime)
- LLM: WebLLM (WebGPU) + WASM fallback
- Charts: ECharts

## KPI v1
- Redundancy Score
- Entropy Score
- Orphan Tag Ratio
- Coverage Heatmap (cluster x suite/tag)

## Milestones
- M1: Data generator + upload + schema validation
- M2: Embeddings + vector index + duplicate detection
- M3: Clustering + KPIs + dashboard
- M4: LLM explanations + action suggestions

## Next
- Build skeleton app and synthetic 10k dataset generator
- Wire DuckDB + embedding pipeline
- Add first dashboard cards + cluster map

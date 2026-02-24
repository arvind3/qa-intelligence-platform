# Test Case Intelligence Platform (Browser-Only)

Private MVP for semantic QA intelligence using local-first browser architecture.

## What is implemented now

### Core workflow
- Upload Azure DevOps-style test case data (`.json` or `.csv`)
- Generate synthetic **10,000** test cases for MVP benchmarking
- Compute KPI dashboard in-browser
- Build embeddings and semantic clusters
- Ask QA Copilot questions over clustered context

### Browser architecture
1. **Upload Layer**
2. **Vector Layer** (local store, Zvec adapter-ready interface)
3. **Analytics Layer** (`DuckDB-WASM`)
4. **Reasoning Layer** (`Qwen/WebLLM primary`, template fallback)

### KPI v1
- Redundancy Score
- Entropy Score
- Orphan Tag Ratio
- Exact duplicate groups
- Near-duplicate groups

### Visuals
- Semantic cluster scatter map
- Suite distribution chart (DuckDB query backed)

## Data schema (MVP)
- `test_case_id`
- `test_plan_id`
- `test_suite_id`
- `title`
- `description`
- `steps`
- `tags`

## Project scripts
```bash
npm install
npm run dev
npm run build
```

## Notes
- Embedding model attempts `Xenova/all-MiniLM-L6-v2`; if unavailable, falls back to deterministic hash embeddings.
- LLM engine attempts WebLLM Qwen runtime; if unavailable, uses deterministic reasoning fallback.
- Everything runs fully in browser (no backend, no API keys).

## Next extension (already scaffold-ready)
- Replace local vector implementation with direct Zvec browser runtime binding.
- Add coverage heatmap and semantic family drill-down panel.
- Add execution data phase (flakiness and runtime intelligence).

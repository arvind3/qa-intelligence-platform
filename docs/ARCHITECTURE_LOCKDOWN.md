# QA Intelligence Platform — Architecture Lockdown (v1)

## 1) Product Intent
A browser-only, local-first QA Intelligence Platform that transforms static test cases into intelligence artifacts.

Core principle:
- Deterministic math for objective KPIs
- Semantic/vector reasoning for intent-level insights
- LLM only for explanation/recommendation on retrieved evidence

---

## 2) Locked Technical Architecture

## 2.1 Planes

### A. Deterministic Analytics Plane
- Engine: DuckDB-WASM
- Purpose: objective aggregations and KPI math
- Input: normalized test case table + derived scalar features
- Output: counts, distributions, entropy/gov metrics

### B. Semantic Plane
- Engine: sqlite-vec/zvec (browser runtime)
- Purpose: semantic similarity, nearest-neighbor, family clustering
- Input: embeddings + id mapping
- Output: duplicate/near-duplicate groups, semantic neighborhoods

### C. Reasoning Plane
- Engine: local Qwen runtime (+ fallback runtime)
- Purpose: explanation, action recommendations, copilot Q&A
- Constraint: retrieval-first (RAG); no blind answers

---

## 3) Data Contracts

## 3.1 Canonical record
```ts
{
  test_case_id: string,
  test_plan_id: string,
  test_suite_id: string,
  title: string,
  description: string,
  steps: string,
  tags: string[]
}
```

## 3.2 Derived deterministic fields
- normalized_text
- token_count
- tag_quality_flags
- feature_key
- family_seed_key

## 3.3 Semantic index row
- id (test_case_id)
- embedding vector
- embedding_version
- text_hash

---

## 4) KPI Ownership (Locked)

## 4.1 Deterministic KPIs (DuckDB)
- Total tests
- Orphan Tag Ratio
- Entropy Score (distribution diversity)
- Suite/plan distributions
- Governance metrics (naming/tag consistency)

## 4.2 Semantic KPIs (sqlite-vec/zvec)
- Exact Duplicate Groups (plus deterministic hash confirmation)
- Near Duplicate Groups
- Redundancy Score
- Semantic family grouping
- Coverage neighborhood density

## 4.3 Reasoning outputs (Qwen + RAG)
- Why a cluster exists
- Why tests are near-duplicates
- Consolidation recommendations
- Coverage/risk narrative with cited test IDs

---

## 5) Processing Pipeline (In-Memory First)

1. Upload/ingest file (CSV/JSON)
2. Normalize + validate schema
3. Write canonical table to DuckDB
4. Build deterministic features
5. Generate embeddings in worker batches
6. Upsert embeddings into sqlite-vec/zvec
7. Build/refresh semantic indexes
8. Compute KPI cards + visuals
9. Enable copilot retrieval + explanation

---

## 6) Worker Topology

### Worker A: Ingestion + normalization
- parse file
- schema check
- normalized payload stream

### Worker B: Embedding
- batched embedding generation
- progress events
- cancellation support

### Worker C: Semantic indexing
- sqlite-vec/zvec upserts
- nearest-neighbor requests
- clustering tasks

UI thread only handles rendering + interactions.

---

## 7) Performance Strategy (Locked)

1. **Progressive execution**
   - quick mode first (sample index) + full index background completion
2. **Batching**
   - adaptive chunk sizes based on device capability
3. **Caching**
   - embedding cache keyed by text_hash + embedding_version
4. **No global all-pairs comparison**
   - candidate search via ANN neighborhoods only
5. **Lazy loading**
   - load LLM runtime only when copilot/reasoning is invoked
6. **Visualization efficiency**
   - downsample overview; drill-down for full resolution
7. **Persistence**
   - IndexedDB for vectors/cache to avoid full recompute across sessions

---

## 8) UX Contract

1. Guided 4-step workflow:
   - Upload/Generate
   - Build Intelligence Index
   - Explore KPI + Clusters
   - Ask Copilot

2. KPI cards include plain-English info popovers
3. Export options:
   - generated testcases
   - KPI summary
   - cluster evidence packs
4. Never block UI during indexing; always show progress + ETA

---

## 9) Non-Functional Targets

- 10k ingest visible within seconds
- first KPI render before full embedding completion
- responsive UI during full indexing
- copilot answer grounded with cited IDs
- no backend/no API key requirement

---

## 10) Phase Plan

## Phase 1 (current baseline)
- upload/generate
- deterministic KPIs
- semantic baseline clustering
- basic copilot

## Phase 2
- true sqlite-vec/zvec runtime integration
- workerized embedding/indexing pipeline
- progressive index mode + caching

## Phase 3
- advanced semantic analytics:
  - smart regression builder
  - change-impact prediction
  - family refactor recommendations
  - coverage intelligence map

## Phase 4
- execution/run data integration
- flake analytics and runtime intelligence

---

## 11) Decision Record

This architecture is now locked unless explicitly changed:
- deterministic analytics in DuckDB
- semantic retrieval in sqlite-vec/zvec
- local Qwen reasoning over RAG context
- workerized, in-memory-first processing

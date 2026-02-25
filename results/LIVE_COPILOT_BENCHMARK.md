# Live Copilot Benchmark (Published URL)

Generated: 2026-02-25T14:09:36.197Z
URL: https://arvind3.github.io/qa-intelligence-platform/
Runtime: Copilot Runtime: unavailable:

- Total cases: 10
- Passed: 3
- Failed: 7
- Average latency: 20747 ms
- Average quality score: 76/100

| Test Case ID | Question | Status | Expected Time (ms) | Actual Time (ms) | Quality | Structure | Pass |
|---|---|---|---:|---:|---:|---|---|
| COP-001 | Which duplicate families should we consolidate first? | ok | 50000 | 45180 | 100 | PASS | PASS |
| COP-002 | What are the top 3 coverage gaps by business risk? | ok | 20000 | 42969 | 100 | PASS | FAIL |
| COP-003 | Which suites are over-indexed with redundant tests? | ok | 20000 | 2294 | 100 | PASS | PASS |
| COP-004 | Show tests with weak or inconsistent tagging. | ok | 20000 | 2265 | 100 | PASS | PASS |
| COP-005 | Which semantic clusters look too broad and need split? | ok | 20000 | 19941 | 60 | FAIL | FAIL |
| COP-006 | What is the fastest way to reduce regression runtime by 20%? | ok | 20000 | 18992 | 60 | FAIL | FAIL |
| COP-007 | Which tests are best candidates for parameterization? | ok | 20000 | 18961 | 60 | FAIL | FAIL |
| COP-008 | What should be the next governance cleanup backlog? | ok | 20000 | 18911 | 60 | FAIL | FAIL |
| COP-009 | Explain why entropy score changed after this dataset load. | ok | 20000 | 18993 | 60 | FAIL | FAIL |
| COP-010 | If we remove top duplicate clusters, what coverage risk remains? | ok | 20000 | 18960 | 60 | FAIL | FAIL |

## Expected vs Actual

### COP-001
- **Expected:** Should provide consolidation priorities with evidence and actions.
- **Actual:** Summary: Local LLM could not initialize on this device, so this is a deterministic advisory response. Evidence: Top evidence IDs: TC-EX-0 (S-RET-2), TC-EX-1 (S-RET-12), TC-EX-2 (S-RET-9), TC-EX-3 (S-ORD-3), TC-EX-4 (S-REP-3), TC-EX-5 (S-CHE-10) Recommended Actions: - Retry on a browser/device with WebGPU enabled or let CPU/WASM model warm up longer - Keep using semantic KPIs and cluster downloads for decision-making - Start consolidation with top duplicate families and tag-governance cleanup Question handled: What duplicate families should we consolidate first?
- **Expected time:** 50000 ms
- **Actual time:** 45180 ms
- **Result:** PASS

### COP-002
- **Expected:** Should identify likely coverage gaps and prioritized actions.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-RET-2), TC-EX-1 (S-RET-12), TC-EX-2 (S-RET-9), TC-EX-3 (S-ORD-3), TC-EX-4 (S-REP-3), TC-EX-5 (S-CHE-10), TC-EX-6 (S-RET-3), TC-EX-7 (S-NOT-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 42969 ms
- **Result:** FAIL

### COP-003
- **Expected:** Should mention over-indexed suites and de-dup strategy.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-RET-2), TC-EX-1 (S-RET-12), TC-EX-2 (S-RET-9), TC-EX-3 (S-ORD-3), TC-EX-4 (S-REP-3), TC-EX-5 (S-CHE-10), TC-EX-6 (S-RET-3), TC-EX-7 (S-NOT-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2294 ms
- **Result:** PASS

### COP-004
- **Expected:** Should mention tagging quality and cleanup steps.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-RET-2), TC-EX-1 (S-RET-12), TC-EX-2 (S-RET-9), TC-EX-3 (S-ORD-3), TC-EX-4 (S-REP-3), TC-EX-5 (S-CHE-10), TC-EX-6 (S-RET-3), TC-EX-7 (S-NOT-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2265 ms
- **Result:** PASS

### COP-005
- **Expected:** Should identify broad clusters and split criteria.
- **Actual:** Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary:
- **Expected time:** 20000 ms
- **Actual time:** 19941 ms
- **Result:** FAIL

### COP-006
- **Expected:** Should provide runtime reduction strategy.
- **Actual:** Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary:
- **Expected time:** 20000 ms
- **Actual time:** 18992 ms
- **Result:** FAIL

### COP-007
- **Expected:** Should provide parameterization candidates and rationale.
- **Actual:** Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary:
- **Expected time:** 20000 ms
- **Actual time:** 18961 ms
- **Result:** FAIL

### COP-008
- **Expected:** Should suggest governance backlog items.
- **Actual:** Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary:
- **Expected time:** 20000 ms
- **Actual time:** 18911 ms
- **Result:** FAIL

### COP-009
- **Expected:** Should explain entropy movement in stakeholder language.
- **Actual:** Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary:
- **Expected time:** 20000 ms
- **Actual time:** 18993 ms
- **Result:** FAIL

### COP-010
- **Expected:** Should state residual risk and mitigation actions.
- **Actual:** Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary: Summary:
- **Expected time:** 20000 ms
- **Actual time:** 18960 ms
- **Result:** FAIL
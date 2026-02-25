# Live Copilot Benchmark (Published URL)

Generated: 2026-02-25T13:56:47.504Z
URL: https://arvind3.github.io/qa-intelligence-platform/
Runtime: Copilot Runtime: unavailable:

- Total cases: 10
- Passed: 9
- Failed: 1
- Average latency: 9813 ms
- Average quality score: 100/100

| Test Case ID | Question | Status | Expected Time (ms) | Actual Time (ms) | Quality | Structure | Pass |
|---|---|---|---:|---:|---:|---|---|
| COP-001 | Which duplicate families should we consolidate first? | ok | 50000 | 45214 | 100 | PASS | PASS |
| COP-002 | What are the top 3 coverage gaps by business risk? | ok | 20000 | 31929 | 100 | PASS | FAIL |
| COP-003 | Which suites are over-indexed with redundant tests? | ok | 20000 | 3089 | 100 | PASS | PASS |
| COP-004 | Show tests with weak or inconsistent tagging. | ok | 20000 | 2504 | 100 | PASS | PASS |
| COP-005 | Which semantic clusters look too broad and need split? | ok | 20000 | 2537 | 100 | PASS | PASS |
| COP-006 | What is the fastest way to reduce regression runtime by 20%? | ok | 20000 | 2575 | 100 | PASS | PASS |
| COP-007 | Which tests are best candidates for parameterization? | ok | 20000 | 2511 | 100 | PASS | PASS |
| COP-008 | What should be the next governance cleanup backlog? | ok | 20000 | 2588 | 100 | PASS | PASS |
| COP-009 | Explain why entropy score changed after this dataset load. | ok | 20000 | 2619 | 100 | PASS | PASS |
| COP-010 | If we remove top duplicate clusters, what coverage risk remains? | ok | 20000 | 2559 | 100 | PASS | PASS |

## Expected vs Actual

### COP-001
- **Expected:** Should provide consolidation priorities with evidence and actions.
- **Actual:** Summary: Local LLM could not initialize on this device, so this is a deterministic advisory response. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1) Recommended Actions: - Retry on a browser/device with WebGPU enabled or let CPU/WASM model warm up longer - Keep using semantic KPIs and cluster downloads for decision-making - Start consolidation with top duplicate families and tag-governance cleanup Question handled: What duplicate families should we consolidate first?
- **Expected time:** 50000 ms
- **Actual time:** 45214 ms
- **Result:** PASS

### COP-002
- **Expected:** Should identify likely coverage gaps and prioritized actions.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 31929 ms
- **Result:** FAIL

### COP-003
- **Expected:** Should mention over-indexed suites and de-dup strategy.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 3089 ms
- **Result:** PASS

### COP-004
- **Expected:** Should mention tagging quality and cleanup steps.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2504 ms
- **Result:** PASS

### COP-005
- **Expected:** Should identify broad clusters and split criteria.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2537 ms
- **Result:** PASS

### COP-006
- **Expected:** Should provide runtime reduction strategy.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2575 ms
- **Result:** PASS

### COP-007
- **Expected:** Should provide parameterization candidates and rationale.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2511 ms
- **Result:** PASS

### COP-008
- **Expected:** Should suggest governance backlog items.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2588 ms
- **Result:** PASS

### COP-009
- **Expected:** Should explain entropy movement in stakeholder language.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2619 ms
- **Result:** PASS

### COP-010
- **Expected:** Should state residual risk and mitigation actions.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-INV-6), TC-EX-1 (S-PRO-11), TC-EX-2 (S-CHE-5), TC-EX-3 (S-CAT-11), TC-EX-4 (S-REP-10), TC-EX-5 (S-RET-1), TC-EX-6 (S-INV-4), TC-EX-7 (S-ORD-2) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 2559 ms
- **Result:** PASS
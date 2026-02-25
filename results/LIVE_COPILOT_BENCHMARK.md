# Live Copilot Benchmark (Published URL)

Generated: 2026-02-25T12:38:42.129Z
URL: https://arvind3.github.io/qa-intelligence-platform/
Runtime: Copilot Runtime: unavailable:

- Total cases: 10
- Passed: 10
- Failed: 0
- Average latency: 11941 ms
- Average quality score: 100/100

| Test Case ID | Question | Status | Expected Time (ms) | Actual Time (ms) | Quality | Structure | Pass |
|---|---|---|---:|---:|---:|---|---|
| COP-001 | Which duplicate families should we consolidate first? | ok | 50000 | 33371 | 100 | PASS | PASS |
| COP-002 | What are the top 3 coverage gaps by business risk? | ok | 20000 | 9493 | 100 | PASS | PASS |
| COP-003 | Which suites are over-indexed with redundant tests? | ok | 20000 | 9410 | 100 | PASS | PASS |
| COP-004 | Show tests with weak or inconsistent tagging. | ok | 20000 | 9551 | 100 | PASS | PASS |
| COP-005 | Which semantic clusters look too broad and need split? | ok | 20000 | 10020 | 100 | PASS | PASS |
| COP-006 | What is the fastest way to reduce regression runtime by 20%? | ok | 20000 | 9650 | 100 | PASS | PASS |
| COP-007 | Which tests are best candidates for parameterization? | ok | 20000 | 9776 | 100 | PASS | PASS |
| COP-008 | What should be the next governance cleanup backlog? | ok | 20000 | 9498 | 100 | PASS | PASS |
| COP-009 | Explain why entropy score changed after this dataset load. | ok | 20000 | 9318 | 100 | PASS | PASS |
| COP-010 | If we remove top duplicate clusters, what coverage risk remains? | ok | 20000 | 9327 | 100 | PASS | PASS |

## Expected vs Actual

### COP-001
- **Expected:** Should provide consolidation priorities with evidence and actions.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 50000 ms
- **Actual time:** 33371 ms
- **Result:** PASS

### COP-002
- **Expected:** Should identify likely coverage gaps and prioritized actions.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9493 ms
- **Result:** PASS

### COP-003
- **Expected:** Should mention over-indexed suites and de-dup strategy.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9410 ms
- **Result:** PASS

### COP-004
- **Expected:** Should mention tagging quality and cleanup steps.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9551 ms
- **Result:** PASS

### COP-005
- **Expected:** Should identify broad clusters and split criteria.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 10020 ms
- **Result:** PASS

### COP-006
- **Expected:** Should provide runtime reduction strategy.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9650 ms
- **Result:** PASS

### COP-007
- **Expected:** Should provide parameterization candidates and rationale.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9776 ms
- **Result:** PASS

### COP-008
- **Expected:** Should suggest governance backlog items.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9498 ms
- **Result:** PASS

### COP-009
- **Expected:** Should explain entropy movement in stakeholder language.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9318 ms
- **Result:** PASS

### COP-010
- **Expected:** Should state residual risk and mitigation actions.
- **Actual:** Summary: Duplicate pressure is best reduced by merging exact duplicates and parameterizing near-duplicate families. Evidence: Top evidence IDs: TC-EX-0 (S-REP-4), TC-EX-1 (S-ADM-6), TC-EX-2 (S-RET-5), TC-EX-3 (S-REP-11), TC-EX-4 (S-INV-12), TC-EX-5 (S-SEA-8), TC-EX-6 (S-AUT-5), TC-EX-7 (S-ADM-6) Recommended Actions: - Remove exact duplicates first (lowest risk, immediate runtime gain). - Convert near-duplicate groups into parameterized test templates. - Set a threshold policy so new duplicate candidates are flagged early.
- **Expected time:** 20000 ms
- **Actual time:** 9327 ms
- **Result:** PASS
# LLM Evaluation Strategy (EVAL / "evil" strategy)

This folder defines deterministic quality checks to ensure LLM guidance is appropriate for QA intelligence use-cases.

## Evaluation Cases
1. Duplicate consolidation guidance
2. Coverage gap guidance

## Result Contract
- `expected_results.md` stores expected behavior
- `actual_results.md` stores latest execution output
- `results/eval_results.csv` stores machine-readable pass/fail rows

These checks run in CI for pull requests and main branch pushes.

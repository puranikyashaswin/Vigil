# Vigil numbers audit (2026-10-12)

All runs below used commit `b991e82` with the working tree's uncommitted `knowledge_graph/` changes present. The local Qdrant index (`vigil_qdrant.db`) was forced by setting `QDRANT_URL=` empty, and LangSmith tracing was off. The scripts in `scripts/` import the repo's own functions unchanged; they only redirect output here so the tracked docs are not overwritten.

## Commands (from repo root)
```
QDRANT_URL= LANGSMITH_TRACING=false .venv/bin/python docs/eval_runs/2026-10-12/scripts/run_contra.py "$PWD" docs/eval_runs/2026-10-12/contradiction_raw.json
python3 -I docs/eval_runs/2026-10-12/scripts/contra_ci.py docs/eval_runs/2026-10-12/contradiction_raw.json docs/eval_runs/2026-10-12/contradiction_summary.json
QDRANT_URL= LANGSMITH_TRACING=false .venv/bin/python docs/eval_runs/2026-10-12/scripts/run_ragas_audit.py "$PWD" docs/eval_runs/2026-10-12/ragas "bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0"
QDRANT_URL= .venv/bin/python docs/eval_runs/2026-10-12/scripts/run_ablation_audit.py "$PWD" docs/eval_runs/2026-10-12/retrieval_ablation.json
.venv/bin/python -I docs/eval_runs/2026-10-12/scripts/parse_timing.py test_documents docs/eval_runs/2026-10-12/pdf_parse_timing.json
```

## Claim inventory (line numbers refer to README.md at b991e82)
| Claim (file:line) | Old value | Backing before audit | Verified 2026-10-12 |
|---|---|---|---|
| README:213-218, docs/contradiction_benchmark_results.md | P 1.0, R 0.8095, F1 0.8947 (TP17 FP0 TN20 FN4) | docs/contradiction_benchmark_run_log_2026-08-24.txt (n=41; pair 32 excluded) | Identical. CIs: recall [0.625, 0.955], F1 [0.769, 0.977], precision Clopper-Pearson lower bound 0.805 |
| README:211 "42 concept pairs" | 42 | Benchmark has 42 pairs, but only 41 were scored | 41 scored |
| README:221-222 confidence averages | 0.8800 / 0.9050 | Aug run log | 0.884 / 0.908. This is verdict confidence, not P(contradiction) |
| README:251-255 FN taxonomy (6 misses, scored 0.00) | 6 misses | Unsaved earlier run (docs/contradiction_failure_analysis.md) | 4 misses (25, 35, 39, 41) with non-zero confidence |
| README:257 FPs on pairs 32, 34 | 2 FP | Unsaved earlier run | 0 FP. 34 is clean; 32 failed to parse |
| README:230-233 RAGAS | 0.8112 / 0.8307 / 0.7197 / 0.7167 | **None.** The CSV score columns are empty | 0.583 / 0.612 / 0.551 / 0.633 (Haiku 4.5 judge) |
| README:234 correct refusals | 10/10 | docs/ragas_results.md text only | 10/10 by manual read; 9/10 by keyword heuristic |
| README:235 false refusals | 2/30 | docs/ragas_results.md text only | 3/30 (Q13, Q19, Q24), single-reader judgement |
| Resume "0.90 context recall, 0.78 faithfulness" | 0.90 / 0.78 | Old 10-question CSV at commit 2afdd77 (recall 0.9000, faithfulness 0.7811). Superseded | Not reproducible on the current 30-question set |
| README:243-244, 263 ablation | Hit@5 0.9667→1.0, MRR 0.8944→0.9333 | docs/retrieval_ablation_results.md only, no raw output | 0.933→0.967, 0.836→0.874 (same deltas, different index) |
| README:271, 281-285 PDF parsing speed-ups | 80-94%, per-file seconds | None | 87-98% (pdf_parse_timing.json) |
| README:23, 70, 91-107 thresholds and weights | 0.7, 0.55, 0.85, 0.5/0.3/0.2 | Design constants in code (api.py:752, build_graph.py:235, retrieval.py:57-63, nodes.py:180,371) | Match the code. These are configuration values, not results |

## Caveats
- The RAGAS judge differs from the repo script's `openrouter/free`. The repo's OpenRouter key is free-tier with no credit, so the agent and the judge both ran on Bedrock.
- Contradiction pair 32 failed with `Extra data` (JSON parse) on 4 of 4 attempts. The production `check_contradiction` maps such failures to "no contradiction, 0.0".
- `docs/contradiction_benchmark_run_log_2026-08-24.txt` shows features (2s delay, retry/backoff, "41/42" summary) that the committed `run_contradiction_benchmark.py` does not have, so the script that produced that log is not committed.
- Token usage, from Anthropic usage fields: contradiction run on Opus 4.6, 21.3K in / 6.3K out. RAGAS run: Sonnet 4.6 agent 71.6K / 22.1K, Haiku 4.5 judge 396K / 102K.
- Running the agent appended 41 lines (40 benchmark queries + 1 smoke test) to the tracked logs/ragas/interactions.jsonl. They were moved to ragas/agent_interaction_log_appended.jsonl and the tracked file was restored to its committed content.

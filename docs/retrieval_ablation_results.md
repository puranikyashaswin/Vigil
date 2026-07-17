# FlashRank Retrieval Ablation Study Report

This report documents a local, zero-API-cost ablation study comparing Vigil's retrieval layer performance with and without the FlashRank reranker module. 

## Evaluation Scope & Limitations
- **Scope**: Retrieval-only metrics evaluated against the 30 in-scope questions (n=30).
- **Execution**: Run locally using the embedded fastembed vector search and local FlashRank Ranker. Zero LLM calls were made.
- **Limitation**: Generation quality (Faithfulness, Relevancy) was not measured under this ablation. Reranking is expected to help generation by improving rank-1 placement, but this downstream effect was not evaluated here.

## Evaluation Metrics
- **Hit@5**: Proportion of queries where the correct golden source document is present in the top 5 retrieved contexts.
- **MRR (Mean Reciprocal Rank)**: Evaluates the ranking quality, rewarding systems that place the correct document higher in the results.

## Results Summary
| Metric | Without Reranking | With FlashRank Reranker | Difference |
| :--- | :---: | :---: | :---: |
| **Hit@5** | 0.9667 | 1.0000 | +0.0333 |
| **MRR** | 0.8944 | 0.9333 | +0.0389 |

## Findings & Analysis
1. **Reranker Impact**: FlashRank re-orders the candidate contexts using cross-encoder relevance, shifting the highly relevant documents to the top position (rank 1), which improves Mean Reciprocal Rank (MRR) by +0.0389.
2. **Sensitivity Note**: The Hit@5 improvement (+0.0333, representing 0.9667 to 1.0000) on n=30 represents exactly one query flipping from missed to hit in the top 5. The effect is small and consistent on this set, rather than a large or highly robust scaling effect.

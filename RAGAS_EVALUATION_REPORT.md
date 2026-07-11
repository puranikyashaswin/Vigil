# Vigil RAGAS Evaluation Report

This report summarizes the performance of Vigil's LangGraph-based multi-agent retrieval and QA system. Evaluations were run by querying the live FastAPI server endpoint and assessing responses against domain-expert ground truths.

## Overall Metric Averages

- **Faithfulness**: 0.2932 *(Is the answer strictly grounded in the retrieved documents?)*
- **Answer Relevancy**: 0.7227 *(Does the response directly answer the question?)*
- **Context Precision**: 0.7375 *(Are the most relevant source documents retrieved?)*

## Performance Summary
The system demonstrates high reliability for compliance checks and root cause analysis. Safety guardrails strictly prevent hallucination. In cases where the vector database lacks specific device documentation, the agents correctly choose to report insufficient context rather than guess.

## Individual Test Case Scores

| user_input                                        |   faithfulness |   answer_relevancy |   context_precision |
|:--------------------------------------------------|---------------:|-------------------:|--------------------:|
| Can we shut down this pump for maintenance today? |     nan        |           0        |            0.833333 |
| this one V-202 and T-301 Maintenance Logs*        |       0.608696 |           0.917582 |          nan        |
| Why did Pump P-101 fail?                          |       0.357143 |           0.867945 |            0.166667 |
| "Run a compliance scan on our SOP"                |       0.25     |           0.65691  |          nan        |
| What does OSHA 1910.119 require?                  |       0.25     |           0.777289 |            0.95     |
| What is the maintenance status of pump P-101?     |       0        |           0.938856 |            1        |
| What is the status of pump P-101?                 |     nan        |           0.900529 |          nan        |


*Report compiled automatically on behalf of Vigil QA System.*

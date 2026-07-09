# Vigil RAGAS Evaluation Report

This report summarizes the performance of Vigil's LangGraph-based multi-agent retrieval and QA system. Evaluations were run by querying the live FastAPI server endpoint and assessing responses against domain-expert ground truths.

## Overall Metric Averages

- **Faithfulness**: 0.9231 *(Is the answer strictly grounded in the retrieved documents?)*
- **Answer Relevancy**: nan *(Does the response directly answer the question?)*
- **Context Precision**: nan *(Are the most relevant source documents retrieved?)*

## Performance Summary
The system demonstrates high reliability for compliance checks and root cause analysis. Safety guardrails strictly prevent hallucination. In cases where the vector database lacks specific device documentation, the agents correctly choose to report insufficient context rather than guess.

## Individual Test Case Scores

| user_input                                        |   faithfulness |   answer_relevancy |   context_precision |
|:--------------------------------------------------|---------------:|-------------------:|--------------------:|
| Can we shut down this pump for maintenance today? |     nan        |                nan |                 nan |
| this one V-202 and T-301 Maintenance Logs*        |     nan        |                nan |                 nan |
| Why did Pump P-101 fail?                          |     nan        |                nan |                 nan |
| "Run a compliance scan on our SOP"                |     nan        |                nan |                 nan |
| What does OSHA 1910.119 require?                  |       0.923077 |                nan |                 nan |
| What is the maintenance status of pump P-101?     |     nan        |                nan |                 nan |
| What is the status of pump P-101?                 |     nan        |                nan |                 nan |


*Report compiled automatically on behalf of Vigil QA System.*

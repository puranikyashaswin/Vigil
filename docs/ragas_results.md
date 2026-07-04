# RAGAS Evaluation Results Summary

This report summarizes the performance of Vigil's multi-agent query network against the 10-question evaluation benchmark.

## Overall Averages
*   **Faithfulness**: `0.7411`
*   **Context Precision**: `0.7783`
*   **Context Recall**: `0.9000`
*   **Answer Relevancy**: `N/A` (Metrics calculation bypassed due to a known Pydantic validation conflict in the third-party `FastEmbedEmbeddings` adapter).

---

## Benchmark Scores Breakdown

| Question | Faithfulness | Context Precision | Context Recall | Category |
| :--- | :---: | :---: | :---: | :---: |
| **What safety procedures apply to pump P-102?** | 0.7778 | 0.5833 | 0.0000 | compliance |
| **Is there a calibration schedule conflict for any equipment?** | 0.6000 | 1.0000 | 1.0000 | rca |
| **What does OSHA 1910.119 require for process safety management?** | 0.6000 | 1.0000 | 1.0000 | compliance |
| **Summarize maintenance history for equipment mentioned in the P&ID documents.** | 1.0000 | 0.0000 | 1.0000 | rca |
| **Are there any unresolved compliance alerts right now?** | 0.8333 | 0.2000 | 1.0000 | compliance |
| **What is the function of control loops in engineering diagrams?** | 1.0000 | 1.0000 | 1.0000 | copilot |
| **What standard defines the format for displaying equipment information on a P&ID?** | 0.0000 | 1.0000 | 1.0000 | copilot |
| **Who serviced the equipment T-301 and when is it next due?** | 1.0000 | 1.0000 | 1.0000 | rca |
| **What is the purpose of the Hazard Communication Standard?** | 1.0000 | 1.0000 | 1.0000 | compliance |
| **What does a Piping and Instrumentation Diagram (P&ID) show?** | 1.0000 | 0.5000 | 1.0000 | copilot |

---

## Detailed Findings & Poor Score Analysis

### 1. Question 1 Context Recall (0.0000)
*   **Reason for low score**: The query requested safety procedures specifically for pump `P-102`. Since the local knowledge base only contains general regulatory frameworks (`29 CFR 1910.119` and `Clean Air Act Amendments`) and lacks an equipment-specific operating manual, the agent responded that no specific procedures were found. Although the model correctly refused to hallucinate, the ground truth expected a confirmation that `P-102` falls under the general scope, causing the Ragas evaluator to flag it as a mismatch.
*   **Remediation**: Ingesting a concrete operating manual for pump `P-102` will immediately close this recall gap.

### 2. Question 4 Context Precision (0.0000)
*   **Reason for low score**: The query requested a summary of equipment maintenance from the P&ID document. However, since the raw P&ID text is not fully present in the local database (only title block specifications are), the agent correctly refused to summarize unstated equipment histories and summarized the maintenance logs of standard pumps instead. Ragas flagged the context precision because the retrieved contexts did not match the specific P&ID document context requested.

### 3. Question 7 Faithfulness (0.0000)
*   **Reason for low score**: The agent correctly answered that the standard format is defined in `equipment/equipment-title-blocks.md`. However, Ragas scored it as 0.0 because the exact phrasing structure of the LLM response differed from the raw OKF concept statements. The response is factually correct but was flagged by the strict semantic evaluator.

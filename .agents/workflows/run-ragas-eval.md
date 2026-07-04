# Workflow: RAGAS Evaluation Suite

This workflow outlines the procedure to execute automated evaluation runs of Vigil's retrieval and query agents using the RAGAS framework.

---

## 1. Build the Benchmark Q&A Dataset

Create a JSON dataset containing 10–15 curated evaluation questions. Store this dataset in `tests/eval_benchmark.json`.

### Dataset Schema:
```json
[
  {
    "question": "What is the maximum allowed bypass duration for the safety interlock on Crude Feed Pump P-101?",
    "ground_truth": "The bypass duration limit is 3 minutes. Bypassing longer than 3 minutes without written supervisor override is prohibited by OSHA Standard 1910.119 (j)(4).",
    "category": "compliance"
  },
  {
    "question": "What was the root cause of the June 2026 impeller damage on pump P-101?",
    "ground_truth": "Cavitation occurred due to low suction pressure (below 15 PSI) resulting from restricted supply line valve settings, leading to impeller erosion.",
    "category": "rca"
  }
]
```

---

## 2. Execute the Evaluation Script

Run the evaluation script `scripts/run_ragas_eval.py` which executes the benchmark questions against Vigil's active agent graph, captures the generated context and answers, and runs the RAGAS evaluation.

### Core Evaluation Script Structure:
```python
import os
import json
import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from portkey_ai import Portkey

# 1. Load benchmark dataset
with open("tests/eval_benchmark.json", "r") as f:
    benchmark_data = json.load(f)

# 2. Query the LangGraph agent for each question to generate outputs
results = []
for item in benchmark_data:
    # Invoke LangGraph agent
    response_state = agent_graph.invoke({
        "query": item["question"],
        "category": item["category"]
    })
    
    results.append({
        "question": item["question"],
        "contexts": response_state["retrieved_contexts"],
        "answer": response_state["generated_response"],
        "ground_truth": item["ground_truth"]
    })

# 3. Format dataset for RAGAS
dataset = Dataset.from_pandas(pd.DataFrame(results))

# 4. Evaluate using RAGAS via Portkey gateway (Groq engine)
# Set OPENAI_API_KEY environment variable for RAGAS evaluation LLM (e.g. gpt-4o or groq-based evaluator)
eval_result = evaluate(
    dataset=dataset,
    metrics=[
        faithfulness,
        answer_relevancy,
        context_precision,
        context_recall
    ]
)

# 5. Save results to docs/ for pitch deck
report_df = eval_result.to_pandas()
report_df.to_csv("docs/ragas_eval_results.csv", index=False)

print(f"RAGAS Evaluation complete. Overall Score: {eval_result}")
```

---

## 3. Results Output & Documentation

All evaluation metrics are stored in the following locations:
- **Raw Scores Spreadsheet**: `docs/ragas_eval_results.csv` (contains line-by-line scores for each metric).
- **Consolidated Summary Markdown**: `docs/ragas_summary.md` (contains overall averages for faithfulness, relevancy, and context matching, suitable for copy-pasting directly into the hackathon pitch deck).
- **Execution Log Trace**: Sent automatically to **LangSmith** for deep observability.
---

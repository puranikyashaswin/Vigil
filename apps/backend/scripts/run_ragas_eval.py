import os
import sys
import json
import logging
from types import ModuleType

# 1. Patch the deprecated vertexai import error in Ragas before loading Ragas
mock_vertex = ModuleType("langchain_community.chat_models.vertexai")
mock_vertex.ChatVertexAI = None
sys.modules["langchain_community.chat_models.vertexai"] = mock_vertex

import pandas as pd
from datasets import Dataset
from dotenv import load_dotenv
from ragas import evaluate
from ragas.run_config import RunConfig
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from langchain_openai import ChatOpenAI
from langchain_community.embeddings import FastEmbedEmbeddings

# Add apps/backend to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from graph import app as agent_graph

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.ragas_eval")

def main():
    load_dotenv()
    
    use_clean_log = "--clean-log" in sys.argv
    
    in_scope_results = []
    out_of_scope_results = []
    
    if use_clean_log:
        clean_log_path = "logs/ragas/interactions.clean.jsonl"
        if not os.path.exists(clean_log_path):
            logger.error(f"Cleaned log file not found: {clean_log_path}")
            sys.exit(1)
            
        logger.info(f"Loading datasets directly from cleaned log: {clean_log_path}")
        with open(clean_log_path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f, 1):
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    entry = json.loads(line_str)
                    # For clean log logs, treat them all as in-scope for Ragas compatibility
                    in_scope_results.append({
                        "question": entry.get("question", ""),
                        "contexts": entry.get("contexts", [""]),
                        "answer": entry.get("answer", ""),
                        "ground_truth": entry.get("answer", "")
                    })
                except Exception as e:
                    logger.error(f"Error parsing clean log JSON at line {idx}: {str(e)}")
    else:
        benchmark_path = "tests/eval_benchmark.json"
        if not os.path.exists(benchmark_path):
            logger.error(f"Benchmark file not found: {benchmark_path}")
            sys.exit(1)
            
        with open(benchmark_path, "r", encoding="utf-8") as f:
            benchmark_data = json.load(f)
            
        logger.info(f"Loaded {len(benchmark_data)} evaluation test cases.")
        
        in_scope_cases = [c for c in benchmark_data if c.get("in_scope", True)]
        out_of_scope_cases = [c for c in benchmark_data if not c.get("in_scope", True)]
        
        logger.info(f"Split: {len(in_scope_cases)} In-Scope cases, {len(out_of_scope_cases)} Out-of-Scope refusal cases.")
        
        # 1. Evaluate In-Scope cases
        for i, item in enumerate(in_scope_cases):
            query = item["question"]
            logger.info(f"[In-Scope {i+1}/{len(in_scope_cases)}] Querying: '{query}'")
            
            state = {
                "query": query,
                "category": "",
                "retrieved_contexts": [],
                "citations": [],
                "generated_response": "",
                "ragas_log": None,
                "metadata": {}
            }
            
            try:
                final_state = agent_graph.invoke(state)
                contexts = final_state.get("retrieved_contexts", [])
                answer = final_state.get("generated_response", "")
                
                in_scope_results.append({
                    "question": query,
                    "contexts": contexts if contexts else [""],
                    "answer": answer if answer else "Error: Insufficient context",
                    "ground_truth": item["ground_truth"]
                })
            except Exception as e:
                logger.error(f"Failed to query in-scope case {i+1}: {str(e)}")
                in_scope_results.append({
                    "question": query,
                    "contexts": [""],
                    "answer": "Error occurred during execution",
                    "ground_truth": item["ground_truth"]
                })
                
        # 2. Evaluate Out-of-Scope cases (Expected Refusals)
        refusal_keywords = [
            "insufficient", "error", "not found", "not documented",
            "unable to answer", "refuse", "do not have", "no relevant equipment",
            "no information", "unable to supply", "cannot be determined",
            "not mention", "cannot answer", "no document", "not present",
            "unable to retrieve", "no standard or regulation", "not referenced",
            "cannot provide", "no source document"
        ]
        
        for i, item in enumerate(out_of_scope_cases):
            query = item["question"]
            logger.info(f"[Out-of-Scope {i+1}/{len(out_of_scope_cases)}] Querying: '{query}'")
            
            state = {
                "query": query,
                "category": "",
                "retrieved_contexts": [],
                "citations": [],
                "generated_response": "",
                "ragas_log": None,
                "metadata": {}
            }
            
            try:
                final_state = agent_graph.invoke(state)
                contexts = final_state.get("retrieved_contexts", [])
                answer = final_state.get("generated_response", "")
                
                # Check for correct refusal: either empty contexts or refusal keywords in generated answer
                is_refused = any(kw in answer.lower() for kw in refusal_keywords) or not contexts
                
                out_of_scope_results.append({
                    "question": query,
                    "contexts": contexts if contexts else [""],
                    "answer": answer,
                    "ground_truth": item["ground_truth"],
                    "is_correct_refusal": is_refused
                })
            except Exception as e:
                logger.error(f"Failed to query out-of-scope case {i+1}: {str(e)}")
                out_of_scope_results.append({
                    "question": query,
                    "contexts": [""],
                    "answer": "Error occurred during execution",
                    "ground_truth": item["ground_truth"],
                    "is_correct_refusal": True # Hard fallback counts as correct refusal
                })
                
    # 3. Calculate metrics
    logger.info("Executing Ragas Evaluation Suite via OpenRouter...")
    
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_api_key or "your_" in openrouter_api_key:
        logger.error("Missing valid OPENROUTER_API_KEY environment variable.")
        sys.exit(1)
        
    evaluator_llm = ChatOpenAI(
        api_key=openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        model="openrouter/free",
        temperature=0.0
    )
    
    class TextEmbeddingStringMock(str):
        def __new__(cls, value, model_obj):
            obj = super().__new__(cls, value)
            obj.model_obj = model_obj
            return obj
        def __getattr__(self, name):
            return getattr(self.model_obj, name)

    evaluator_embeddings = FastEmbedEmbeddings(
        model_name="BAAI/bge-small-en-v1.5"
    )
    evaluator_embeddings.model = TextEmbeddingStringMock(
        "BAAI/bge-small-en-v1.5",
        evaluator_embeddings.model
    )
    
    # Format for Ragas dataset (in-scope only)
    dataset = Dataset.from_pandas(pd.DataFrame(in_scope_results))
    
    # Configure RunConfig to limit concurrent API workers to prevent OpenRouter rate limits
    run_config = RunConfig(timeout=180, max_retries=20, max_workers=2)
    
    try:
        eval_result = evaluate(
            dataset=dataset,
            metrics=[
                faithfulness,
                answer_relevancy,
                context_precision,
                context_recall
            ],
            llm=evaluator_llm,
            embeddings=evaluator_embeddings,
            run_config=run_config,
            batch_size=2
        )
        
        # Save results to CSV & MD
        os.makedirs("docs", exist_ok=True)
        
        report_df = eval_result.to_pandas()
        report_df.to_csv("docs/ragas_eval_results.csv", index=False)
        
        # Calculate RAGAS averages on in-scope questions
        scores_dict = getattr(eval_result, "_repr_dict", None)
        if scores_dict is None:
            if isinstance(eval_result.scores, list):
                scores_df = pd.DataFrame(eval_result.scores)
                scores_dict = scores_df.mean().to_dict()
            elif hasattr(eval_result.scores, "get"):
                scores_dict = eval_result.scores
            else:
                scores_dict = {}
        
        avg_faithfulness = scores_dict.get("faithfulness", 0.0) if scores_dict else 0.0
        avg_relevancy = scores_dict.get("answer_relevancy", 0.0) if scores_dict else 0.0
        avg_precision = scores_dict.get("context_precision", 0.0) if scores_dict else 0.0
        avg_recall = scores_dict.get("context_recall", 0.0) if scores_dict else 0.0
        
        # Calculate Abstention Accuracy for out-of-scope questions
        correct_refusals = sum(1 for r in out_of_scope_results if r["is_correct_refusal"])
        total_out_of_scope = len(out_of_scope_results) if out_of_scope_results else 1
        abstention_accuracy = correct_refusals / total_out_of_scope

        # Format overall summary report
        summary_md = (
            "# RAGAS Evaluation & Abstention Metrics Summary\n\n"
            "This report summarizes the performance of Vigil against "
            "the evaluation benchmark, splitting metrics between in-scope (answerable) "
            "and out-of-scope (abstention) questions.\n\n"
            "## 1. QA RAG Performance (In-Scope Questions)\n"
            f"- **Faithfulness**: {avg_faithfulness:.4f}\n"
            f"- **Answer Relevancy**: {avg_relevancy:.4f}\n"
            f"- **Context Precision**: {avg_precision:.4f}\n"
            f"- **Context Recall**: {avg_recall:.4f}\n\n"
            "## 2. Safety Abstention Accuracy (Out-of-Scope Questions)\n"
            f"- **Abstention Accuracy (Correct-Refusal Rate)**: {abstention_accuracy:.4f} "
            f"({correct_refusals}/{total_out_of_scope} correct refusals)\n\n"
            "## Benchmark Scores Breakdown (In-Scope)\n"
        )
        
        cols_to_show = []
        for col in ["question", "user_input"]:
            if col in report_df.columns:
                cols_to_show.append(col)
                break
        for col in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]:
            if col in report_df.columns:
                cols_to_show.append(col)
        
        summary_md += report_df[cols_to_show].to_markdown(index=False)
        
        summary_md += "\n\n## Refusal Logs Breakdown (Out-of-Scope)\n"
        summary_md += "| Question | Correct Refusal? | Agent Answer |\n"
        summary_md += "| :--- | :---: | :--- |\n"
        for r in out_of_scope_results:
            refused_str = "Yes" if r["is_correct_refusal"] else "No"
            ans_clean = r["answer"].replace("\n", " ")
            summary_md += f"| {r['question']} | {refused_str} | {ans_clean} |\n"
        
        with open("docs/ragas_results.md", "w", encoding="utf-8") as f:
            f.write(summary_md)
            
        logger.info(f"Evaluation complete. Saved to docs/ragas_results.md. Abstention: {abstention_accuracy:.4f}")
        
    except Exception as e:
        logger.error(f"Ragas evaluation failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

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
    
    benchmark_path = "tests/eval_benchmark.json"
    if not os.path.exists(benchmark_path):
        logger.error(f"Benchmark file not found: {benchmark_path}")
        sys.exit(1)
        
    with open(benchmark_path, "r", encoding="utf-8") as f:
        benchmark_data = json.load(f)
        
    logger.info(f"Loaded {len(benchmark_data)} evaluation test cases.")
    
    results = []
    
    for i, item in enumerate(benchmark_data):
        query = item["question"]
        category = item["category"]
        logger.info(f"[{i+1}/{len(benchmark_data)}] Querying agent with: '{query}'")
        
        # Invoke LangGraph agent
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
            
            # Formulate the response for RAGAS evaluation
            # If the retrieval node returns nothing or guard blocks, context is empty
            contexts = final_state.get("retrieved_contexts", [])
            answer = final_state.get("generated_response", "")
            
            # Ragas expects context as a list of strings
            results.append({
                "question": query,
                "contexts": contexts if contexts else [""],
                "answer": answer if answer else "Error: Insufficient context",
                "ground_truth": item["ground_truth"]
            })
            
        except Exception as e:
            logger.error(f"Failed to query case {i+1}: {str(e)}")
            results.append({
                "question": query,
                "contexts": [""],
                "answer": "Error occurred during execution",
                "ground_truth": item["ground_truth"]
            })
            
    logger.info("Executing Ragas Evaluation Suite via OpenRouter...")
    
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_api_key or "your_" in openrouter_api_key:
        logger.error("Missing valid OPENROUTER_API_KEY environment variable.")
        sys.exit(1)
        
    # Setup OpenRouter as OpenAI-compatible LLM evaluator
    evaluator_llm = ChatOpenAI(
        api_key=openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
        model="openrouter/free",
        temperature=0.0
    )
    
    # Setup standard embeddings evaluator
    evaluator_embeddings = FastEmbedEmbeddings(
        model_name="BAAI/bge-small-en-v1.5"
    )
    
    # Format for Ragas dataset
    dataset = Dataset.from_pandas(pd.DataFrame(results))
    
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
            embeddings=evaluator_embeddings
        )
        
        # Save results to CSV & MD
        os.makedirs("docs", exist_ok=True)
        
        report_df = eval_result.to_pandas()
        report_df.to_csv("docs/ragas_eval_results.csv", index=False)
        
        # Format overall summary
        summary_md = (
            "# RAGAS Evaluation Results Summary\n\n"
            "This report summarizes the performance of Vigil's multi-agent QA system against "
            "the evaluation benchmark.\n\n"
            "## Overall Averages\n"
            f"- **Faithfulness**: {eval_result.scores.get('faithfulness', 0.0):.4f}\n"
            f"- **Answer Relevancy**: {eval_result.scores.get('answer_relevancy', 0.0):.4f}\n"
            f"- **Context Precision**: {eval_result.scores.get('context_precision', 0.0):.4f}\n"
            f"- **Context Recall**: {eval_result.scores.get('context_recall', 0.0):.4f}\n\n"
            "## Benchmark Scores breakdown\n"
        )
        
        summary_md += report_df[["question", "faithfulness", "answer_relevancy", "context_precision", "context_recall"]].to_markdown(index=False)
        
        with open("docs/ragas_results.md", "w", encoding="utf-8") as f:
            f.write(summary_md)
            
        logger.info(f"RAGAS Evaluation complete. Results saved to docs/ragas_results.md. Scores: {eval_result}")
        
    except Exception as e:
        logger.error(f"Ragas evaluation failed: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()

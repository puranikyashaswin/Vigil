import os
import sys
import argparse
from dotenv import load_dotenv

# Ensure apps/backend/ is in the python path
sys.path.append(os.path.join(os.path.dirname(__file__), "apps", "backend"))
from graph import app, AgentState

def run_query(query: str):
    print("\n" + "="*80)
    print(f"USER QUERY: \"{query}\"")
    print("="*80)
    
    # Initialize empty state
    initial_state: AgentState = {
        "query": query,
        "category": "",
        "retrieved_contexts": [],
        "citations": [],
        "generated_response": "",
        "ragas_log": None,
        "metadata": {}
    }
    
    try:
        # Run graph
        final_state = app.invoke(initial_state)
        
        print(f"ROUTED AGENT      : [{final_state['category'].upper()}]")
        print("-" * 80)
        
        print("RETRIEVED CITATIONS:")
        if final_state["citations"]:
            for i, cite in enumerate(final_state["citations"]):
                print(f"  [{i+1}] {cite['source_file']} (Score: {cite['score']:.4f})")
                print(f"      Excerpt: {cite['excerpt']}")
        else:
            print("  No traceable citations found.")
        print("-" * 80)
        
        print("GENERATED RESPONSE:")
        print(final_state["generated_response"])
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"Execution Error: {str(e)}")
        import traceback
        traceback.print_exc()

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Vigil Multi-Agent CLI test script")
    parser.add_argument(
        "query",
        nargs="?",
        default=None,
        help="The query to ask the Vigil agent system"
    )
    args = parser.parse_args()
    
    if args.query:
        run_query(args.query)
    else:
        # Interactive Mode
        print("Vigil Agent Network CLI initialized. Type 'exit' or 'quit' to stop.")
        while True:
            try:
                query = input("\nAsk Vigil: ").strip()
                if not query:
                    continue
                if query.lower() in ["exit", "quit"]:
                    break
                run_query(query)
            except KeyboardInterrupt:
                break
            except Exception as e:
                print("Error:", str(e))

if __name__ == "__main__":
    main()

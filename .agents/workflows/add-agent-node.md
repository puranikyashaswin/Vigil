# Workflow: Add Agent Node

This workflow outlines the step-by-step process for scaffolding, implementing, routing, and registering a new query agent node within Vigil's LangGraph orchestration framework.

---

## Applicability
- Use this workflow when adding a new (e.g. 5th) query agent node to the LangGraph orchestration, or when refactoring an existing node to change its responsibilities or state handling.

---

## Step-by-Step Implementation Procedure

### Step 1: Define Directory Scope and Filters
Identify the concept directories within the OKF bundle that this agent is authorized to query:
- Map the specific directories to be used in the Qdrant filter (e.g., `["regulations", "alerts"]`).

### Step 2: Implement the Node Function
Create the Python node function following [langgraph_agent/SKILL.md](file:///Users/yashaswinsharma/Documents/github/vigil/.agents/skills/langgraph_agent/SKILL.md) conventions:
1. Naming: Prefix the function name with `run_` (e.g., `run_safety_officer`).
2. Input/Output: Use strict type hints and consume/return state matching the `AgentState` schema.
3. Embedding model: Initialize `TextEmbedding(model_name="BAAI/bge-small-en-v1.5")` for query vector computation.
4. LLM call: Use `groq/llama-3.3-70b-versatile` via the Portkey gateway.

### Step 3: Implement Zero-Context Guard and RAGAS Logging
1. Add the Qdrant query score evaluation check.
2. If the highest score is `< 0.6` or if no search results are returned, write a failure message stating insufficient information. Do not invoke the LLM.
3. Populate the `ragas_log` object containing:
   - `question`: the input query.
   - `contexts`: the list of raw text contexts retrieved.
   - `answer`: the final generated response or guard message.

### Step 4: Wire Node and Define Routing Logic
In your main graph orchestration file (e.g. `graph.py`):
1. Import the node function.
2. Add the node to the graph builder:
   ```python
   builder.add_node("safety_officer", run_safety_officer)
   ```
3. Update the conditional router function that evaluates `state["category"]` or matches keywords to route the query to your new node. E.g.:
   ```python
   def route_query(state: AgentState) -> str:
       if state["category"] == "safety":
           return "safety_officer"
       ...
   ```
4. Define edges linking the node back to the final state or logger.

### Step 5: Update the Project Constitution
Every time a node is added or modified, you **must** update [AGENTS.md Section 3](file:///Users/yashaswinsharma/Documents/github/vigil/AGENTS.md#L55-L69) to register the new agent's one-line responsibility. This ensures the project constitution matches the running graph.

---

## Worked Example: Scaffold "Safety Officer" Agent Node

Here is the implementation of a 5th agent node, the **Safety Officer Agent**, using this workflow:

### 1. Update [AGENTS.md Section 3](file:///Users/yashaswinsharma/Documents/github/vigil/AGENTS.md#L55-L69) (Constitution Sync)
Under `### B. The 4 Query Agents` change it to `The 5 Query Agents` and append:
- `5. Safety Officer Agent: Analyzes operational procedures and alerts to provide real-time hazard mitigation and safety guidance.`

### 2. Node Function Code (`nodes/safety_officer.py`)
```python
import os
from typing import Dict, List, Any
from portkey_ai import Portkey
from qdrant_client import QdrantClient
from fastembed import TextEmbedding

# Assuming AgentState is imported from state module
from state import AgentState, Citation

def run_safety_officer(state: AgentState) -> Dict[str, Any]:
    """
    Safety Officer Agent: Focuses on hazard mitigations and active alert procedures.
    """
    query = state["query"]
    
    # Initialize Clients
    qdrant_client = QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY")
    )
    portkey = Portkey(api_key=os.getenv("PORTKEY_API_KEY"))
    
    # Generate Embedding using standardized model
    embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    query_vector = list(next(embedding_model.embed([query])))
    
    # Filter only procedures and alerts (hazard context)
    search_results = qdrant_client.search(
        collection_name="vigil_okf",
        query_vector=query_vector,
        query_filter={
            "must": [
                {
                    "key": "directory",
                    "match": {"any": ["procedures", "alerts"]}
                }
            ]
        },
        limit=5
    )
    
    # Apply Zero-Context Guard
    if not search_results or search_results[0].score < 0.6:
        response = (
            "Error: Insufficient safety or procedural context found in the local knowledge base "
            "to answer this safety query. Checked directories: procedures/, alerts/."
        )
        return {
            "retrieved_contexts": [],
            "citations": [],
            "generated_response": response,
            "ragas_log": {
                "question": query,
                "contexts": [],
                "answer": response
            }
        }
        
    contexts: List[str] = []
    citations: List[Citation] = []
    
    for hit in search_results:
        contexts.append(hit.payload["text"])
        citations.append({
            "source_file": hit.payload["file_path"],
            "excerpt": hit.payload["text"][:150] + "...",
            "score": hit.score
        })
        
    # Format and grounding prompt
    context_block = "\n\n".join([f"Source [{c['source_file']}]: {c['excerpt']}" for c in citations])
    system_prompt = (
        "You are the Vigil Safety Officer Agent. Analyze the operational procedures "
        "and active alarms. Provide hazard mitigations based strictly on the provided context. "
        "Do not hallucinate safety advice."
    )
    user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    
    # Call standardized LLM
    completion = portkey.chat.completions.create(
        model="groq/llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0
    )
    
    generated_text = completion.choices[0].message.content
    
    return {
        "retrieved_contexts": contexts,
        "citations": citations,
        "generated_response": generated_text,
        "ragas_log": {
            "question": query,
            "contexts": contexts,
            "answer": generated_text
        }
    }
```
---

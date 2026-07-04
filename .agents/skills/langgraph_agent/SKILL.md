---
name: langgraph_agent
description: "Use when defining, modifying, or debugging any LangGraph agent node — Copilot, RCA, Compliance, or Lessons-Learned"
---

# LangGraph Agent Skill

This skill defines the guidelines, naming conventions, state schemas, and retrieval behaviors for implementing the 4 query agents using LangGraph in Vigil.

---

## 1. Naming Conventions & Code Style

All LangGraph agent components must follow the conventions in [AGENTS.md Section 5](file:///Users/yashaswinsharma/Documents/github/vigil/AGENTS.md#L102-L109):
1. **Node Functions**: Use `snake_case` prefixed with `run_` or named after the agent's function (e.g., `run_compliance_analysis`, `run_expert_copilot`).
2. **State Keys**: Use `snake_case` for all properties of the state dictionary.
3. **Type Hinting**: Provide strict type annotations (`from typing import TypedDict, List, Dict, Optional, Any`) for all state schemas and node signatures.
4. **Modularity**: Implement individual node logic in helper files; limit node functions to routing, state transformation, and LLM orchestration.

---

## 2. Shared Agent State Schema

All 4 query agents must consume and update a shared LangGraph state schema. This guarantees consistency and compatibility with the RAGAS evaluation logger.

```python
from typing import TypedDict, List, Dict, Any, Optional

class RagasLog(TypedDict):
    question: str
    contexts: List[str]
    answer: str

class Citation(TypedDict):
    source_file: str  # Relative path to OKF file
    excerpt: str      # Matching text fragment from file
    score: float      # Match similarity or rerank score

class AgentState(TypedDict):
    query: str                       # Original user question
    category: str                    # Query category (copilot | rca | compliance | lessons_learned)
    retrieved_contexts: List[str]    # List of retrieved text chunks from OKF & Qdrant
    citations: List[Citation]        # Traceable citations to source OKF concepts
    generated_response: str          # Final generated response text
    ragas_log: Optional[RagasLog]   # RAGAS validation triple
    metadata: Dict[str, Any]         # Custom execution metadata (e.g., pipeline run ID)
```

---

## 3. Querying & Filtering Conventions

The Qdrant retrieval layer must apply directory-level semantic filtering depending on which agent node is executing:

1. **Expert Copilot Node**:
   - **Scope**: Broad RAG search across the entire OKF database (no directory filters).
   - **Strategy**: Semantic embedding query + FlashRank reranking of top 10 results.
2. **Maintenance & RCA Node**:
   - **Scope**: Restrict search query to `equipment/` and `maintenance/` directories.
   - **Strategy**: Locate technical specifications and service logs matching the queried equipment tag, tracing anomalies from alerts.
3. **Compliance Node**:
   - **Scope**: Restrict search query to `procedures/` and `regulations/` directories.
   - **Strategy**: Map active procedure steps directly to relevant code sections in safety/operational regulations (e.g., OSHA, EPA) to cross-reference constraints.
4. **Lessons-Learned Node**:
   - **Scope**: Restrict search query to `maintenance/` and `alerts/` directories.
   - **Strategy**: Match recurring alerts or maintenance failures across multiple timeframes to synthesize generalized optimization patterns.

---

## 4. Error Handling & Traceability Rules

To comply with the **Traceability & Citations** rule in [AGENTS.md Section 4](file:///Users/yashaswinsharma/Documents/github/vigil/AGENTS.md#L77):
- **Zero-Context Guard**: If the retrieval node returns zero relevant OKF contexts, or if all retrieved contexts have a similarity score below the threshold (e.g., `< 0.6` in Qdrant), the agent **must not** attempt to answer the user's query.
- **Fall-back Behavior**: The node must write an explicit response indicating that there is insufficient context in the knowledge graph to answer the query, list the directories searched, and prompt the user to ingest the missing document.
  * *Example Response*: `"Error: Insufficient traceable context found in the local knowledge base to answer this query. Checked directories: procedures/, regulations/. Please ingest relevant regulatory documents to complete this lookup."`

---

## 5. Worked Example: Compliance Agent Node

Here is a compliant node implementation for the Compliance Agent:

```python
import os
from typing import Dict, List, Any
from portkey_ai import Portkey  # LLM Gateway
from qdrant_client import QdrantClient
from fastembed import TextEmbedding

# Helper function representing the Compliance Node
def run_compliance_analysis(state: AgentState) -> Dict[str, Any]:
    """
    Compliance Node: Queries procedures/ and regulations/ to find discrepancies.
    """
    query = state["query"]
    
    # 1. Setup API clients using env variables (No Hardcoding Rule)
    qdrant_client = QdrantClient(
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY")
    )
    portkey = Portkey(api_key=os.getenv("PORTKEY_API_KEY"))
    
    # Generate actual query embedding using FastEmbed
    embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    query_vector = list(next(embedding_model.embed([query])))
    
    # 2. Query Qdrant with filters restricted to procedures/ and regulations/
    search_results = qdrant_client.search(
        collection_name="vigil_okf",
        query_vector=query_vector,
        query_filter={
            "must": [
                {
                    "key": "directory",
                    "match": {"any": ["procedures", "regulations"]}
                }
            ]
        },
        limit=5
    )
    
    # 3. Apply Zero-Context Guard
    if not search_results or search_results[0].score < 0.6:
        response = (
            "Error: Insufficient traceable context found in the local knowledge base "
            "to answer this query. Checked directories: procedures/, regulations/."
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
    
    # 4. Extract contexts and format citations
    contexts: List[str] = []
    citations: List[Citation] = []
    
    for hit in search_results:
        contexts.append(hit.payload["text"])
        citations.append({
            "source_file": hit.payload["file_path"],
            "excerpt": hit.payload["text"][:150] + "...",
            "score": hit.score
        })
        
    # 5. Format LLM prompt with strict grounding instruction
    context_block = "\n\n".join([f"Source [{c['source_file']}]: {c['excerpt']}" for c in citations])
    system_prompt = (
        "You are the Vigil Compliance Agent. Compare the procedures against the regulations "
        "provided in the context below. Identify any safety or regulatory violations. "
        "Ground your answer strictly in the provided sources. Do not hallucinate."
    )
    user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    
    # 6. Execute model call via Portkey gateway (using standardized Groq engine)
    completion = portkey.chat.completions.create(
        model="groq/llama-3.3-70b-versatile",  # Standardized primary reasoning model
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0
    )
    
    generated_text = completion.choices[0].message.content
    
    # 7. Return updated state fields, including RAGAS log structure
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

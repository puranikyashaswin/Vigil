import os
import logging
from typing import List, Dict, Any, Tuple
from fastembed import TextEmbedding
from state import AgentState, Citation, get_qdrant_client

logger = logging.getLogger("vigil.retrieval")
COLLECTION_NAME = "vigil_okf"

# Initialize ONNX embedding model globally once on application startup (FlashRank disabled to conserve memory)
logger.info("Initializing global TextEmbedding model: BAAI/bge-small-en-v1.5...")
_embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

# 3. Retrieval layer with semantic filtering & rerank
def retrieve_contexts(query: str, dirs: List[str] = None) -> Tuple[List[str], List[Citation]]:
    """
    Performs vector search in Qdrant with optional directory filter.
    Applies FlashRank reranker for Copilot (no directory filter).
    """
    try:
        q_client = get_qdrant_client()
        query_vector = list(next(_embedding_model.embed([query])))
        
        query_filter = None
        if dirs:
            from qdrant_client.http import models
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="directory",
                        match=models.MatchAny(any=dirs)
                    )
                ]
            )
            
        search_response = q_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=query_filter,
            limit=10 if not dirs else 5
        )
        search_results = search_response.points
        
        if not search_results:
            return [], []
            
        # If broad search (Copilot), use simple ranking (bypassing FlashRank for memory saving)
        if not dirs:
            contexts = []
            citations = []
            for hit in search_results[:5]:
                contexts.append(hit.payload["text"])
                citations.append({
                    "source_file": hit.payload["file_path"],
                    "excerpt": hit.payload["text"][:150] + "...",
                    "score": float(hit.score)
                })
            return contexts, citations
            
        # Standard directory query
        contexts = []
        citations = []
        for hit in search_results:
            contexts.append(hit.payload["text"])
            citations.append({
                "source_file": hit.payload["file_path"],
                "excerpt": hit.payload["text"][:150] + "...",
                "score": float(hit.score)
            })
        return contexts, citations
        
    except Exception as e:
        logger.error(f"Retrieval failed: {str(e)}")
        return [], []

# Node 2: Retrieve Context Node
def retrieve_context_node(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    category = state["category"]
    
    # Map category to directories
    dirs = None
    if category == "rca":
        dirs = ["equipment", "maintenance"]
    elif category == "compliance":
        dirs = ["procedures", "regulations", "alerts"]
    elif category == "lessons_learned":
        dirs = ["maintenance", "alerts"]
        
    try:
        q_client = get_qdrant_client()
        query_vector = list(next(_embedding_model.embed([query])))
        
        query_filter = None
        if dirs:
            from qdrant_client.http import models
            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="directory",
                        match=models.MatchAny(any=dirs)
                    )
                ]
            )
            
        search_response = q_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=query_filter,
            limit=10 if not dirs else 5
        )
        search_results = search_response.points
        
        raw_hits = []
        for hit in search_results:
            raw_hits.append({
                "text": hit.payload["text"],
                "file_path": hit.payload["file_path"],
                "score": float(hit.score),
                "title": hit.payload["title"]
            })
    except Exception as e:
        logger.error(f"Vector search failed: {str(e)}")
        raw_hits = []
        
    metadata = state.get("metadata") or {}
    trace = metadata.get("trace", []) + ["retrieve_context"]
    new_metadata = {**metadata, "trace": trace, "raw_hits": raw_hits}
    
    return {
        "metadata": new_metadata,
        "retrieved_contexts": [h["text"] for h in raw_hits]
    }

# Node 3: Rerank Context Node
def rerank_context_node(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    category = state["category"]
    metadata = state.get("metadata") or {}
    raw_hits = metadata.get("raw_hits", [])
    
    contexts = []
    citations = []
    
    if not raw_hits:
        trace = metadata.get("trace", []) + ["rerank_context"]
        return {
            "citations": [],
            "retrieved_contexts": [],
            "metadata": {**metadata, "trace": trace, "confidence_score": 0.0}
        }
        
    if category == "copilot":
        for hit in raw_hits[:5]:
            contexts.append(hit["text"])
            citations.append({
                "source_file": hit["file_path"],
                "excerpt": hit["text"][:150] + "...",
                "score": hit["score"]
            })
    else:
        for hit in raw_hits:
            contexts.append(hit["text"])
            citations.append({
                "source_file": hit["file_path"],
                "excerpt": hit["text"][:150] + "...",
                "score": hit["score"]
            })
            
    if citations:
        avg_score = sum(c["score"] for c in citations) / len(citations)
        high_scores = sum(1 for c in citations if c["score"] > 0.6)
        consensus = min(1.0, 0.5 + 0.5 * (high_scores / len(citations)))
        confidence_score = float(avg_score * consensus)
    else:
        confidence_score = 0.0
        
    trace = metadata.get("trace", []) + ["rerank_context"]
    new_metadata = {**metadata, "trace": trace, "confidence_score": confidence_score}
    
    return {
        "citations": citations,
        "retrieved_contexts": contexts,
        "metadata": new_metadata
    }

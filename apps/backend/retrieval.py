import os
import math
import logging
from time import perf_counter
from typing import List, Dict, Any, Tuple
from state import AgentState, Citation, get_qdrant_client

logger = logging.getLogger("vigil.retrieval")
COLLECTION_NAME = "vigil_okf"

_embedding_model = None


def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from fastembed import TextEmbedding
        logger.info("Initializing TextEmbedding model: BAAI/bge-small-en-v1.5 (lazy)...")
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedding_model

_reranker = None


def get_reranker():
    global _reranker
    if _reranker is None:
        from flashrank import Ranker

        logger.info("Initializing FlashRank Ranker...")
        _reranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")
    return _reranker


def compute_confidence(scores: List[float]) -> Dict[str, Any]:
    """
    3-component confidence model:
      relevance  = harmonic mean of scores (penalizes weak outliers)
      consensus  = sigmoid-smoothed fraction of scores above 0.55
      coverage   = unique source diversity (set externally; defaults to 1.0 here)
      final      = 0.5*relevance + 0.3*consensus + 0.2*coverage
    """
    if not scores:
        return {
            "score": 0.0,
            "relevance": 0.0,
            "consensus": 0.0,
            "coverage": 0.0,
            "formula": "0.5R+0.3C+0.2V",
        }

    # Relevance: harmonic mean (handles zeros gracefully)
    safe_scores = [max(s, 0.01) for s in scores]
    relevance = len(safe_scores) / sum(1.0 / s for s in safe_scores)

    # Consensus: sigmoid-smoothed fraction above threshold
    ratio = sum(1 for s in scores if s > 0.55) / len(scores)
    consensus = 1.0 / (1.0 + math.exp(-5.0 * (ratio - 0.5)))

    # Coverage: placeholder (set by caller with unique source count)
    coverage = 1.0

    final = 0.5 * relevance + 0.3 * consensus + 0.2 * coverage

    return {
        "score": round(final, 4),
        "relevance": round(relevance, 4),
        "consensus": round(consensus, 4),
        "coverage": round(coverage, 4),
        "formula": "0.5R+0.3C+0.2V",
    }


# --- BENCHMARK-ONLY FUNCTION (used by scripts/run_retrieval_ablation.py) ---
def retrieve_contexts(
    query: str, dirs: List[str] = None
) -> Tuple[List[str], List[Citation]]:
    """
    BENCHMARK ONLY - not used in the production LangGraph pipeline.
    Used by scripts/run_retrieval_ablation.py for local retrieval quality measurements.
    """
    try:
        q_client = get_qdrant_client()
        query_vector = list(next(get_embedding_model().embed([query])))

        query_filter = None
        if dirs:
            from qdrant_client.http import models

            query_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="directory", match=models.MatchAny(any=dirs)
                    )
                ]
            )

        search_response = q_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=query_filter,
            limit=10 if not dirs else 5,
        )
        search_results = search_response.points

        if not search_results:
            return [], []

        enable_reranking = os.getenv("ENABLE_RERANKING", "false").lower() == "true"

        if enable_reranking and not dirs:
            try:
                from flashrank import RerankRequest

                ranker = get_reranker()
                passages = []
                for i, hit in enumerate(search_results):
                    passages.append(
                        {
                            "id": i,
                            "text": hit.payload["text"],
                            "meta": {
                                "file_path": hit.payload["file_path"],
                                "title": hit.payload["title"],
                                "score": float(hit.score),
                            },
                        }
                    )
                rerank_request = RerankRequest(query=query, passages=passages)
                reranked_results = ranker.rerank(rerank_request)

                contexts = []
                citations = []
                for r in reranked_results[:5]:
                    contexts.append(r["text"])
                    citations.append(
                        {
                            "source_file": r["meta"]["file_path"],
                            "excerpt": r["text"][:150] + "...",
                            "score": float(r["score"]),
                        }
                    )
                return contexts, citations
            except Exception as re_err:
                logger.error(f"FlashRank reranking failed, falling back: {re_err}")

        contexts = []
        citations = []
        for hit in search_results[:5]:
            contexts.append(hit.payload["text"])
            citations.append(
                {
                    "source_file": hit.payload["file_path"],
                    "excerpt": hit.payload["text"][:150] + "...",
                    "score": float(hit.score),
                }
            )
        return contexts, citations

    except Exception as e:
        logger.error(f"Retrieval failed: {str(e)}")
        return [], []


# --- PRODUCTION PIPELINE NODES ---


def retrieve_context_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 2: Broad vector retrieval (no directory filter).
    Runs in PARALLEL with route_intent - does not depend on category.
    """
    t0 = perf_counter()
    query = state["query"]

    try:
        q_client = get_qdrant_client()
        query_vector = list(next(get_embedding_model().embed([query])))

        search_response = q_client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=None,
            limit=10,
        )
        search_results = search_response.points

        raw_hits = []
        for hit in search_results:
            raw_hits.append(
                {
                    "text": hit.payload["text"],
                    "file_path": hit.payload["file_path"],
                    "directory": hit.payload.get("directory", ""),
                    "score": float(hit.score),
                    "title": hit.payload["title"],
                }
            )
    except Exception as e:
        logger.error(f"Vector search failed: {str(e)}")
        raw_hits = []

    elapsed = round((perf_counter() - t0) * 1000, 1)

    return {
        "retrieved_contexts": [h["text"] for h in raw_hits],
        "metadata": {
            "trace": ["retrieve_context"],
            "raw_hits": raw_hits,
            "node_metrics": {
                "retrieve_context": {
                    "latency_ms": elapsed,
                    "vector_hits": len(raw_hits),
                }
            },
        },
    }


def rerank_context_node(state: AgentState) -> Dict[str, Any]:
    """
    Node 3: Directory filtering + optional FlashRank reranking + confidence scoring.
    Runs AFTER both route_intent and retrieve_context complete (fan-in).
    """
    t0 = perf_counter()
    query = state["query"]
    category = state["category"]
    metadata = state.get("metadata") or {}
    raw_hits = metadata.get("raw_hits", [])

    # Directory filter based on routed category
    dir_filter = None
    if category == "rca":
        dir_filter = ["equipment", "maintenance"]
    elif category == "compliance":
        dir_filter = ["procedures", "regulations", "alerts"]
    elif category == "lessons_learned":
        dir_filter = ["maintenance", "alerts"]

    # Apply directory post-filter
    if dir_filter:
        filtered_hits = [h for h in raw_hits if h.get("directory") in dir_filter]
        if not filtered_hits:
            filtered_hits = raw_hits[:5]
    else:
        filtered_hits = raw_hits

    contexts = []
    citations = []

    if not filtered_hits:
        elapsed = round((perf_counter() - t0) * 1000, 1)
        confidence = compute_confidence([])
        return {
            "citations": [],
            "retrieved_contexts": [],
            "metadata": {
                "trace": ["rerank_context"],
                "confidence_score": 0.0,
                "confidence": confidence,
                "node_metrics": {
                    "rerank_context": {"latency_ms": elapsed, "filtered_count": 0}
                },
            },
        }

    enable_reranking = os.getenv("ENABLE_RERANKING", "false").lower() == "true"

    if enable_reranking and category == "copilot" and filtered_hits:
        try:
            from flashrank import RerankRequest

            ranker = get_reranker()
            passages = []
            for i, hit in enumerate(filtered_hits):
                passages.append(
                    {
                        "id": i,
                        "text": hit["text"],
                        "meta": {
                            "file_path": hit["file_path"],
                            "title": hit["title"],
                            "score": hit["score"],
                        },
                    }
                )
            rerank_request = RerankRequest(query=query, passages=passages)
            reranked_results = ranker.rerank(rerank_request)

            for r in reranked_results[:5]:
                contexts.append(r["text"])
                citations.append(
                    {
                        "source_file": r["meta"]["file_path"],
                        "excerpt": r["text"][:150] + "...",
                        "score": float(r["score"]),
                    }
                )
        except Exception as re_err:
            logger.error(f"FlashRank reranking failed in node, falling back: {re_err}")
            for hit in filtered_hits[:5]:
                contexts.append(hit["text"])
                citations.append(
                    {
                        "source_file": hit["file_path"],
                        "excerpt": hit["text"][:150] + "...",
                        "score": hit["score"],
                    }
                )
    else:
        limit = 5
        for hit in filtered_hits[:limit]:
            contexts.append(hit["text"])
            citations.append(
                {
                    "source_file": hit["file_path"],
                    "excerpt": hit["text"][:150] + "...",
                    "score": hit["score"],
                }
            )

    # Confidence scoring
    scores = [c["score"] for c in citations]
    confidence = compute_confidence(scores)

    # Adjust coverage with source diversity
    unique_sources = len(set(c["source_file"] for c in citations))
    coverage = min(1.0, unique_sources / max(len(citations), 1))
    confidence["coverage"] = round(coverage, 4)
    confidence["score"] = round(
        0.5 * confidence["relevance"] + 0.3 * confidence["consensus"] + 0.2 * coverage,
        4,
    )

    elapsed = round((perf_counter() - t0) * 1000, 1)

    return {
        "citations": citations,
        "retrieved_contexts": contexts,
        "metadata": {
            "trace": ["rerank_context"],
            "confidence_score": confidence["score"],
            "confidence": confidence,
            "node_metrics": {
                "rerank_context": {
                    "latency_ms": elapsed,
                    "filtered_count": len(citations),
                }
            },
        },
    }

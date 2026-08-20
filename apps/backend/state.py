import os
import logging
from typing import TypedDict, List, Dict, Any, Optional
from qdrant_client import QdrantClient

# Set up logging
logger = logging.getLogger("vigil.state")


# 1. State Schemas
class RagasLog(TypedDict):
    question: str
    contexts: List[str]
    answer: str


class Citation(TypedDict):
    source_file: str
    excerpt: str
    score: float


class AgentState(TypedDict):
    query: str
    category: str
    retrieved_contexts: List[str]
    citations: List[Citation]
    generated_response: str
    ragas_log: Optional[RagasLog]
    metadata: Dict[str, Any]


_global_qdrant_client: Optional[QdrantClient] = None


# 2. Helpers for clients
def get_qdrant_client() -> QdrantClient:
    global _global_qdrant_client
    if _global_qdrant_client is not None:
        return _global_qdrant_client

    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    if not url or "your_qdrant_url" in url:
        project_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..")
        )
        logger.warning(
            "QDRANT_URL is not configured. Using local SQLite-backed Qdrant DB. "
            "This will degrade under concurrent load. See docs/SCALING.md for production setup."
        )
        _global_qdrant_client = QdrantClient(
            path=os.path.join(project_root, "vigil_qdrant.db")
        )
    else:
        _global_qdrant_client = QdrantClient(url=url, api_key=api_key)
    return _global_qdrant_client

import os
import sys
import json
import logging
from typing import Dict, Any, List
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import zipfile
import io

# Add current path and apps/backend to sys.path
sys.path.append(os.path.dirname(__file__))
from graph import app as graph_app

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("vigil.api")

load_dotenv()
api = FastAPI(title="Vigil Backend API")

# Enable CORS for Next.js development
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
api.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory graph cache
_graph_cache: Dict[str, Any] = {}
_graph_cache_valid: bool = False

RAGAS_LOG_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "logs", "ragas")
)


class QueryRequest(BaseModel):
    query: str


@api.get("/api/health")
def health_check() -> Dict[str, str]:
    qdrant_url = os.getenv("QDRANT_URL", "")
    qdrant_mode = (
        "cloud" if qdrant_url and "your_" not in qdrant_url else "local_sqlite"
    )
    return {"status": "ok", "qdrant_mode": qdrant_mode}


@api.post("/api/query")
def run_query(request: QueryRequest) -> Dict[str, Any]:
    """
    Executes the query through the multi-agent LangGraph.
    """
    logger.info(f"Received query request: '{request.query}'")
    initial_state = {
        "query": request.query,
        "category": "",
        "retrieved_contexts": [],
        "citations": [],
        "generated_response": "",
        "ragas_log": None,
        "metadata": {},
    }

    try:
        final_state = graph_app.invoke(initial_state)

        # RAGAS structured logging
        ragas_entry = final_state.get("ragas_log")
        if ragas_entry:
            os.makedirs(RAGAS_LOG_DIR, exist_ok=True)
            log_path = os.path.join(RAGAS_LOG_DIR, "interactions.jsonl")
            with open(log_path, "a", encoding="utf-8") as lf:
                lf.write(
                    json.dumps({**ragas_entry, "timestamp": datetime.now().isoformat()})
                    + "\n"
                )

        return final_state
    except Exception as e:
        logger.error(f"Error executing agent query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def parse_frontmatter(content: str) -> Dict[str, Any]:
    parts = content.split("---")
    meta = {}
    if len(parts) >= 3:
        frontmatter_raw = parts[1]
        for line in frontmatter_raw.strip().splitlines():
            if ":" in line:
                key, val = line.split(":", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                meta[key] = val
    return meta


import re


@api.get("/api/graph")
def get_graph_data() -> Dict[str, list]:
    """
    Scans the knowledge_graph/ and outputs a nodes/links structure for react-force-graph-2d.
    Uses an in-memory cache to avoid repeated filesystem walks.
    """
    global _graph_cache, _graph_cache_valid
    if _graph_cache_valid and _graph_cache:
        return _graph_cache

    kg_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
    )
    if not os.path.exists(kg_dir):
        return {"nodes": [], "links": []}

    nodes: List[Dict[str, Any]] = []
    links: List[Dict[str, str]] = []
    node_set: set = set()

    # Traverse directories to build nodes
    for root, _, files in os.walk(kg_dir):
        for file in files:
            if file.endswith(".md") and file not in ["index.md", "log.md"]:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, kg_dir)

                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                meta = parse_frontmatter(content)
                node_id = rel_path
                title = meta.get("title", file.replace(".md", ""))
                ent_type = meta.get("type", "concept")

                nodes.append(
                    {
                        "id": node_id,
                        "label": title,
                        "type": ent_type,
                        "description": meta.get("description", ""),
                        "val": 1,
                    }
                )
                node_set.add(node_id)

    # Re-traverse to parse references & build links
    for root, _, files in os.walk(kg_dir):
        for file in files:
            if file.endswith(".md") and file not in ["index.md", "log.md"]:
                file_path = os.path.join(root, file)
                source_id = os.path.relpath(file_path, kg_dir)

                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                # Search for relative links in markdown body
                matches = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content)
                for label, target in matches:
                    if target.startswith(".") or target.startswith(".."):
                        source_dir = os.path.dirname(source_id)
                        target_path = os.path.normpath(
                            os.path.join(source_dir, target)
                        ).replace("\\", "/")

                        if target_path in node_set:
                            link_exists = any(
                                (
                                    l["source"] == source_id
                                    and l["target"] == target_path
                                )
                                or (
                                    l["source"] == target_path
                                    and l["target"] == source_id
                                )
                                for l in links
                            )
                            if not link_exists:
                                rel_type = "REFERENCES"
                                if source_id.startswith(
                                    "alerts/"
                                ) or target_path.startswith("alerts/"):
                                    rel_type = "VIOLATES"
                                elif (
                                    source_id.startswith("regulations/")
                                    and (
                                        target_path.startswith("procedures/")
                                        or target_path.startswith("maintenance/")
                                    )
                                ) or (
                                    target_path.startswith("regulations/")
                                    and (
                                        source_id.startswith("procedures/")
                                        or source_id.startswith("maintenance/")
                                    )
                                ):
                                    rel_type = "COMPLIES_WITH"

                                links.append(
                                    {
                                        "source": source_id,
                                        "target": target_path,
                                        "type": rel_type,
                                    }
                                )

    # Calculate degree of each node to scale node size
    degrees: Dict[str, int] = {n["id"]: 0 for n in nodes}
    for l in links:
        degrees[l["source"]] = degrees.get(l["source"], 0) + 1
        degrees[l["target"]] = degrees.get(l["target"], 0) + 1

    for n in nodes:
        n["val"] = 2 + degrees[n["id"]] * 1.5

    result = {"nodes": nodes, "links": links}
    _graph_cache = result
    _graph_cache_valid = True
    return result


@api.get("/api/alerts")
def get_alerts() -> List[Dict[str, Any]]:
    """
    Parses and returns all active safety/compliance alerts.
    """
    kg_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
    )
    alerts_dir = os.path.join(kg_dir, "alerts")

    if not os.path.exists(alerts_dir):
        return []

    alerts: List[Dict[str, Any]] = []
    for file in os.listdir(alerts_dir):
        if file.endswith(".md") and file not in ["index.md", "log.md"]:
            file_path = os.path.join(alerts_dir, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            meta = parse_frontmatter(content)

            # Simple body extraction
            body_parts = content.split("---")
            body = body_parts[2].strip() if len(body_parts) >= 3 else ""

            alerts.append(
                {
                    "id": file,
                    "title": meta.get("title", file),
                    "description": meta.get("description", ""),
                    "severity": meta.get("severity", "medium"),
                    "confidence_score": float(meta.get("confidence_score", 0.0)),
                    "timestamp": meta.get("timestamp", ""),
                    "content": body,
                }
            )

    # Sort by timestamp descending
    alerts.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return alerts


@api.get("/api/compliance/export")
def export_compliance_package() -> StreamingResponse:
    """
    Auto-generates a compliance evidence zip package containing checklist,
    ingested regulations, active procedures, and contradiction alerts.
    """
    logger.info("Generating compliance evidence package...")
    kg_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
    )

    zip_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            # Generate audit checklist summary markdown
            checklist_content = (
                "# Vigil Compliance Audit & Evidence Package\n\n"
                f"Generated on: {datetime.now().isoformat()}\n"
                "This package serves as verifiable compliance evidence for audit evaluation.\n\n"
                "## Summary of Active Concept Indexes:\n"
            )

            # Traverse directories and add OKF markdown files
            if os.path.exists(kg_dir):
                for root, _, files in os.walk(kg_dir):
                    for file in files:
                        if file.endswith(".md") and file not in ["index.md", "log.md"]:
                            file_path = os.path.join(root, file)
                            rel_path = os.path.relpath(file_path, kg_dir)
                            zip_file.write(file_path, arcname=f"evidence/{rel_path}")

                            # Parse title/description for checklist index
                            try:
                                with open(file_path, "r", encoding="utf-8") as f:
                                    content = f.read()
                                meta = parse_frontmatter(content)
                                checklist_content += f"- **[{meta.get('type', 'concept').upper()}]** {meta.get('title', file)} (`{rel_path}`)\n"
                                if meta.get("description"):
                                    checklist_content += f"  - *Description*: {meta.get('description')}\n"
                            except Exception as parse_err:
                                logger.warning(
                                    f"Could not parse frontmatter for {file}: {str(parse_err)}"
                                )
                                checklist_content += f"- `{rel_path}`\n"

            # Write checklist file to zip
            zip_file.writestr("evidence_checklist.md", checklist_content)
    except Exception as e:
        logger.error(f"Failed to compile compliance evidence ZIP: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate audit package: {str(e)}"
        )

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={
            "Content-Disposition": "attachment; filename=vigil_compliance_evidence.zip"
        },
    )


@api.get("/api/admin/index-all")
def index_all_kg_documents() -> Dict[str, Any]:
    """
    Reads all OKF files from the repository's knowledge_graph/ folder
    and indexes them into the Qdrant Cloud cluster.
    """
    try:
        from scripts.index_graph import (
            load_okf_files,
            get_qdrant_client,
            COLLECTION_NAME,
            chunk_text,
        )
        from retrieval import _embedding_model as embedding_model
        from qdrant_client.http.models import Distance, VectorParams, PointStruct

        kg_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
        )
        if not os.path.exists(kg_dir):
            raise HTTPException(
                status_code=404, detail="knowledge_graph folder not found on server"
            )

        documents = load_okf_files(kg_dir)
        q_client = get_qdrant_client()

        # Recreate collection
        try:
            q_client.delete_collection(COLLECTION_NAME)
        except Exception:
            pass

        q_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE),
        )

        # Create keyword payload index on directory field for strict category filtering on Qdrant Cloud
        from qdrant_client.http.models import PayloadSchemaType

        q_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="directory",
            field_schema=PayloadSchemaType.KEYWORD,
        )

        points = []
        point_id = 1

        for doc in documents:
            chunks = chunk_text(doc["text"])
            for chunk in chunks:
                embed_text = (
                    f"Title: {doc['title']}\nType: {doc['type']}\nContent: {chunk}"
                )
                vector = list(next(embedding_model.embed([embed_text])))
                payload = {
                    "file_path": doc["file_path"],
                    "directory": doc["directory"],
                    "text": chunk,
                    "type": doc["type"],
                    "title": doc["title"],
                }
                points.append(PointStruct(id=point_id, vector=vector, payload=payload))
                point_id += 1

        # Batch upsert
        BATCH_SIZE = 500
        for i in range(0, len(points), BATCH_SIZE):
            batch = points[i : i + BATCH_SIZE]
            q_client.upsert(collection_name=COLLECTION_NAME, points=batch)

        return {
            "status": "success",
            "indexed_documents": len(documents),
            "vectors_count": len(points),
        }
    except Exception as e:
        logger.error(f"Failed admin indexing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api.get("/api/admin/debug-qdrant")
def debug_qdrant_collection() -> Dict[str, Any]:
    try:
        from scripts.index_graph import get_qdrant_client, COLLECTION_NAME

        q_client = get_qdrant_client()

        # Get collection info
        collection_info = q_client.get_collection(COLLECTION_NAME)

        # Scroll points
        points, _ = q_client.scroll(
            collection_name=COLLECTION_NAME,
            limit=5,
            with_payload=True,
            with_vectors=False,
        )

        points_debug = []
        for p in points:
            points_debug.append({"id": p.id, "payload": p.payload})

        return {
            "status": "success",
            "collection_name": COLLECTION_NAME,
            "points_count": collection_info.points_count,
            "status_info": str(collection_info.status),
            "sample_points": points_debug,
        }
    except Exception as e:
        logger.error(f"Debug Qdrant failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(api, host="127.0.0.1", port=8000)

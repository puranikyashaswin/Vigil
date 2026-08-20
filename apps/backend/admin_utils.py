import os
import io
import zipfile
import logging
from datetime import datetime
from typing import Dict, Any, Callable
from fastapi import HTTPException
from state import get_qdrant_client
from scripts.index_graph import load_okf_files, COLLECTION_NAME, chunk_text
from retrieval import _embedding_model as embedding_model
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    PointStruct,
    PayloadSchemaType,
)

logger = logging.getLogger("vigil.admin_utils")


def generate_compliance_zip(
    kg_dir: str, parse_frontmatter_fn: Callable[[str], Dict[str, Any]]
) -> io.BytesIO:
    """
    Auto-generates a compliance evidence zip package containing checklist,
    ingested regulations, active procedures, and contradiction alerts.
    """
    logger.info("Generating compliance evidence package...")
    zip_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            checklist_content = (
                "# Vigil Compliance Audit & Evidence Package\n\n"
                f"Generated on: {datetime.now().isoformat()}\n"
                "This package serves as verifiable compliance evidence for audit evaluation.\n\n"
                "## Summary of Active Concept Indexes:\n"
            )

            if os.path.exists(kg_dir):
                for root, _, files in os.walk(kg_dir):
                    for file in files:
                        if file.endswith(".md") and file not in ["index.md", "log.md"]:
                            file_path = os.path.join(root, file)
                            rel_path = os.path.relpath(file_path, kg_dir)
                            zip_file.write(file_path, arcname=f"evidence/{rel_path}")

                            try:
                                with open(file_path, "r", encoding="utf-8") as f:
                                    content = f.read()
                                meta = parse_frontmatter_fn(content)
                                checklist_content += f"- **[{meta.get('type', 'concept').upper()}]** {meta.get('title', file)} (`{rel_path}`)\n"
                                if meta.get("description"):
                                    checklist_content += f"  - *Description*: {meta.get('description')}\n"
                            except Exception as parse_err:
                                logger.warning(
                                    f"Could not parse frontmatter for {file}: {str(parse_err)}"
                                )
                                checklist_content += f"- `{rel_path}`\n"

            zip_file.writestr("evidence_checklist.md", checklist_content)
    except Exception as e:
        logger.error(f"Failed to compile compliance evidence ZIP: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate audit package: {str(e)}"
        )

    zip_buffer.seek(0)
    return zip_buffer


def perform_kg_indexing(kg_dir: str) -> Dict[str, Any]:
    """
    Reads all OKF files from the repository's knowledge_graph/ folder
    and indexes them into the Qdrant cluster.
    """
    if not os.path.exists(kg_dir):
        raise HTTPException(
            status_code=404, detail="knowledge_graph folder not found on server"
        )

    documents = load_okf_files(kg_dir)
    q_client = get_qdrant_client()

    try:
        q_client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    q_client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=384, distance=Distance.COSINE),
    )

    try:
        q_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="directory",
            field_schema=PayloadSchemaType.KEYWORD,
        )
    except Exception as idx_err:
        logger.warning(f"Payload index creation note: {idx_err}")

    all_chunks = []
    for doc in documents:
        chunks = chunk_text(doc["text"])
        for chunk in chunks:
            all_chunks.append(
                {
                    "doc": doc,
                    "chunk": chunk,
                    "embed_text": f"Title: {doc['title']}\nType: {doc['type']}\nContent: {chunk}",
                }
            )

    embed_texts = [c["embed_text"] for c in all_chunks]
    embeddings = list(embedding_model.embed(embed_texts, batch_size=32))

    points = []
    for idx, (c_info, vector) in enumerate(zip(all_chunks, embeddings), start=1):
        doc = c_info["doc"]
        payload = {
            "file_path": doc["file_path"],
            "directory": doc["directory"],
            "text": c_info["chunk"],
            "type": doc["type"],
            "title": doc["title"],
        }
        points.append(PointStruct(id=idx, vector=list(vector), payload=payload))

    BATCH_SIZE = 500
    for i in range(0, len(points), BATCH_SIZE):
        batch = points[i : i + BATCH_SIZE]
        q_client.upsert(collection_name=COLLECTION_NAME, points=batch)

    return {
        "status": "success",
        "indexed_documents": len(documents),
        "vectors_count": len(points),
    }


def get_debug_collection_info() -> Dict[str, Any]:
    """
    Returns diagnostic statistics about the active Qdrant collection.
    """
    q_client = get_qdrant_client()
    collection_info = q_client.get_collection(COLLECTION_NAME)

    points, _ = q_client.scroll(
        collection_name=COLLECTION_NAME,
        limit=5,
        with_payload=True,
        with_vectors=False,
    )

    points_debug = [{"id": p.id, "payload": p.payload} for p in points]

    return {
        "status": "success",
        "collection_name": COLLECTION_NAME,
        "points_count": collection_info.points_count,
        "status_info": str(collection_info.status),
        "sample_points": points_debug,
    }

import os
import sys
import logging
from typing import Dict, Any, List
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct
from fastembed import TextEmbedding

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.index_graph")

COLLECTION_NAME = "vigil_okf"

def get_qdrant_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    
    if not url or "your_qdrant_url" in url:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        db_path = os.path.join(project_root, "vigil_qdrant.db")
        logger.info(f"Using local persistent Qdrant database ({db_path}) because Qdrant URL is a placeholder.")
        return QdrantClient(path=db_path)
    return QdrantClient(url=url, api_key=api_key)

def load_okf_files(kg_dir: str) -> List[Dict[str, Any]]:
    """
    Recursively scans knowledge_graph/ for .md files and returns parsed entities.
    """
    documents = []
    
    for root, _, files in os.walk(kg_dir):
        for file in files:
            if file.endswith(".md") and file != "index.md" and file != "log.md":
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, kg_dir)
                
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                # Simple markdown frontmatter parser
                parts = content.split("---")
                if len(parts) >= 3:
                    frontmatter_raw = parts[1]
                    body = "---".join(parts[2:]).strip()
                    
                    # Parse basic frontmatter key-values
                    meta = {}
                    for line in frontmatter_raw.strip().splitlines():
                        if ":" in line:
                            key, val = line.split(":", 1)
                            key = key.strip()
                            val = val.strip().strip('"').strip("'")
                            meta[key] = val
                            
                    documents.append({
                        "file_path": rel_path,
                        "directory": os.path.dirname(rel_path),
                        "text": body,
                        "type": meta.get("type", "concept"),
                        "title": meta.get("title", file)
                    })
                    
    return documents

def chunk_text(text: str, max_chars: int = 1000, overlap: int = 200) -> List[str]:
    """
    Splits text into overlapping chunks.
    """
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunks.append(text[start:end])
        start += max_chars - overlap
    return chunks or [text]

def main():
    load_dotenv()
    kg_dir = "knowledge_graph"
    
    if not os.path.exists(kg_dir):
        logger.error(f"Knowledge graph directory not found: {kg_dir}")
        sys.exit(1)
        
    try:
        logger.info("Initializing embedding model: BAAI/bge-small-en-v1.5...")
        embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    except Exception as e:
        logger.error(f"Failed to initialize embedding model: {str(e)}")
        sys.exit(1)
        
    logger.info("Loading OKF files from knowledge graph...")
    try:
        documents = load_okf_files(kg_dir)
        logger.info(f"Found {len(documents)} OKF concept files to index.")
    except Exception as e:
        logger.error(f"Failed to load OKF files: {str(e)}")
        sys.exit(1)
        
    try:
        q_client = get_qdrant_client()
    except Exception as e:
        logger.error(f"Failed to connect to Qdrant client: {str(e)}")
        sys.exit(1)
        
    # Recreate collection to ensure a clean slate
    logger.info(f"Re-creating Qdrant collection: {COLLECTION_NAME}...")
    try:
        q_client.delete_collection(COLLECTION_NAME)
    except Exception as e:
        logger.warning(f"Could not delete collection (might not exist): {str(e)}")
        
    try:
        q_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=384, distance=Distance.COSINE) # bge-small-en-v1.5 size is 384
        )
        
        # Create keyword payload index on directory field for strict category filtering on Qdrant Cloud
        from qdrant_client.http.models import PayloadSchemaType
        q_client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="directory",
            field_schema=PayloadSchemaType.KEYWORD
        )
    except Exception as e:
        logger.error(f"Failed to initialize Qdrant collection structure: {str(e)}")
        sys.exit(1)
    
    points = []
    point_id = 1
    
    for doc in documents:
        try:
            # Generate chunks for each document
            chunks = chunk_text(doc["text"])
            logger.info(f"Splitting '{doc['title']}' into {len(chunks)} chunk(s)")
            
            for i, chunk in enumerate(chunks):
                # Combine frontmatter title/desc with chunk context for better semantic embedding
                embed_text = f"Title: {doc['title']}\nType: {doc['type']}\nContent: {chunk}"
                vector = list(next(embedding_model.embed([embed_text])))
                
                payload = {
                    "file_path": doc["file_path"],
                    "directory": doc["directory"],
                    "text": chunk,
                    "type": doc["type"],
                    "title": doc["title"]
                }
                
                points.append(
                    PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                )
                point_id += 1
        except Exception as e:
            logger.error(f"Failed to process or embed document '{doc['title']}': {str(e)}")
            
    # Batch upsert points in pages of 500 to avoid memory issues
    BATCH_SIZE = 500
    if points:
        logger.info(f"Upserting {len(points)} vector points to Qdrant in batches of {BATCH_SIZE}...")
        for i in range(0, len(points), BATCH_SIZE):
            batch = points[i:i + BATCH_SIZE]
            try:
                q_client.upsert(
                    collection_name=COLLECTION_NAME,
                    points=batch
                )
                logger.info(f"  Upserted batch {i // BATCH_SIZE + 1}/{(len(points) + BATCH_SIZE - 1) // BATCH_SIZE}")
            except Exception as e:
                logger.error(f"Qdrant connection failure or batch upsert error on batch {i // BATCH_SIZE + 1}: {str(e)}")
                sys.exit(1)
    else:
        logger.warning("No vector points generated to upsert.")
        
    logger.info("Vector database indexing complete!")

if __name__ == "__main__":
    main()

import os
import sys
import logging
import re
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Add current path and apps/backend to sys.path
sys.path.append(os.path.dirname(__file__))
from graph import app as graph_app

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.api")

load_dotenv()
api = FastAPI(title="Vigil Backend API")

# Enable CORS for Next.js development
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str

@api.get("/api/health")
def health_check():
    return {"status": "ok"}

@api.post("/api/query")
def run_query(request: QueryRequest):
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
        "metadata": {}
    }
    
    try:
        final_state = graph_app.invoke(initial_state)
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

@api.get("/api/graph")
def get_graph_data():
    """
    Scans the knowledge_graph/ and outputs a nodes/links structure for react-force-graph-3d.
    """
    kg_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph"))
    if not os.path.exists(kg_dir):
        return {"nodes": [], "links": []}
        
    nodes = []
    links = []
    node_set = set()
    
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
                
                nodes.append({
                    "id": node_id,
                    "label": title,
                    "type": ent_type,
                    "description": meta.get("description", ""),
                    "val": 1  # basic weight
                })
                node_set.add(node_id)
                
    # Re-traverse to parse references & build links
    for root, _, files in os.walk(kg_dir):
        for file in files:
            if file.endswith(".md") and file not in ["index.md", "log.md"]:
                file_path = os.path.join(root, file)
                source_id = os.path.relpath(file_path, kg_dir)
                
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    
                # Search for relative links in markdown body: e.g. [Link Text](../equipment/xyz.md)
                matches = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
                for label, target in matches:
                    if target.startswith(".") or target.startswith(".."):
                        # Resolve target path relative to source file
                        source_dir = os.path.dirname(source_id)
                        target_path = os.path.normpath(os.path.join(source_dir, target)).replace("\\", "/")
                        
                        if target_path in node_set:
                            # Avoid duplicate links
                            link_exists = any(
                                (l["source"] == source_id and l["target"] == target_path) or
                                (l["source"] == target_path and l["target"] == source_id)
                                for l in links
                            )
                            if not link_exists:
                                links.append({
                                    "source": source_id,
                                    "target": target_path
                                })
                                
    # Calculate degree of each node to scale node size
    degrees = {n["id"]: 0 for n in nodes}
    for l in links:
        degrees[l["source"]] = degrees.get(l["source"], 0) + 1
        degrees[l["target"]] = degrees.get(l["target"], 0) + 1
        
    for n in nodes:
        n["val"] = 2 + degrees[n["id"]] * 1.5
        
    return {"nodes": nodes, "links": links}

@api.get("/api/alerts")
def get_alerts():
    """
    Parses and returns all active safety/compliance alerts.
    """
    kg_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph"))
    alerts_dir = os.path.join(kg_dir, "alerts")
    
    if not os.path.exists(alerts_dir):
        return []
        
    alerts = []
    for file in os.listdir(alerts_dir):
        if file.endswith(".md") and file not in ["index.md", "log.md"]:
            file_path = os.path.join(alerts_dir, file)
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            meta = parse_frontmatter(content)
            
            # Simple body extraction
            body_parts = content.split("---")
            body = body_parts[2].strip() if len(body_parts) >= 3 else ""
            
            alerts.append({
                "id": file,
                "title": meta.get("title", file),
                "description": meta.get("description", ""),
                "severity": meta.get("severity", "medium"),
                "confidence_score": float(meta.get("confidence_score", 0.0)),
                "timestamp": meta.get("timestamp", ""),
                "content": body
            })
            
    # Sort by timestamp descending
    alerts.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return alerts

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(api, host="127.0.0.1", port=8000)

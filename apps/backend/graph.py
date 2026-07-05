import os
import sys
import re
import logging
from typing import TypedDict, List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from fastembed import TextEmbedding
from langgraph.graph import StateGraph, END

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("vigil.graph")

COLLECTION_NAME = "vigil_okf"

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

# 2. Helpers for clients
def get_qdrant_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    if not url or "your_qdrant_url" in url:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        logger.warning("QDRANT_URL is not configured. Using local SQLite-backed Qdrant DB. "
                        "This will degrade under concurrent load. See docs/SCALING.md for production setup.")
        return QdrantClient(path=os.path.join(project_root, "vigil_qdrant.db"))
    return QdrantClient(url=url, api_key=api_key)

def get_client() -> Tuple[OpenAI, str]:
    groq_api_key = os.getenv("GROQ_API_KEY")
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
    
    is_groq_placeholder = not groq_api_key or "your_" in groq_api_key
    is_portkey_placeholder = not portkey_api_key or "your_" in portkey_api_key
    
    if (is_groq_placeholder or is_portkey_placeholder) and openrouter_api_key and "your_" not in openrouter_api_key:
        client = OpenAI(
            api_key=openrouter_api_key,
            base_url="https://openrouter.ai/api/v1"
        )
        return client, "meta-llama/llama-3.3-70b-instruct"
        
    client = OpenAI(
        api_key=groq_api_key,
        base_url="https://api.portkey.ai/v1",
        default_headers={
            "x-portkey-provider": "groq",
            "x-portkey-api-key": portkey_api_key
        }
    )
    return client, "llama-3.3-70b-versatile"

# 3. Retrieval layer with semantic filtering & rerank
def retrieve_contexts(query: str, dirs: List[str] = None) -> Tuple[List[str], List[Citation]]:
    """
    Performs vector search in Qdrant with optional directory filter.
    Applies FlashRank reranker for Copilot (no directory filter).
    """
    try:
        q_client = get_qdrant_client()
        embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        query_vector = list(next(embedding_model.embed([query])))
        
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
            
        # If broad search (Copilot), use FlashRank reranker
        if not dirs:
            from flashrank import Ranker, RerankRequest
            ranker = Ranker()
            passages = []
            for hit in search_results:
                passages.append({
                    "id": len(passages),
                    "text": hit.payload["text"],
                    "meta": {
                        "file_path": hit.payload["file_path"],
                        "score": hit.score,
                        "title": hit.payload["title"]
                    }
                })
            rerank_request = RerankRequest(query=query, passages=passages)
            rerank_results = ranker.rerank(rerank_request)
            
            contexts = []
            citations = []
            for r in rerank_results[:5]:
                contexts.append(r["text"])
                citations.append({
                    "source_file": r["meta"]["file_path"],
                    "excerpt": r["text"][:150] + "...",
                    "score": float(r["score"])
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

# 4. Intent Routing Node
def route_query_intent(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    client, model = get_client()
    
    system_prompt = (
        "You are an intent router for an industrial knowledge base query engine.\n"
        "Classify the query into one of these 4 categories:\n"
        "1. 'copilot' - for general technical questions, engineering diagram symbols, explanations, or general QA.\n"
        "2. 'rca' - for equipment maintenance log checks, equipment status, failure events, and Root Cause Analysis (RCA).\n"
        "3. 'compliance' - for checking if operational procedures comply with safety regulations (e.g. OSHA standards).\n"
        "4. 'lessons_learned' - for recurring maintenance logs, alerts, warnings, or design failures to synthesize patterns.\n\n"
        "Return ONLY one of these four words: copilot, rca, compliance, lessons_learned. Do not output anything else."
    )
    
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.0
        )
        category = completion.choices[0].message.content.strip().lower()
        if category not in ["copilot", "rca", "compliance", "lessons_learned"]:
            category = "copilot"
    except Exception as e:
        logger.error(f"Intent routing failed: {str(e)}. Defaulting to copilot.")
        category = "copilot"
        
    logger.info(f"Routed query intent: '{query}' -> [{category}]")
    return {"category": category}

# 5. Agent Node Implementations
def run_expert_copilot(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    client, model = get_client()
    contexts, citations = retrieve_contexts(query, dirs=None)

    if not contexts or max(c["score"] for c in citations) < 0.55:
        greeting_prompt = (
            "You are the Vigil Expert Copilot Agent, a conversational AI assistant for an industrial knowledge intelligence platform. "
            "The user's query did not match any documents in the local knowledge base (no relevant equipment specs, procedures, regulations, "
            "or maintenance logs were found). Respond conversationally to the user's message. If they asked a general question or greeted you, "
            "reply helpfully and let them know they can ask about equipment, maintenance, compliance, or safety topics when ready. "
            "If they asked a technical question, politely explain that the knowledge base does not currently contain information on that topic "
            "and suggest ingesting relevant documents. Be concise and friendly."
        )
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": greeting_prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.7
        )
        ans = completion.choices[0].message.content
        return {
            "retrieved_contexts": [],
            "citations": [],
            "generated_response": ans,
            "ragas_log": {"question": query, "contexts": [], "answer": ans}
        }

    context_block = "\n\n".join([f"Source [{citations[i]['source_file']}]: {contexts[i]}" for i in range(len(contexts))])
    system_prompt = (
        "You are the Vigil Expert Copilot Agent. Answer the user's technical query using the provided context. "
        "Ground your answer strictly in the sources. Cite specific documents and parameters. Do not hallucinate."
    )
    user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"

    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0
    )
    ans = completion.choices[0].message.content
    return {
        "retrieved_contexts": contexts,
        "citations": citations,
        "generated_response": ans,
        "ragas_log": {"question": query, "contexts": contexts, "answer": ans}
    }

def get_mock_telemetry_data(tag: str) -> str:
    """
    Generates simulated in-memory telemetry readings for the last 6 hours for specific tags.
    """
    tag = tag.upper().strip()
    if tag == "P-101":
        return (
            f"\n### Real-time Telemetry (Last 6 Hours) for {tag}:\n"
            "| Timestamp | Temp (°C) | Pressure (bar) | Vibration (mm/s) | Motor RPM | Status |\n"
            "| :--- | :---: | :---: | :---: | :---: | :--- |\n"
            "| 09:00 | 44.80 | 29.80 | 1.35 | 1450.5 | Normal |\n"
            "| 10:00 | 45.20 | 30.10 | 1.45 | 1451.2 | Normal |\n"
            "| 11:00 | 48.70 | 34.50 | 1.82 | 1445.0 | Normal |\n"
            "| 12:00 | 53.10 | 39.80 | 2.65 | 1438.1 | Elevated Vibration |\n"
            "| 13:00 | 59.40 | 43.20 | 3.90 | 1430.5 | High Vibration & Pressure |\n"
            "| 14:00 | 66.80 | 47.90 | 5.24 | 1421.0 | ANOMALY: Exceeds Safe Pressure of 45 bar |\n"
        )
    elif tag == "P-102":
        return (
            f"\n### Real-time Telemetry (Last 6 Hours) for {tag}:\n"
            "| Timestamp | Temp (°C) | Pressure (bar) | Vibration (mm/s) | Motor RPM | Status |\n"
            "| :--- | :---: | :---: | :---: | :---: | :--- |\n"
            "| 09:00 | 43.20 | 28.50 | 1.22 | 1448.0 | Normal |\n"
            "| 10:00 | 43.50 | 28.80 | 1.25 | 1449.1 | Normal |\n"
            "| 11:00 | 43.80 | 28.90 | 1.24 | 1448.5 | Normal |\n"
            "| 12:00 | 44.10 | 29.20 | 1.28 | 1450.2 | Normal |\n"
            "| 13:00 | 44.30 | 29.50 | 1.31 | 1449.8 | Normal |\n"
            "| 14:00 | 44.50 | 29.70 | 1.33 | 1450.4 | Normal |\n"
        )
    return f"Real-time sensor telemetry for {tag} shows all metrics are operating within nominal baseline parameters."

def run_maintenance_rca(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    dirs = ["equipment", "maintenance"]
    contexts, citations = retrieve_contexts(query, dirs=dirs)
    
    if not contexts or max(c["score"] for c in citations) < 0.55:
        response = "Error: Insufficient traceable context found in the local knowledge base to answer this query. Checked directories: equipment/, maintenance/."
        return {
            "retrieved_contexts": [],
            "citations": [],
            "generated_response": response,
            "ragas_log": {"question": query, "contexts": [], "answer": response}
        }
        
    # Check for equipment tag in user query to bind mock telemetry
    tag_match = re.search(r"\b[PVT]-[0-9]{3}\b", query.upper())
    telemetry_block = ""
    if tag_match:
        tag = tag_match.group(0)
        telemetry_block = get_mock_telemetry_data(tag)
        logger.info(f"RCA Agent: Fused in-memory live telemetry for tag {tag}")
        
    client, model = get_client()
    context_block = "\n\n".join([f"Source [{citations[i]['source_file']}]: {contexts[i]}" for i in range(len(contexts))])
    
    system_prompt = (
        "You are the Vigil Maintenance & RCA Agent. Analyze the maintenance logs, specifications, and "
        "any real-time IoT sensor telemetry data provided to determine root causes, asset conditions, or anomalous events. "
        "Ground your analysis strictly in the sources (both static logs and live sensor telemetry tables). Do not hallucinate."
    )
    
    user_prompt = f"Historical Context:\n{context_block}\n\n"
    if telemetry_block:
        user_prompt += f"Real-Time Telemetry:\n{telemetry_block}\n\n"
    user_prompt += f"Query: {query}"
    
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0
    )
    ans = completion.choices[0].message.content
    
    # Save fused contexts to state log
    returned_contexts = contexts + [telemetry_block] if telemetry_block else contexts
    return {
        "retrieved_contexts": returned_contexts,
        "citations": citations,
        "generated_response": ans,
        "ragas_log": {"question": query, "contexts": returned_contexts, "answer": ans}
    }

def run_compliance(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    dirs = ["procedures", "regulations", "alerts"]
    contexts, citations = retrieve_contexts(query, dirs=dirs)
    
    if not contexts or max(c["score"] for c in citations) < 0.55:
        response = "Error: Insufficient traceable context found in the local knowledge base to answer this query. Checked directories: procedures/, regulations/, alerts/."
        return {
            "retrieved_contexts": [],
            "citations": [],
            "generated_response": response,
            "ragas_log": {"question": query, "contexts": [], "answer": response}
        }
        
    client, model = get_client()
    context_block = "\n\n".join([f"Source [{citations[i]['source_file']}]: {contexts[i]}" for i in range(len(contexts))])
    system_prompt = (
        "You are the Vigil Compliance Agent. Compare active operating procedures against safety/operational regulations. "
        "Identify violations or discrepancies. Ground your analysis strictly in the sources. Do not hallucinate."
    )
    user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0
    )
    ans = completion.choices[0].message.content
    return {
        "retrieved_contexts": contexts,
        "citations": citations,
        "generated_response": ans,
        "ragas_log": {"question": query, "contexts": contexts, "answer": ans}
    }

def run_lessons_learned(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    dirs = ["maintenance", "alerts"]
    contexts, citations = retrieve_contexts(query, dirs=dirs)
    
    if not contexts or max(c["score"] for c in citations) < 0.55:
        response = "Error: Insufficient traceable context found in the local knowledge base to answer this query. Checked directories: maintenance/, alerts/."
        return {
            "retrieved_contexts": [],
            "citations": [],
            "generated_response": response,
            "ragas_log": {"question": query, "contexts": [], "answer": response}
        }
        
    client, model = get_client()
    context_block = "\n\n".join([f"Source [{citations[i]['source_file']}]: {contexts[i]}" for i in range(len(contexts))])
    system_prompt = (
        "You are the Vigil Lessons-Learned Engine. Review the maintenance logs, alert histories, and recurring issues. "
        "Synthesize generalized optimization rules or design lessons. Ground your analysis strictly in the sources."
    )
    user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.0
    )
    ans = completion.choices[0].message.content
    return {
        "retrieved_contexts": contexts,
        "citations": citations,
        "generated_response": ans,
        "ragas_log": {"question": query, "contexts": contexts, "answer": ans}
    }

# 6. Graph Compilation
workflow = StateGraph(AgentState)

# Add Nodes
workflow.add_node("route_intent", route_query_intent)
workflow.add_node("expert_copilot", run_expert_copilot)
workflow.add_node("maintenance_rca", run_maintenance_rca)
workflow.add_node("compliance", run_compliance)
workflow.add_node("lessons_learned", run_lessons_learned)

# Set Entry
workflow.set_entry_point("route_intent")

# Routing Logic
def route_to_agent(state: AgentState) -> str:
    return state["category"]

# Conditional routing edge
workflow.add_conditional_edges(
    "route_intent",
    route_to_agent,
    {
        "copilot": "expert_copilot",
        "rca": "maintenance_rca",
        "compliance": "compliance",
        "lessons_learned": "lessons_learned"
    }
)

# Connect nodes to end
workflow.add_edge("expert_copilot", END)
workflow.add_edge("maintenance_rca", END)
workflow.add_edge("compliance", END)
workflow.add_edge("lessons_learned", END)

# Compile
app = workflow.compile()

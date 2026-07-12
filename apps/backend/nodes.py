import os
import re
import json
import logging
from typing import Dict, Any
from state import AgentState, RagasLog, Citation
from shared_utils import get_client

logger = logging.getLogger("vigil.nodes")

# Node 1: Intent Routing Node
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
    
    metadata = state.get("metadata") or {}
    trace = ["route_intent"]
    
    return {
        "category": category,
        "metadata": {**metadata, "trace": trace}
    }

def get_mock_telemetry_data(tag: str) -> str:
    """
    Queries simulated live telemetry from mock server on port 8001.
    Falls back to local generation if telemetry server is unreachable.
    """
    tag = tag.upper().strip()
    import httpx
    from datetime import datetime
    
    try:
        response = httpx.get(f"http://127.0.0.1:8001/api/telemetry/{tag}", timeout=1.0)
        if response.status_code == 200:
            data = response.json()
            points = data[-6:]
            
            table = f"\n### Real-time Telemetry (Last 6 Hours) from IoT Mock Server for {tag}:\n"
            table += "| Timestamp | Temp (°C) | Pressure (bar) | Vibration (mm/s) | Motor RPM | Status |\n"
            table += "| :--- | :---: | :---: | :---: | :---: | :--- |\n"
            
            for pt in points:
                dt_str = pt["timestamp"]
                try:
                    dt = datetime.fromisoformat(dt_str)
                    time_label = dt.strftime("%H:%M")
                except Exception:
                    time_label = dt_str[:16].replace("T", " ")
                    
                temp = pt["temperature_celsius"]
                press = pt["pressure_bar"]
                vib = pt["vibration_mm_s"]
                rpm = pt["motor_rpm"]
                
                status = "Normal"
                if tag == "P-101" and press > 45.0:
                    status = "ANOMALY: Exceeds Safe Pressure of 45 bar"
                elif vib > 3.0:
                    status = "High Vibration & Pressure"
                elif vib > 1.8:
                    status = "Elevated Vibration"
                    
                table += f"| {time_label} | {temp:.2f} | {press:.2f} | {vib:.2f} | {rpm:.1f} | {status} |\n"
                
            logger.info(f"RCA Agent: Successfully fetched live telemetry for {tag} from mock server.")
            return table
    except Exception as e:
        logger.warning(f"Mock telemetry server unreachable ({str(e)}). Falling back to in-memory generation.")
        
    # Local fallback
    if tag == "P-101":
        return (
            f"\n### Real-time Telemetry (Last 6 Hours) [LOCAL FALLBACK] for {tag}:\n"
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
            f"\n### Real-time Telemetry (Last 6 Hours) [LOCAL FALLBACK] for {tag}:\n"
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

# Node 4: Synthesize Agent Response Node
def is_failed_generation(ans: str, query: str) -> bool:
    ans_clean = ans.strip()
    
    # 1. Matches known moderation-verdict patterns
    if ans_clean.lower().startswith("user safety:") or ans_clean.lower() in ("safe", "unsafe"):
        return True
        
    # 2. Answer is under 20 words
    words = ans_clean.split()
    if len(words) < 20:
        return True
        
    # 3. Doesn't reference any query terms
    stopwords = {"what", "whats", "the", "for", "and", "are", "but", "not", "you", "your", "this", "that", "with", "from"}
    query_words = re.findall(r"\b[a-zA-Z0-9_-]+\b", query.lower())
    query_terms = [w for w in query_words if len(w) > 2 and w not in stopwords]
    
    if query_terms:
        ans_lower = ans_clean.lower()
        if not any(term in ans_lower for term in query_terms):
            return True
            
    return False

# Node 4: Synthesize Agent Response Node
def synthesize_response_node(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    category = state["category"]
    contexts = state["retrieved_contexts"]
    citations = state["citations"]
    metadata = state.get("metadata") or {}
    
    client, model = get_client()
    
    if not contexts or (citations and max(c["score"] for c in citations) < 0.55):
        greeting_prompt = (
            "You are the Vigil Expert Agent. Explain that no relevant equipment specs, "
            "procedures, regulations, or maintenance logs were found in the knowledge base. "
            "Politely decline to hallucinate and advise the user to ingest relevant source documents."
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
        
        # Check if returned moderation-verdict patterns
        if ans.strip().lower().startswith("user safety:") or ans.strip().lower() in ("safe", "unsafe"):
            logger.warning("Path 1 synthesis returned a safety verdict. Retrying once...")
            try:
                completion = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": greeting_prompt},
                        {"role": "user", "content": query}
                    ],
                    temperature=0.7
                )
                ans = completion.choices[0].message.content
            except Exception:
                ans = ""
            if not ans or ans.strip().lower().startswith("user safety:") or ans.strip().lower() in ("safe", "unsafe"):
                ans = (
                    "Based on the provided sources, there is no information regarding the requested "
                    "equipment or parameters in the ingested documents. Please ensure the relevant source "
                    "documents are ingested into the database."
                )
                
        trace = metadata.get("trace", []) + ["synthesize_response"]
        return {
            "generated_response": ans,
            "metadata": {**metadata, "trace": trace}
        }
        
    telemetry_block = ""
    if category == "rca":
        tag_match = re.search(r"\b[PVT]-[0-9]{3}\b", query.upper())
        if tag_match:
            tag = tag_match.group(0)
            telemetry_block = get_mock_telemetry_data(tag)
            logger.info(f"RCA Agent: Fused in-memory live telemetry for tag {tag}")
            
    context_block = "\n\n".join([f"Source [{citations[i]['source_file']}]: {contexts[i]}" for i in range(len(citations))])
    
    if category == "copilot":
        system_prompt = (
            "You are the Vigil Expert Copilot Agent. Answer the user's technical query using the provided context. "
            "Ground your answer strictly in the sources. Cite specific documents and parameters. Do not hallucinate."
        )
        user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    elif category == "rca":
        system_prompt = (
            "You are the Vigil Maintenance & RCA Agent. Analyze the maintenance logs, specifications, and "
            "any real-time IoT sensor telemetry data provided to determine root causes, asset conditions, or anomalous events. "
            "Ground your analysis strictly in the sources (both static logs and live sensor telemetry tables). Do not hallucinate."
        )
        user_prompt = f"Historical Context:\n{context_block}\n\n"
        if telemetry_block:
            user_prompt += f"Real-Time Telemetry:\n{telemetry_block}\n\n"
        user_prompt += f"Query: {query}"
    elif category == "compliance":
        system_prompt = (
            "You are the Vigil Compliance Agent. Compare active operating procedures against safety/operational regulations. "
            "Identify violations or discrepancies. Ground your analysis strictly in the sources. Do not hallucinate."
        )
        user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    else:
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
    
    if is_failed_generation(ans, query):
        logger.warning("Path 2 synthesis failed validation checks. Retrying once...")
        try:
            completion = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2
            )
            ans = completion.choices[0].message.content
        except Exception as retry_err:
            logger.error(f"Retry synthesis failed: {retry_err}")
            ans = ""
            
        if not ans or is_failed_generation(ans, query):
            logger.warning("Path 2 synthesis failed retry validation. Falling back to default 'not found' response.")
            ans = (
                "Based on the provided sources, there is no information regarding the requested "
                "equipment or parameters in the ingested documents. Please ensure the relevant source "
                "documents are ingested into the database."
            )
            
    final_contexts = contexts + [telemetry_block] if telemetry_block else contexts
    trace = metadata.get("trace", []) + ["synthesize_response"]
    
    return {
        "generated_response": ans,
        "retrieved_contexts": final_contexts,
        "metadata": {**metadata, "trace": trace}
    }

# Node 5: Contradiction Guard Node
def contradiction_guard_node(state: AgentState) -> Dict[str, Any]:
    generated_response = state["generated_response"]
    contexts = state["retrieved_contexts"]
    metadata = state.get("metadata") or {}
    
    if not contexts or "no relevant equipment" in generated_response.lower() or "insufficient" in generated_response.lower():
        trace = metadata.get("trace", []) + ["contradiction_guard"]
        return {
            "metadata": {**metadata, "trace": trace}
        }
        
    client, model = get_client()
    context_block = "\n\n".join([f"Document Chunk: {c}" for c in contexts[:3]])
    
    system_prompt = (
        "You are the Vigil Contradiction Guard. Compare the generated AI answer against the source document chunks "
        "and determine if the generated answer introduces any direct facts, specifications, or setpoints that contradict "
        "the source files. If the answer is fully aligned, output 'SAFE'. If there is a contradiction, output a brief explanation "
        "of the conflict. Be extremely concise. Keep it under 2 sentences."
    )
    
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"AI Answer:\n{generated_response}\n\nSource Documents:\n{context_block}"}
            ],
            temperature=0.0
        )
        guard_output = completion.choices[0].message.content.strip()
        
        # Clean any punctuation or wrapping and check the first word
        first_word = re.findall(r"\b[a-zA-Z]+\b", guard_output)
        first_word_upper = first_word[0].upper() if first_word else ""
        
        if first_word_upper != "SAFE":
            logger.warning(f"Contradiction Guard Flagged Conflict: {guard_output}")
            generated_response = f"⚠️ [SAFETY WARNING: Potential Contradiction Detected]\n{guard_output}\n\n{generated_response}"
    except Exception as e:
        logger.error(f"Contradiction Guard check failed: {str(e)}")
        
    trace = metadata.get("trace", []) + ["contradiction_guard"]
    return {
        "generated_response": generated_response,
        "metadata": {**metadata, "trace": trace}
    }

# Node 6: Log Ragas Metrics Node
def log_ragas_metrics_node(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    contexts = state["retrieved_contexts"]
    generated_response = state["generated_response"]
    metadata = state.get("metadata") or {}
    
    ragas_log = {
        "question": query,
        "contexts": contexts if contexts else [""],
        "answer": generated_response
    }
    
    trace = metadata.get("trace", []) + ["log_metrics"]
    new_metadata = {**metadata, "trace": trace}
    
    try:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        log_dir = os.path.join(project_root, "logs", "ragas")
        os.makedirs(log_dir, exist_ok=True)
        log_path = os.path.join(log_dir, "interactions.jsonl")
        
        from datetime import datetime
        import json
        with open(log_path, "a", encoding="utf-8") as lf:
            lf.write(json.dumps({**ragas_log, "timestamp": datetime.now().isoformat()}) + "\n")
    except Exception as e:
        logger.error(f"Failed to log Ragas metrics to disk: {str(e)}")
        
    return {
        "ragas_log": ragas_log,
        "metadata": new_metadata
    }

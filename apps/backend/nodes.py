import os
import re
import json
import logging
from time import perf_counter
from typing import Dict, Any
from state import AgentState, RagasLog, Citation
from shared_utils import call_llm, LLMResponse

logger = logging.getLogger("vigil.nodes")


def route_query_intent(state: AgentState) -> Dict[str, Any]:
    t0 = perf_counter()
    query = state["query"]

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
        result = call_llm(
            task="route_intent",
            system_prompt=system_prompt,
            user_content=query,
            temperature=0.0,
        )
        category = result.text.strip().lower()
        if category not in ["copilot", "rca", "compliance", "lessons_learned"]:
            category = "copilot"
    except Exception as e:
        logger.error(f"Intent routing failed: {str(e)}. Defaulting to copilot.")
        category = "copilot"
        result = LLMResponse(text="copilot", input_tokens=0, output_tokens=0, model="fallback", latency_ms=0)

    elapsed = round((perf_counter() - t0) * 1000, 1)
    logger.info(f"Routed query intent: '{query}' -> [{category}]")

    return {
        "category": category,
        "metadata": {
            "trace": ["route_intent"],
            "node_metrics": {
                "route_intent": {
                    "latency_ms": elapsed,
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                    "model": result.model,
                }
            },
        },
    }


def get_mock_telemetry_data(tag: str) -> str:
    tag = tag.upper().strip()
    import httpx
    from datetime import datetime

    try:
        response = httpx.get(f"http://127.0.0.1:8001/api/telemetry/{tag}", timeout=1.0)
        if response.status_code == 200:
            data = response.json()
            points = data[-6:]

            table = f"\n### Real-time Telemetry (Last 6 Hours) for {tag}:\n"
            table += "| Timestamp | Temp (C) | Pressure (bar) | Vibration (mm/s) | Motor RPM | Status |\n"
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

            return table
    except Exception as e:
        logger.warning(f"Mock telemetry server unreachable ({str(e)}). Falling back to local.")

    if tag == "P-101":
        return (
            f"\n### Real-time Telemetry (Last 6 Hours) for {tag}:\n"
            "| Timestamp | Temp (C) | Pressure (bar) | Vibration (mm/s) | Motor RPM | Status |\n"
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
            "| Timestamp | Temp (C) | Pressure (bar) | Vibration (mm/s) | Motor RPM | Status |\n"
            "| :--- | :---: | :---: | :---: | :---: | :--- |\n"
            "| 09:00 | 43.20 | 28.50 | 1.22 | 1448.0 | Normal |\n"
            "| 10:00 | 43.50 | 28.80 | 1.25 | 1449.1 | Normal |\n"
            "| 11:00 | 43.80 | 28.90 | 1.24 | 1448.5 | Normal |\n"
            "| 12:00 | 44.10 | 29.20 | 1.28 | 1450.2 | Normal |\n"
            "| 13:00 | 44.30 | 29.50 | 1.31 | 1449.8 | Normal |\n"
            "| 14:00 | 44.50 | 29.70 | 1.33 | 1450.4 | Normal |\n"
        )
    return f"Real-time sensor telemetry for {tag} shows all metrics within nominal baseline parameters."


def is_failed_generation(ans: str, query: str) -> bool:
    ans_clean = ans.strip()
    if ans_clean.lower().startswith("user safety:") or ans_clean.lower() in ("safe", "unsafe"):
        return True
    if len(ans_clean.split()) < 15:
        return True
    stopwords = {"what", "whats", "the", "for", "and", "are", "but", "not", "you", "your", "this", "that", "with", "from"}
    query_words = re.findall(r"\b[a-zA-Z0-9_-]+\b", query.lower())
    query_terms = [w for w in query_words if len(w) > 2 and w not in stopwords]
    if query_terms:
        ans_lower = ans_clean.lower()
        if not any(term in ans_lower for term in query_terms):
            return True
    return False


def synthesize_response_node(state: AgentState) -> Dict[str, Any]:
    t0 = perf_counter()
    query = state["query"]
    category = state["category"]
    contexts = state["retrieved_contexts"]
    citations = state["citations"]
    metadata = state.get("metadata") or {}

    if not contexts or (citations and max(c["score"] for c in citations) < 0.55):
        greeting_prompt = (
            "You are the Vigil Expert Agent. Explain that no relevant equipment specs, "
            "procedures, regulations, or maintenance logs were found in the knowledge base. "
            "Politely decline to hallucinate and advise the user to ingest relevant source documents."
        )
        try:
            result = call_llm(task="generation", system_prompt=greeting_prompt, user_content=query, temperature=0.7)
            ans = result.text
        except Exception:
            ans = (
                "Based on the provided sources, there is no information regarding the requested "
                "equipment or parameters in the ingested documents. Please ensure the relevant source "
                "documents are ingested into the database."
            )
            result = LLMResponse(text=ans, input_tokens=0, output_tokens=0, model="fallback", latency_ms=0)

        elapsed = round((perf_counter() - t0) * 1000, 1)
        return {
            "generated_response": ans,
            "metadata": {
                "trace": ["synthesize_response"],
                "node_metrics": {
                    "synthesize_response": {
                        "latency_ms": elapsed,
                        "input_tokens": result.input_tokens,
                        "output_tokens": result.output_tokens,
                        "model": result.model,
                    }
                },
            },
        }

    telemetry_block = ""
    if category == "rca":
        tag_match = re.search(r"\b[PVT]-[0-9]{3}\b", query.upper())
        if tag_match:
            tag = tag_match.group(0)
            telemetry_block = get_mock_telemetry_data(tag)
            logger.info(f"RCA Agent: Fused live telemetry for tag {tag}")

    context_block = "\n\n".join(
        [f"Source [{citations[i]['source_file']}]: {contexts[i]}" for i in range(len(citations))]
    )

    if category == "copilot":
        system_prompt = (
            "You are the Vigil Expert Copilot Agent. Answer the user's technical query using the provided context.\n\n"
            "RULES:\n"
            "- Ground your answer strictly in the sources. Cite specific documents by name.\n"
            "- Use markdown tables when comparing specifications, parameters, or setpoints.\n"
            "- Use bullet points for procedural steps.\n"
            "- If multiple sources provide different values for the same parameter, present them in a comparison table.\n"
            "- Never hallucinate values not present in the sources.\n\n"
            "FORMAT: Start with a 1-sentence summary, then provide detailed evidence with section headers."
        )
        user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    elif category == "rca":
        system_prompt = (
            "You are the Vigil Maintenance & RCA Agent. Perform root cause analysis using the provided evidence.\n\n"
            "RULES:\n"
            "- Structure your response as: OBSERVATION -> ANALYSIS -> ROOT CAUSE -> RECOMMENDATION\n"
            "- Present sensor readings and thresholds in a comparison table (actual vs. nominal).\n"
            "- Identify the timeline of degradation from maintenance logs.\n"
            "- Cite specific log entries and telemetry timestamps as evidence.\n"
            "- Never hallucinate failure modes not supported by the data.\n\n"
            "FORMAT: Use the 4-section structure above with markdown headers."
        )
        user_prompt = f"Historical Context:\n{context_block}\n\n"
        if telemetry_block:
            user_prompt += f"Real-Time Telemetry:\n{telemetry_block}\n\n"
        user_prompt += f"Query: {query}"
    elif category == "compliance":
        system_prompt = (
            "You are the Vigil Compliance Agent. Audit operational procedures against safety regulations.\n\n"
            "RULES:\n"
            "- Present findings as a compliance matrix table: | Requirement | Procedure | Status | Gap |\n"
            "- Status values: COMPLIANT, NON-COMPLIANT, PARTIAL, UNVERIFIED\n"
            "- Cite the specific regulation clause and procedure section for each finding.\n"
            "- Provide severity (Critical/Major/Minor) for each non-compliance.\n"
            "- Never hallucinate regulations or requirements not in the sources.\n\n"
            "FORMAT: Start with overall compliance score (X/Y requirements met), then detail table."
        )
        user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"
    else:
        system_prompt = (
            "You are the Vigil Lessons-Learned Engine. Synthesize recurring patterns from historical data.\n\n"
            "RULES:\n"
            "- Identify recurring patterns with frequency (e.g., '3 occurrences in 6 months').\n"
            "- Present as: PATTERN -> EVIDENCE -> DESIGN LESSON -> RECOMMENDED ACTION\n"
            "- Use a summary table: | Pattern | Frequency | Severity | Recommended Fix |\n"
            "- Ground every pattern in at least 2 source citations.\n"
            "- Never invent patterns not supported by multiple data points.\n\n"
            "FORMAT: Lead with the pattern summary table, then expand each row."
        )
        user_prompt = f"Context:\n{context_block}\n\nQuery: {query}"

    try:
        result = call_llm(task="generation", system_prompt=system_prompt, user_content=user_prompt, temperature=0.0)
        ans = result.text
    except Exception as e:
        logger.error(f"Generation call failed: {str(e)}")
        ans = ""
        result = LLMResponse(text="", input_tokens=0, output_tokens=0, model="error", latency_ms=0)

    if not ans or is_failed_generation(ans, query):
        logger.warning("Synthesis failed validation. Retrying...")
        try:
            result = call_llm(task="generation", system_prompt=system_prompt, user_content=user_prompt, temperature=0.2)
            ans = result.text
        except Exception:
            ans = ""

        if not ans or is_failed_generation(ans, query):
            ans = (
                "Based on the provided sources, there is no information regarding the requested "
                "equipment or parameters in the ingested documents. Please ensure the relevant source "
                "documents are ingested into the database."
            )

    final_contexts = contexts + [telemetry_block] if telemetry_block else contexts
    elapsed = round((perf_counter() - t0) * 1000, 1)

    return {
        "generated_response": ans,
        "retrieved_contexts": final_contexts,
        "metadata": {
            "trace": ["synthesize_response"],
            "node_metrics": {
                "synthesize_response": {
                    "latency_ms": elapsed,
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                    "model": result.model,
                }
            },
        },
    }


def contradiction_guard_node(state: AgentState) -> Dict[str, Any]:
    t0 = perf_counter()
    generated_response = state["generated_response"]
    contexts = state["retrieved_contexts"]
    metadata = state.get("metadata") or {}
    confidence = metadata.get("confidence", {})

    # Smart skip conditions
    skip_reason = None
    if not contexts:
        skip_reason = "no_contexts"
    elif any(phrase in generated_response.lower() for phrase in [
        "no relevant equipment", "insufficient", "no information regarding",
        "please ensure the relevant source", "outside the scope", "outside my knowledge",
        "falls outside", "not within my knowledge"
    ]):
        skip_reason = "refusal_response"
    elif confidence.get("score", 0) > 0.85 and confidence.get("consensus", 0) > 0.9:
        skip_reason = "high_confidence"
    elif len(generated_response.split()) < 50:
        skip_reason = "short_response"

    if skip_reason:
        elapsed = round((perf_counter() - t0) * 1000, 1)
        logger.info(f"Contradiction guard skipped: {skip_reason}")
        return {
            "metadata": {
                "trace": [f"contradiction_guard:skipped:{skip_reason}"],
                "node_metrics": {"contradiction_guard": {"latency_ms": elapsed, "skipped": skip_reason}},
            }
        }

    # Run the guard
    context_block = "\n\n".join([f"Document Chunk: {c}" for c in contexts[:5]])

    system_prompt = (
        "You are the Vigil Contradiction Guard. Compare the generated AI answer against the source document chunks "
        "and determine if the generated answer introduces any direct facts, specifications, or setpoints that contradict "
        "the source files. If the answer is fully aligned, output 'SAFE'. If there is a contradiction, output a brief explanation "
        "of the conflict. Be extremely concise. Keep it under 2 sentences."
    )

    try:
        result = call_llm(
            task="contradiction_guard",
            system_prompt=system_prompt,
            user_content=f"AI Answer:\n{generated_response}\n\nSource Documents:\n{context_block}",
            temperature=0.0,
        )
        guard_output = result.text.strip()

        first_word = re.findall(r"\b[a-zA-Z]+\b", guard_output)
        first_word_upper = first_word[0].upper() if first_word else ""

        if first_word_upper != "SAFE":
            logger.warning(f"Contradiction Guard Flagged: {guard_output}")
            generated_response = f"⚠️ [SAFETY WARNING: Potential Contradiction Detected]\n{guard_output}\n\n{generated_response}"
    except Exception as e:
        logger.error(f"Contradiction Guard check failed: {str(e)}")
        result = LLMResponse(text="", input_tokens=0, output_tokens=0, model="error", latency_ms=0)

    elapsed = round((perf_counter() - t0) * 1000, 1)
    return {
        "generated_response": generated_response,
        "metadata": {
            "trace": ["contradiction_guard"],
            "node_metrics": {
                "contradiction_guard": {
                    "latency_ms": elapsed,
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                    "model": result.model,
                }
            },
        },
    }


def log_ragas_metrics_node(state: AgentState) -> Dict[str, Any]:
    query = state["query"]
    contexts = state["retrieved_contexts"]
    generated_response = state["generated_response"]
    metadata = state.get("metadata") or {}

    ragas_log = {
        "question": query,
        "contexts": contexts if contexts else [""],
        "answer": generated_response,
    }

    # Aggregate total metrics
    node_metrics = metadata.get("node_metrics", {})
    total_latency = sum(m.get("latency_ms", 0) for m in node_metrics.values())
    total_input = sum(m.get("input_tokens", 0) for m in node_metrics.values())
    total_output = sum(m.get("output_tokens", 0) for m in node_metrics.values())

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
        "metadata": {
            "trace": ["log_metrics"],
            "total_latency_ms": round(total_latency, 1),
            "total_tokens": {"input": total_input, "output": total_output},
        },
    }

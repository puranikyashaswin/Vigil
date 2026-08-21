import os
import sys
import json
import logging
from time import perf_counter
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

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
        return final_state
    except Exception as e:
        logger.error(f"Error executing agent query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api.post("/api/query/stream")
def run_query_stream(request: QueryRequest):
    """
    Streaming version of /api/query. Returns Server-Sent Events:
    - event: step (pipeline progress)
    - event: token (generated text chunks)
    - event: done (final metadata + citations)
    """
    from shared_utils import (
        call_llm,
        is_bedrock_configured,
        _get_bedrock_client,
        MODEL_ROUTER,
        MAX_TOKENS_ROUTER,
        LLMResponse,
    )
    from retrieval import (
        retrieve_context_node,
        rerank_context_node,
        _embedding_model,
        COLLECTION_NAME,
        get_qdrant_client,
        compute_confidence,
    )
    from nodes import (
        route_query_intent,
        get_mock_telemetry_data,
        is_failed_generation,
        contradiction_guard_node,
    )
    from state import AgentState
    import re

    def generate_sse():
        from concurrent.futures import ThreadPoolExecutor

        t_start = perf_counter()
        query = request.query

        # Step 1 & 2: Route intent + Retrieve context (parallel)
        yield f'event: step\ndata: {{"step": 1, "label": "Classifying intent & searching..."}}\n\n'
        state: AgentState = {
            "query": query,
            "category": "",
            "retrieved_contexts": [],
            "citations": [],
            "generated_response": "",
            "ragas_log": None,
            "metadata": {},
        }

        with ThreadPoolExecutor(max_workers=2) as executor:
            route_future = executor.submit(route_query_intent, state)
            retrieve_future = executor.submit(retrieve_context_node, state)
            route_result = route_future.result()
            retrieve_result = retrieve_future.result()

        category = route_result["category"]
        state["category"] = category
        state["metadata"] = route_result["metadata"]

        yield f'event: step\ndata: {{"step": 2, "label": "Search complete"}}\n\n'
        state["retrieved_contexts"] = retrieve_result["retrieved_contexts"]
        state["metadata"] = {**state["metadata"], **retrieve_result["metadata"]}
        if "trace" in state["metadata"] and "trace" in retrieve_result["metadata"]:
            state["metadata"]["trace"] = state["metadata"].get("trace", [])
            if "retrieve_context" not in state["metadata"]["trace"]:
                state["metadata"]["trace"].append("retrieve_context")

        # Step 3: Rerank
        yield f'event: step\ndata: {{"step": 3, "label": "Ranking results..."}}\n\n'
        rerank_result = rerank_context_node(state)
        state["citations"] = rerank_result["citations"]
        state["retrieved_contexts"] = rerank_result["retrieved_contexts"]
        for k, v in rerank_result.get("metadata", {}).items():
            if k == "node_metrics":
                state["metadata"].setdefault("node_metrics", {}).update(v)
            elif k == "trace":
                state["metadata"].setdefault("trace", []).extend(v)
            else:
                state["metadata"][k] = v

        citations = state["citations"]
        contexts = state["retrieved_contexts"]

        # Step 4: Stream generation
        yield f'event: step\ndata: {{"step": 4, "label": "Generating response..."}}\n\n'
        yield f'event: category\ndata: {{"category": "{category}"}}\n\n'

        # Build the prompt (same logic as synthesize_response_node)
        no_docs_path = False
        if not contexts or (citations and max(c["score"] for c in citations) < 0.55):
            citations = []
            no_docs_path = True

            query_lower = query.strip().lower().rstrip("!?.")
            greeting_tokens = {"hi", "hii", "hello", "hey", "hola", "howdy", "sup",
                               "good morning", "good afternoon", "good evening",
                               "whats up", "what's up", "yo"}
            is_greeting = query_lower in greeting_tokens or (
                len(query.split()) <= 3 and any(g in query_lower for g in {"hi", "hello", "hey"})
            )

            if is_greeting:
                system_prompt = (
                    "You are Vigil, an industrial knowledge intelligence assistant. "
                    "The user has greeted you. Respond with a brief, professional greeting (1-2 sentences). "
                    "Mention you can help with equipment specs, maintenance, compliance, and root cause analysis. "
                    "Do NOT use emojis. Keep it concise."
                )
            else:
                system_prompt = (
                    "You are the Vigil Expert Agent. No relevant documents were found for this query. "
                    "Briefly state this and suggest rephrasing or ingesting relevant source documents. "
                    "Do NOT use emojis. Keep it under 3 sentences."
                )
            user_prompt = query
        else:
            telemetry_block = ""
            if category == "rca":
                tag_match = re.search(r"\b[PVT]-[0-9]{3}\b", query.upper())
                if tag_match:
                    telemetry_block = get_mock_telemetry_data(tag_match.group(0))

            context_block = "\n\n".join(
                [
                    f"Source [{citations[i]['source_file']}]: {contexts[i]}"
                    for i in range(len(citations))
                ]
            )

            if category == "copilot":
                system_prompt = (
                    "You are the Vigil Expert Copilot Agent. Answer the user's technical query using the provided context.\n\n"
                    "RULES:\n- Ground your answer strictly in the sources. Cite specific documents by name.\n"
                    "- Use markdown tables when comparing specifications.\n- Never hallucinate.\n\n"
                    "FORMAT: Start with a 1-sentence summary, then detailed evidence."
                )
            elif category == "rca":
                system_prompt = (
                    "You are the Vigil Maintenance & RCA Agent.\n\nRULES:\n"
                    "- Structure as: OBSERVATION -> ANALYSIS -> ROOT CAUSE -> RECOMMENDATION\n"
                    "- Present readings in comparison tables. Cite log entries.\n- Never hallucinate."
                )
            elif category == "compliance":
                system_prompt = (
                    "You are the Vigil Compliance Agent.\n\nRULES:\n"
                    "- Present as compliance matrix: | Requirement | Procedure | Status | Gap |\n"
                    "- Status: COMPLIANT, NON-COMPLIANT, PARTIAL, UNVERIFIED\n"
                    "- Start with overall score. Never hallucinate regulations."
                )
            else:
                system_prompt = (
                    "You are the Vigil Lessons-Learned Engine.\n\nRULES:\n"
                    "- Summary table: | Pattern | Frequency | Severity | Fix |\n"
                    "- Ground every pattern in 2+ citations. Never invent patterns."
                )

            user_prompt = f"Context:\n{context_block}\n\n"
            if telemetry_block:
                user_prompt += f"Real-Time Telemetry:\n{telemetry_block}\n\n"
            user_prompt += f"Query: {query}"

        # Stream tokens from Bedrock
        full_response = ""
        t_gen_start = perf_counter()
        input_tokens = 0
        output_tokens = 0

        if is_bedrock_configured():
            try:
                client = _get_bedrock_client()
                model = MODEL_ROUTER.get("generation", "us.anthropic.claude-sonnet-4-6")
                max_tok = MAX_TOKENS_ROUTER.get("generation", 4096)

                with client.messages.stream(
                    model=model,
                    max_tokens=max_tok,
                    temperature=0.0,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                ) as stream:
                    for text in stream.text_stream:
                        full_response += text
                        escaped = json.dumps(text)
                        yield f'event: token\ndata: {{"token": {escaped}}}\n\n'

                    final_message = stream.get_final_message()
                    input_tokens = final_message.usage.input_tokens
                    output_tokens = final_message.usage.output_tokens
            except Exception as e:
                logger.error(f"Streaming generation failed: {str(e)}")
                full_response = "Error generating response. Please try again."
                yield f'event: token\ndata: {{"token": {json.dumps(full_response)}}}\n\n'
        else:
            try:
                result = call_llm(
                    task="generation",
                    system_prompt=system_prompt,
                    user_content=user_prompt,
                    temperature=0.0,
                )
                full_response = result.text
                input_tokens = result.input_tokens
                output_tokens = result.output_tokens
                yield f'event: token\ndata: {{"token": {json.dumps(full_response)}}}\n\n'
            except Exception as e:
                full_response = "Error generating response."
                yield f'event: token\ndata: {{"token": {json.dumps(full_response)}}}\n\n'

        gen_latency = round((perf_counter() - t_gen_start) * 1000, 1)

        # Step 5: Contradiction guard (skip logic inline)
        yield f'event: step\ndata: {{"step": 5, "label": "Safety check..."}}\n\n'
        confidence = state["metadata"].get("confidence", {})
        guard_skipped = True
        if (
            contexts
            and confidence.get("score", 0) <= 0.85
            and len(full_response.split()) >= 50
            and not any(
                p in full_response.lower()
                for p in ["no relevant", "falls outside", "outside the scope"]
            )
        ):
            guard_skipped = False
            try:
                guard_result = call_llm(
                    task="contradiction_guard",
                    system_prompt="Compare the AI answer against source documents. Output 'SAFE' if aligned, else brief explanation.",
                    user_content=f"AI Answer:\n{full_response}\n\nSources:\n{chr(10).join(contexts[:5])}",
                    temperature=0.0,
                )
                guard_text = guard_result.text.strip()
                first_word = re.findall(r"\b[a-zA-Z]+\b", guard_text)
                if first_word and first_word[0].upper() != "SAFE":
                    warning = f"⚠️ [SAFETY WARNING: Potential Contradiction Detected]\n{guard_text}\n\n"
                    full_response = warning + full_response
                    yield f'event: warning\ndata: {{"warning": {json.dumps(guard_text)}}}\n\n'
            except Exception:
                pass

        # Step 6: Done
        yield f'event: step\ndata: {{"step": 6, "label": "Complete"}}\n\n'

        total_latency = round((perf_counter() - t_start) * 1000, 1)

        if no_docs_path:
            final_trace = ["route_intent", "synthesize_response"]
        else:
            final_trace = state["metadata"].get("trace", []) + [
                "synthesize_response", "contradiction_guard", "log_metrics"
            ]

        done_payload = {
            "generated_response": full_response,
            "category": category,
            "citations": citations,
            "metadata": {
                **state["metadata"],
                "trace": final_trace,
                "node_metrics": {
                    **state["metadata"].get("node_metrics", {}),
                    "synthesize_response": {
                        "latency_ms": gen_latency,
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                    },
                    "contradiction_guard": {"skipped": guard_skipped},
                },
                "total_latency_ms": total_latency,
                "total_tokens": {"input": input_tokens, "output": output_tokens},
            },
        }
        yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


from fastapi import UploadFile, File


@api.post("/api/ingest/upload")
def ingest_upload(files: List[UploadFile] = File(...)):
    """
    Real file upload + processing endpoint with SSE streaming progress.
    """
    import tempfile
    import shutil
    from datetime import datetime
    from parsers import (
        detect_document_type,
        parse_pdf_local,
        parse_docx_local,
        parse_xlsx_local,
        parse_xls_local,
        parse_csv_local,
        parse_via_vision_ocr,
    )
    from scripts.test_extraction import run_extraction_flow
    from scripts.okf_utils import slugify, init_okf_dir, append_to_index, append_to_log
    from scripts.contradiction import check_contradiction, find_pairs_to_check
    from admin_utils import perform_kg_indexing

    DIR_MAP = {
        "concept": "equipment",
        "drawing": "equipment",
        "procedure": "procedures",
        "regulation": "regulations",
        "maintenance_log": "maintenance",
        "alert": "alerts",
    }

    kg_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
    )

    def generate_ingest_sse():
        global _graph_cache_valid
        tmp_dir = tempfile.mkdtemp(prefix="vigil_ingest_")
        all_new_entities = []
        new_node_ids = []

        try:
            # Save uploaded files to temp
            saved_files = []
            for f in files:
                tmp_path = os.path.join(tmp_dir, f.filename)
                with open(tmp_path, "wb") as out:
                    content = f.file.read()
                    out.write(content)
                saved_files.append((f.filename, tmp_path))

            total = len(saved_files)

            for idx, (filename, file_path) in enumerate(saved_files):
                yield f"event: file_start\ndata: {json.dumps({'file': filename, 'index': idx, 'total': total})}\n\n"

                # Step 1: Parse
                yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 1, 'label': 'Parsing document...', 'status': 'running'})}\n\n"
                try:
                    category, ext = detect_document_type(file_path)
                    if category == "image" or category == "scanned_pdf":
                        parsed_text, _ = parse_via_vision_ocr(file_path)
                    elif category == "text_native_pdf":
                        parsed_text = parse_pdf_local(file_path)
                    elif category == "text_native_docx":
                        parsed_text = parse_docx_local(file_path)
                    elif category == "spreadsheet":
                        if ext == ".csv":
                            parsed_text = parse_csv_local(file_path)
                        elif ext == ".xls":
                            parsed_text = parse_xls_local(file_path)
                        else:
                            parsed_text = parse_xlsx_local(file_path)
                    else:
                        parsed_text = f"Document: {filename}\n(Unsupported format)"

                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 1, 'label': f'Parsed ({category})', 'status': 'complete'})}\n\n"
                except Exception as e:
                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 1, 'label': f'Parse failed: {str(e)[:60]}', 'status': 'error'})}\n\n"
                    continue

                # Step 2: Extract entities
                yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 2, 'label': 'Extracting entities...', 'status': 'running'})}\n\n"
                try:
                    fallback_title = os.path.splitext(filename)[0]
                    entities_list = run_extraction_flow(parsed_text, fallback_title)
                    entities = [e.model_dump() for e in entities_list.entities]
                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 2, 'label': f'Extracted {len(entities)} entities', 'status': 'complete'})}\n\n"
                except Exception as e:
                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 2, 'label': f'Extraction failed: {str(e)[:60]}', 'status': 'error'})}\n\n"
                    continue

                # Step 3: Write OKF files
                yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 3, 'label': 'Writing to knowledge graph...', 'status': 'running'})}\n\n"
                try:
                    for ent in entities:
                        ent_type = ent.get("type", "concept")
                        sub_dir = DIR_MAP.get(ent_type, "equipment")
                        slug = slugify(ent["name"])
                        ent_filename = f"{slug}.md"
                        rel_path = f"{sub_dir}/{ent_filename}"
                        ent["rel_path"] = rel_path
                        ent["sub_dir"] = sub_dir
                        ent["filename"] = ent_filename

                        dir_full_path = os.path.join(kg_dir, sub_dir)
                        init_okf_dir(dir_full_path)

                        body_lines = [
                            f"---\ntype: {ent_type}",
                            f'title: "{ent["name"]}"',
                            f'description: "{ent.get("description", "")}"',
                            f'resource: "upload/{filename}"',
                            f"tags: {ent.get('tags', [])}",
                            f"timestamp: {datetime.now().isoformat()}",
                            "---\n",
                            f"# {ent['name']}\n",
                            ent.get("description", ""),
                            "\n## References & Links",
                            "No links established.",
                        ]

                        full_path = os.path.join(kg_dir, rel_path)
                        with open(full_path, "w", encoding="utf-8") as out_f:
                            out_f.write("\n".join(body_lines) + "\n")

                        append_to_index(
                            dir_full_path,
                            ent_filename,
                            ent["name"],
                            ent.get("description", ""),
                        )
                        append_to_log(
                            dir_full_path,
                            "INGEST",
                            f"Ingested {ent['name']} from upload/{filename}",
                        )

                        new_node_ids.append(rel_path)
                        all_new_entities.append(ent)

                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 3, 'label': f'Wrote {len(entities)} OKF files', 'status': 'complete'})}\n\n"
                except Exception as e:
                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 3, 'label': f'Write failed: {str(e)[:60]}', 'status': 'error'})}\n\n"

                # Step 4: Contradiction detection
                yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 4, 'label': 'Checking contradictions...', 'status': 'running'})}\n\n"
                contradictions_found = 0
                try:
                    file_map = {
                        e["name"].lower(): e.get("rel_path", "")
                        for e in all_new_entities
                    }
                    pairs = find_pairs_to_check(entities, file_map)
                    for ent_a, ent_b in pairs[:5]:
                        res = check_contradiction(ent_a, ent_b)
                        if (
                            res.get("contradiction_detected")
                            and res.get("confidence_score", 0) > 0.7
                        ):
                            contradictions_found += 1
                            yield f"event: contradiction\ndata: {json.dumps({'file': filename, 'detected': True, 'severity': res.get('severity', 'medium'), 'explanation': res.get('explanation', '')[:100]})}\n\n"

                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 4, 'label': f'{contradictions_found} conflicts found', 'status': 'complete'})}\n\n"
                except Exception as e:
                    yield f"event: step\ndata: {json.dumps({'file': filename, 'step': 4, 'label': f'Check skipped: {str(e)[:40]}', 'status': 'complete'})}\n\n"

                yield f"event: file_complete\ndata: {json.dumps({'file': filename, 'entities_count': len(entities), 'contradictions': contradictions_found})}\n\n"

            # Step 5: Re-index everything
            yield f"event: step\ndata: {json.dumps({'file': 'all', 'step': 5, 'label': 'Indexing vectors...', 'status': 'running'})}\n\n"
            try:
                perform_kg_indexing(kg_dir)
                _graph_cache_valid = False
                yield f"event: step\ndata: {json.dumps({'file': 'all', 'step': 5, 'label': 'Vectors indexed', 'status': 'complete'})}\n\n"
            except Exception as e:
                yield f"event: step\ndata: {json.dumps({'file': 'all', 'step': 5, 'label': f'Index error: {str(e)[:40]}', 'status': 'error'})}\n\n"

            # Done
            yield f"event: done\ndata: {json.dumps({'total_files': total, 'total_entities': len(all_new_entities), 'new_node_ids': new_node_ids})}\n\n"

        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    return StreamingResponse(
        generate_ingest_sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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


from admin_utils import (
    generate_compliance_zip,
    perform_kg_indexing,
    get_debug_collection_info,
)


@api.get("/api/compliance/export")
def export_compliance_package() -> StreamingResponse:
    """
    Auto-generates a compliance evidence zip package containing checklist,
    ingested regulations, active procedures, and contradiction alerts.
    """
    kg_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
    )
    zip_buffer = generate_compliance_zip(kg_dir, parse_frontmatter)
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
    global _graph_cache_valid
    kg_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "knowledge_graph")
    )
    result = perform_kg_indexing(kg_dir)
    _graph_cache_valid = False
    return result


@api.on_event("startup")
def auto_seed_knowledge_graph_on_startup() -> None:
    """
    Ensures that Qdrant is populated with OKF concept embeddings on server boot.
    Runs in a background thread so the port binds immediately.
    """
    import threading

    def _seed():
        try:
            from state import get_qdrant_client
            from scripts.index_graph import COLLECTION_NAME

            q_client = get_qdrant_client()
            has_points = False
            try:
                info = q_client.get_collection(COLLECTION_NAME)
                if (info.points_count or 0) > 0:
                    has_points = True
            except Exception:
                has_points = False

            if not has_points:
                logger.info(
                    "Qdrant collection empty on startup. Auto-indexing knowledge graph..."
                )
                index_all_kg_documents()
                logger.info("Auto-indexing on startup completed successfully.")
        except Exception as e:
            logger.warning(
                f"Auto-seeding knowledge graph on startup failed (non-fatal): {str(e)}"
            )

    threading.Thread(target=_seed, daemon=True).start()


@api.get("/api/admin/debug-qdrant")
def debug_qdrant_collection() -> Dict[str, Any]:
    try:
        return get_debug_collection_info()
    except Exception as e:
        logger.error(f"Debug Qdrant failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(api, host="127.0.0.1", port=8000)

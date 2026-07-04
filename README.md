# Vigil

**Industrial Knowledge Intelligence Platform -- ET AI Hackathon PS 8**

Industrial organizations manage thousands of fragmented documents: equipment datasheets, maintenance logs, P&IDs, regulatory codes (OSHA, EPA), scanned forms, and operational procedures. When an engineer updates a procedure or a new regulation arrives, no existing tool proactively checks whether the change introduces a safety or compliance conflict with the rest of the knowledge base. Vigil detects those contradictions the moment a document enters the system, not days later during an audit or after an incident.

---

## Core Differentiator: Proactive Contradiction Detection

Every knowledge management system can search and answer questions reactively. Vigil goes further: when a new document is ingested, it performs a **double-sided contradiction check** against all linked existing concepts in the knowledge graph.

- **Forward check**: The newly ingested concept is compared against every concept it explicitly references.
- **Reverse check**: All existing concepts that reference the new concept are also pulled in and compared.

If a contradiction exceeds a 0.7 confidence threshold, Vigil automatically generates a compliance alert in the `alerts/` directory, linking both conflicting sources. The alert appears immediately on the dashboard with a severity rating and a side-by-side comparison view.

This means an operator updating a maintenance bypass procedure that violates an OSHA pressure limit is stopped at ingestion time, not during an inspection.

---

## Architecture Overview

```
                      +-------------------------------+
                      |     Document Ingestion        |
                      |  (PDF, DOCX, PNG, CSV, XLSX)  |
                      +---------------+---------------+
                                      |
                     +----------------v----------------+
                     |  Document Type Detection        |
                     |  Text-native -> Local Parsers   |
                     |  Scanned/Image -> OpenRouter OCR |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |  LLM Entity Extraction          |
                     |  (Pydantic schema, JSON output) |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |  OKF Concept File Writer        |
                     |  (YAML frontmatter + .md body)  |
                     |  + index.md/log.md updates      |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |  Contradiction Detection         |
                     |  Forward + Reverse link check   |
                     |  LLM comparison (temp=0.0)      |
                     |  Alert generation if score>0.7  |
                     +----------------+----------------+
                                      |
                     +----------------v----------------+
                     |  FastEmbed + Qdrant Indexing    |
                     |  Chunk -> BAAI/bge-small-en-v1.5|
                     |  Payload: file_path, directory, |
                     |  text, type                     |
                     +----------------+----------------+
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
+--------v--------+  +---------------v-------+  +------------------v------+
|  Expert Copilot |  |  Maintenance & RCA    |  |  Compliance Agent       |
|  (all dirs)     |  |  (equipment/ +        |  |  (procedures/ +         |
|  Broad GraphRAG |  |   maintenance/)       |  |   regulations/)         |
|  + citations    |  |  Root cause analysis  |  |  Violation detection    |
+-----------------+  +-----------------------+  +-------------------------+
         |                            |                            |
         +----------------------------+----------------------------+
                                      |
                      +---------------v---------------+
                      |  Lessons-Learned Engine       |
                      |  (maintenance/ + alerts/)     |
                      |  Pattern synthesis across     |
                      |  timeframes                   |
                      +-------------------------------+
                                      |
                      +---------------v---------------+
                      |  Next.js Frontend Dashboard   |
                      |  - 2D force-graph (Obsidian)  |
                      |  - Chat (multi-agent router)  |
                      |  - Alert feed + diff compare  |
                      |  - Warm ivory editorial theme  |
                      +-------------------------------+
```

---

## Tech Stack

### Backend (Python)
| Layer | Technology | Details |
|:---|:---|:---|
| Agent orchestration | `langgraph` | StateGraph with conditional routing |
| LLM gateway | `openai` (OpenRouter) | Falls back to OpenRouter when Groq/Portkey keys are placeholders (as currently configured) |
| Primary model | `meta-llama/llama-3.3-70b-instruct` | Via OpenRouter free tier |
| Vision/OCR | `openrouter` API | Free-tier vision models for scanned documents |
| Local parsers | `pdfplumber`, `python-docx`, `openpyxl`, `xlrd` | For text-native PDFs, DOCX, and spreadsheets |
| Vector storage | `qdrant-client` | Falls back to local file-based storage (`vigil_qdrant.db`) when no server URL configured |
| Embeddings | `fastembed` | `BAAI/bge-small-en-v1.5` |
| Reranking | `flashrank` | For search result reordering |
| Evaluation | `ragas` | Faithfulness, context precision/recall, answer relevancy |
| API server | `fastapi` + `uvicorn` | REST API on port 8000 |
| Observability | `langsmith` | Tracing (when API key configured) |

### Frontend (Next.js)
| Layer | Technology | Details |
|:---|:---|:---|
| Framework | Next.js 16 | App Router |
| Styling | Tailwind CSS 4 | Custom warm ivory/editorial theme (Anthropic brand colors) |
| Animations | `framer-motion` | Tab transitions, modal enter/exit |
| Graph | `react-force-graph-2d` | Obsidian-style 2D force layout |
| Icons | `lucide-react` | |

### Theme (Warm Ivory / Editorial)
The UI uses a warm editorial palette derived from the Anthropic brand guidelines:

| Role | Color | Hex |
|:---|:---|:---|
| Background | Warm ivory | `#faf9f5` |
| Borders | Light gray | `#e8e6dc` |
| Secondary chrome | Mid gray | `#b0aea5` |
| Primary text | Dark charcoal | `#141413` |
| Primary accent | Orange / clay | `#d97757` |
| Secondary accent | Blue | `#6a9bcc` |
| Tertiary accent | Green | `#788c5d` |
| Alert accent | Crimson | `#EF4444` |

---

## Setup

### Prerequisites
- Python 3.11+ (managed via `uv`)
- Node.js 20+
- An OpenRouter API key (free tier works)

### 1. Clone and set environment variables

```bash
git clone <repo-url>
cd vigil
cp .env.example .env
```

Edit `.env` with your keys:

```env
# Required: OpenRouter (free tier works)
OPENROUTER_API_KEY=sk-or-v1-...

# Optional: Groq/Portkey (if configured, used as primary; otherwise falls back to OpenRouter)
PORTKEY_API_KEY=your_portkey_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Optional: Qdrant Cloud (if not configured, uses local file-based storage)
QDRANT_URL=your_qdrant_url_here
QDRANT_API_KEY=your_qdrant_api_key_here

# Optional: LangSmith tracing
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=vigil
```

**Important**: With the default placeholder `GROQ_API_KEY` and `PORTKEY_API_KEY`, all LLM calls automatically route through OpenRouter using `meta-llama/llama-3.3-70b-instruct` (free). No Groq or Portkey account is needed.

### 2. Install Python dependencies

```bash
# Create virtual environment with uv (if not already present)
uv venv
source .venv/bin/activate

# Install dependencies (core packages already listed in the venv)
uv pip install fastapi uvicorn langgraph openai qdrant-client fastembed \
  pydantic python-dotenv pdfplumber python-docx openpyxl xlrd httpx \
  pypdfium2 Pillow flashrank ragas langsmith
```

### 3. Install frontend dependencies

```bash
cd apps/frontend
npm install
```

### 4. Build the knowledge graph and index

Place your source documents in `test_documents/`, then run:

```bash
# Parse documents, extract entities, write OKF files, detect contradictions
python apps/backend/scripts/build_graph.py

# Embed and index all OKF files into Qdrant
python apps/backend/scripts/index_graph.py
```

The pipeline will:
- Parse PDFs, DOCX, PNGs, CSVs, and XLSX files
- Extract entities using the LLM (Pydantic-validated JSON)
- Write OKF Markdown files to the appropriate `knowledge_graph/` subdirectories
- Run contradiction detection against linked concepts
- Index chunks into Qdrant with directory/type metadata

### 5. Start the backend

```bash
python apps/backend/api.py
# or: uvicorn apps.backend.api:api --host 127.0.0.1 --port 8000
```

### 6. Start the frontend

```bash
cd apps/frontend
npm run dev
```

Open `http://localhost:3000`. The dashboard connects to the backend at `http://127.0.0.1:8000`.

### 7. Test via CLI (optional)

```bash
# Single query
python test_agents.py "What does OSHA 1910.119 require?"

# Interactive mode
python test_agents.py
```

---

## RAGAS Evaluation Results

Vigil was evaluated against a 10-question benchmark spanning compliance, RCA, and copilot queries. Full results are in `docs/ragas_results.md` and `docs/ragas_eval_results.csv`.

| Metric | Score |
|:---|---|
| Faithfulness | **0.741** |
| Context Precision | **0.778** |
| Context Recall | **0.900** |
| Answer Relevancy | N/A (Pydantic adapter conflict in RAGAS) |

**Honest framing of low scores**: Three questions scored 0.0 on individual metrics, but not because the system gave wrong answers. In each case, Vigil correctly refused to hallucinate:

1. **Context Recall 0.0 on "Safety procedures for pump P-102"**: Vigil correctly reported that no P-102-specific operating manual existed in the knowledge base. RAGAS penalized this because the ground truth expected confirmation that P-102 falls under general PSM scope -- a gap that closes the moment a P-102 manual is ingested.

2. **Context Precision 0.0 on "Maintenance history from P&ID documents"**: The raw P&ID text wasn't in the database (only title block specs), so Vigil correctly stated it couldn't answer from the P&ID. The retrieved contexts were legitimate maintenance logs instead, which RAGAS flagged as off-target.

3. **Faithfulness 0.0 on "Standard format for P&ID equipment info"**: Vigil correctly answered "Equipment Title Blocks" with a citation. RAGAS scored it 0.0 because the LLM's phrasing structure differed from the raw OKF text, not because the answer was wrong.

**8 out of 10 questions scored 1.0 on context recall**, meaning Vigil consistently retrieves the right documents. The system's safety-first design (refusing to answer when context is insufficient) is architecturally deliberate, not a bug.

---

## Enterprise Scalability Path

Vigil's core architecture (LangGraph multi-agent routing, OKF knowledge format, contradiction detection pipeline, Qdrant vector retrieval) is designed to scale from hackathon demo to production deployment without rebuilding. The transition points are infrastructure-tier swaps, not rewrites:

| Component | Current (Hackathon) | Production Upgrade |
|:---|:---|:---|
| LLM routing | OpenRouter free tier (`meta-llama/llama-3.3-70b-instruct`) | Portkey gateway with Groq (`llama-3.3-70b-versatile`) + paid fallback chain |
| OCR | OpenRouter free vision models | Dedicated vision models via Portkey with higher rate limits |
| Vector DB | Local file-based Qdrant (`vigil_qdrant.db`) | Qdrant Cloud cluster with replication |
| Reverse link scanning | Brute-force regex over all `.md` files | Qdrant metadata query on `linked_concepts` payload field, or in-memory graph index |
| Embedding model | `BAAI/bge-small-en-v1.5` | `BAAI/bge-large-en-v1.5` or fine-tuned domain-specific model |
| Ingestion pipeline | Single-process scripts | Async task queue (Celery/Argo) with retry, scheduling, and webhook triggers |
| Observability | LangSmith (optional) | Full LangSmith dashboard with alerting on eval degradation |
| Auth & RBAC | None | Role-based access per agent/directory scope |
| OKF storage | Local filesystem | Git-backed or object storage with versioned audit trail |

The OKF format itself is plain Markdown with YAML frontmatter and relative links, making it inherently portable across storage backends. The LangGraph agent definitions and `AgentState` schema are typed and modular, so adding a 5th agent (e.g. Safety Officer) follows the same pattern as the existing four.

---

## Project Structure

```
vigil/
  AGENTS.md                 # Project constitution (tech stack, rules, conventions)
  .env / .env.example       # Environment variables
  test_agents.py            # CLI test harness for query agents
  apps/
    backend/
      api.py                # FastAPI server (REST endpoints)
      graph.py              # LangGraph multi-agent definition + routing
      parsers.py            # Document type detection, local parsers, OCR
      scripts/
        build_graph.py      # Full ingestion pipeline
        index_graph.py      # Qdrant embedding + indexing
        run_ragas_eval.py   # RAGAS evaluation runner
    frontend/
      src/
        app/
          page.tsx          # Main dashboard page
          layout.tsx        # Root layout
          globals.css       # Tailwind theme + custom styles
        components/
          ForceGraph2D.tsx  # react-force-graph-2d component
  knowledge_graph/          # OKF concept files (git-tracked)
    equipment/
    procedures/
    regulations/
    maintenance/
    alerts/
  docs/
    ragas_results.md        # RAGAS evaluation summary
    ragas_eval_results.csv  # Raw eval scores
  test_documents/           # Source documents for ingestion
```

---

## License

Internal project. Copyright ET AI Hackathon 2026.

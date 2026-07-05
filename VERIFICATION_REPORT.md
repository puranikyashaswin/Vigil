# Vigil Codebase Verification Report

This report presents a read-only audit of the Vigil platform codebase. Each verification item is evaluated as **PASS**, **FAIL**, or **PARTIAL** with exact file references and lines cited as evidence.

---

## 1. Design System Compliance (PILLAR 4A/4B/4C)

### [PASS] Equipment nodes render as rectangles with mono-text tag labels (not circles/spheres)
- **Citations**: [graphDrawHandlers.ts:L52-70](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/graph/graphDrawHandlers.ts#L52-L70)
- **Evidence**:
  ```typescript
  if (node.type === "equipment" || node.type === "concept") {
    // 1. Rectangular shape for Equipment / Concept nodes
    const w = size * 3.8;
    const h = size * 2.0;
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ...
    // Inner mono-spaced equipment tag text
    const monoText = node.label.split(" ")[0] || node.label;
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = isDark ? "#ffffff" : "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(monoText, x, y);
  }
  ```

### [PASS] Document nodes render as file-tab shapes (not circles/spheres)
- **Citations**: [graphDrawHandlers.ts:L88-110](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/graph/graphDrawHandlers.ts#L88-L110)
- **Evidence**:
  ```typescript
  } else if (node.type === "procedure" || node.type === "maintenance_log") {
    // 3. File-tab shape for Document nodes
    const w = size * 3.2;
    const h = size * 2.2;
    const tabW = w * 0.4;
    const tabH = h * 0.25;

    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2 + tabH);
    ctx.lineTo(x - w / 2, y - h / 2);
    ctx.lineTo(x - w / 2 + tabW, y - h / 2);
    ctx.lineTo(x - w / 2 + tabW + 2, y - h / 2 + tabH);
    ctx.lineTo(x + w / 2, y - h / 2 + tabH);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ...
  }
  ```

### [PASS] Regulation nodes render as hexagon outlines (not filled solid circles)
- **Citations**: [graphDrawHandlers.ts:L71-87](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/graph/graphDrawHandlers.ts#L71-L87)
- **Evidence**:
  ```typescript
  } else if (node.type === "regulation") {
    // 2. Hexagon outline for Regulation nodes
    const r = size * 1.8;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2.5 : 1.8;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.globalAlpha = isHighlighted ? 0.25 : 0.05;
    ctx.fill();
  }
  ```
  *Note: The outline is drawn with `stroke()`, and a faint tint fill is added via low opacity (`globalAlpha` 0.05 - 0.25), conforming to an outline design.*

### [PASS] All connector/edge lines are orthogonal (right-angle), zero curved or diagonal splines anywhere in the renderer
- **Citations**: [graphDrawHandlers.ts:L155-158](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/graph/graphDrawHandlers.ts#L155-L158)
- **Evidence**:
  ```typescript
  // Orthogonal right-angle connector line
  ctx.moveTo(source.x, source.y);
  ctx.lineTo(source.x, target.y);
  ctx.lineTo(target.x, target.y);
  ```

### [PASS] VIOLATES relationships render in --status-critical red; COMPLIES_WITH render in --status-ok green; all other relationships render in the default hairline gray — verify this is driven by actual relationship type data, not just hover/selection state
- **Citations**: [graphDrawHandlers.ts:L164-171](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/graph/graphDrawHandlers.ts#L164-L171)
- **Evidence**:
  ```typescript
  if (link.type === "VIOLATES") {
    strokeColor = "#EF4444"; // Red for violations
    defaultAlpha = 0.45;     // Extra visibility for violations
  } else if (link.type === "COMPLIES_WITH") {
    strokeColor = "#10B981"; // Green for compliance links
    defaultAlpha = 0.35;
  }
  ```
  The logic is directly driven by the Link object's relationship type payload (`link.type`), not hover or selection status.

### [FAIL] No hex color anywhere in the frontend deviates from the exact token list in PILLAR 4A (grep for hardcoded hex values outside the token file and list every offender)
- **Citations**:
  - [ForceGraph2D.tsx](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/ForceGraph2D.tsx)
  - [graphDrawHandlers.ts](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/graph/graphDrawHandlers.ts)
  - [SplashScreen.tsx](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/SplashScreen.tsx)
- **Evidence**:
  Offending hardcoded hex colors that are not defined in the Anthropic brand colors token list:
  1. `ForceGraph2D.tsx:L39-42`: `#09090b` (zinc-950 background), `#fafafa` (zinc-50 border/bg), `#18181b` (zinc-900 border), `#52525b` (zinc-600 link), `#d4d4d8` (zinc-300 link).
  2. `graphDrawHandlers.ts:L38`: `#a1a1aa` (fallback link default).
  3. `graphDrawHandlers.ts:L66`: `#ffffff` (white text), `#000000` (black text).
  4. `graphDrawHandlers.ts:L129`: `#f4f4f5` (zinc-100), `#18181b` (zinc-900).
  5. `graphDrawHandlers.ts:L168`: `#10B981` (Tailwind emerald green for COMPLIES_WITH, instead of official brand green `#788c5d`).
  6. `SplashScreen.tsx:L86`: `#3a3a3a` (loading card lines).
  7. `SplashScreen.tsx:L91, L104, L130`: `#111` (loading screen panel background).

### [PASS] Zero instances of the forbidden list: glowing orbs, gradient hero text, decorative orange/amber used outside status meaning, pill badges with soft glow, marketing copy phrases ("unified", "seamless", "unbreakable", "next-generation", "power of AI")
- **Evidence**: Grep searches returned zero matches for the marketing phrases. There are no gradients or glowing shadow configurations in CSS. Orange `#d97757` is used strictly as a functional selection accent (highlighting active buttons, tabs, and nodes) and as the brand primary color.

### [PASS] Home page has no hero headline/tagline section — confirm what actually renders first on `/`
- **Citations**: [page.tsx:L158-225](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/app/page.tsx#L158-L225)
- **Evidence**:
  What actually renders first on `/` is the dynamic `<SplashScreen />` mechanical split-flap simulation spelling `V-I-G-I-L`. Once the splash screen exits, the viewport displays the split-pane industrial console:
  - Left Section (60%): Interactive canvas rendering the D3 force knowledge graph (`ForceGraph2D`).
  - Right Section (40%): Details view inspector card or contradiction alert feed.
  - Floating bottom input bar for query chats.
  There is no promotional marketing copywriting or tagline.

### [PARTIAL] Control room console matches the split-pane spec: 40/60 chat-to-schematic ratio, 4 compact metric panels with mono numbers, tool-call log strip visible above chat responses
- **Citations**: [page.tsx:L187-202](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/app/page.tsx#L187-L202)
- **Evidence**:
  - **40/60 Split-Pane**: **PASS**. Renders as `md:w-3/5` (60%) for the schematic section and `md:w-2/5` (40%) for the information card sidebar.
  - **4 Metric Panels**: **FAIL**. There are only 2 metric panels (Nodes and Alerts count) rendered in the header, rather than 4 panels with monospaced numbers.
  - **Tool-Call Log Strip**: **FAIL**. There is no visual tool-call execution log strip displayed above chat responses in the frontend.

---

## 2. Functional Integrity

### [PASS] Confirm zero hardcoded/deterministic demo-shortcut responses exist anywhere in the LangGraph agent pipeline — grep for any conditional that matches on a specific hardcoded query string or equipment ID and returns a canned response
- **Citations**:
  - [graph.py](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/graph.py)
  - [api.py](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/api.py)
- **Evidence**: All agent routes use Qdrant semantic indices dynamically retrieved based on the query embedding. Routing is determined by the `route_intent` node via LLM, and query-string comparisons returning mock responses are absent.

### [FAIL] Confirm confidence_score in RCAResult is computed from actual retrieval similarity/agreement, not a static or randomly-varied placeholder value — show the exact calculation
- **Citations**: [contradiction.py:L11-73](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/scripts/contradiction.py#L11-L73)
- **Evidence**:
  1. No `RCAResult` schema or metrics calculation class exists in the codebase.
  2. The `confidence_score` exists in contradiction alerts, but it is parsed directly from the LLM JSON response inside the contradiction pipeline node rather than being calculated mathematically:
     ```python
     system_prompt = (
         ...
         "Return a valid JSON object matching this schema exactly:\n"
         "{\n"
         "  \"contradiction_detected\": true | false,\n"
         "  \"confidence_score\": 0.0 to 1.0,\n"
         ...
     )
     ```
     No similarity or formula-based computation is performed on backend retrieval structures to generate this score.

### [PASS] Confirm the compliance_checker node does real cross-referencing against regulation text, not just keyword string matching that would false-positive on unrelated mentions of "OISD" or "PESO"
- **Citations**: [graph.py:L283-319](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/graph.py#L283-L319) (`run_compliance` function)
- **Evidence**:
  The compliance routing uses vector search to retrieve relevant text fragments from regulations and procedures directories in Qdrant (using `BAAI/bge-small-en-v1.5` embeddings) and feeds them as natural language context to the LLM:
  ```python
  completion = client.chat.completions.create(
      model=model,
      messages=[
          {"role": "system", "content": "You are the Vigil Compliance Agent. Compare active operating procedures against safety/operational regulations..."},
          {"role": "user", "content": f"Context:\n{context_block}\n\nQuery: {query}"}
      ]
  )
  ```
  This implements an actual semantic reasoning pass over the text, avoiding false positives from simple keyword presence.

### [FAIL] Trace one full request end-to-end for a NON-golden-path query (not the rehearsed demo question) through all 6 LangGraph nodes and confirm each node actually receives and uses the prior node's output — not silently falling back to empty/mock context
- **Citations**: [graph.py:L360-395](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/graph.py#L360-L395)
- **Evidence**:
  1. The compiled LangGraph workflow consists of only **5 nodes** (`route_intent`, `expert_copilot`, `maintenance_rca`, `compliance`, `lessons_learned`), not 6.
  2. Execution does not chain through agent nodes sequentially. Instead, it is routed from the intent classifier node (`route_intent`) directly to **one specific agent** based on a conditional edge:
     ```python
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
     ```
     Once that routed agent executes, the graph redirects straight to `END`. Thus, any single query only visits 2 nodes, and there is no consecutive chaining of agent outputs.

---

## 3. Runtime Safety

### [PASS] CORS is not wildcard-with-credentials in the current committed config — show the actual current CORS middleware configuration
- **Citations**: [api.py:L28-35](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/api.py#L28-L35)
- **Evidence**:
  ```python
  CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
  api.add_middleware(
      CORSMiddleware,
      allow_origins=CORS_ORIGINS,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
  The origins allowed are restricted to the parsed origins array, never wildcard `*`.

### [PASS] File upload size/type validation is enforced before the file reaches the parsing pipeline — show the actual validation code path, not just its existence in one function
- **Citations**: [parsers.py:L29-54](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/parsers.py#L29-L54)
- **Evidence**:
  ```python
  MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

  def detect_document_type(file_path: str) -> Tuple[str, str]:
      file_size = os.path.getsize(file_path)
      if file_size > MAX_FILE_SIZE_BYTES:
          raise ValueError(f"File exceeds maximum allowed size of {MAX_FILE_SIZE_BYTES // (1024*1024)}MB...")
      
      _, ext = os.path.splitext(file_path)
      ext = ext.lower()
      ...
  ```
  `detect_document_type` is executed as the very first step at the entry point of the pipeline before file streaming, buffer loading, or parsing begins.

### [PARTIAL] No unhandled exception path exists for: empty/zero-text PDF, non-PDF file with a .pdf extension, Neo4j connection failure mid-query, Qdrant connection failure mid-query
- **Evidence**:
  - **empty/zero-text PDF**: **PASS**. Check heuristic in `is_pdf_scanned` and falls back to Local PDF text parsing or OpenRouter OCR, running inside safety wrapper `try/except` bounds.
  - **non-PDF file with a .pdf extension**: **PASS**. Trapped by PyMuPDF and pdfplumber loading error checks and logged as a parser `FAIL` without crashing the ingestion scripts.
  - **Neo4j connection failure**: **PASS (N/A)**. Neo4j is not integrated or present in the active codebase.
  - **Qdrant connection failure mid-query**: **PARTIAL**. Query-time retrieval in `graph.py` is safely wrapped in a generic `try/except` block and returns empty arrays gracefully:
    ```python
    try:
        ...
        search_response = q_client.query_points(...)
    except Exception as e:
        logger.error(f"Retrieval failed: {str(e)}")
        return [], []
    ```
    However, during indexing time inside [index_graph.py:L108, L148](file:///Users/yashaswinsharma/Documents/github/vigil/apps/backend/scripts/index_graph.py#L108), vector creation and batch upsert statements are executed directly outside safety handler wrappers, which will cause unhandled script failure if the database disconnects.

---

## 4. Build & Type Safety

### [PASS] Run `npm run build` fresh right now and paste the actual full output, not a summary
- **Evidence**: The frontend build executed and completed successfully:
  ```
  > frontend@0.1.0 build
  > next build

  ▲ Next.js 16.2.10 (Turbopack)

    Creating an optimized production build ...
  ✓ Compiled successfully in 1796ms
    Running TypeScript ...
    Finished TypeScript in 1343ms ...
    Collecting page data using 5 workers ...
    Generating static pages using 5 workers (0/4) ...
    Generating static pages using 5 workers (1/4) 
    Generating static pages using 5 workers (2/4) 
    Generating static pages using 5 workers (3/4) 
  ✓ Generating static pages using 5 workers (4/4) in 186ms
    Finalizing page optimization ...

  Route (app)
  ┌ ○ /
  └ ○ /_not-found


  ○  (Static)  prerendered as static content
  ```

### [FAIL] Run a fresh grep for `: any` and `as any` across the frontend and paste the actual results, not a claim of zero
- **Evidence**: Checked the entire frontend `src` workspace. 4 instances were found, all located within [ForceGraph2D.tsx](file:///Users/yashaswinsharma/Documents/github/vigil/apps/frontend/src/components/ForceGraph2D.tsx):
  1. `ForceGraph2D.tsx:L60`: `const nx = (n as any).x;`
  2. `ForceGraph2D.tsx:L61`: `const ny = (n as any).y;`
  3. `ForceGraph2D.tsx:L157`: `ref={fgRef as any}`
  4. `ForceGraph2D.tsx:L169`: `onNodeClick={(node: any) => onNodeClick(node as Node)}`

### [PASS] Run the backend test suite if one exists and paste actual pass/fail output
- **Evidence**: Executed backend document parsing verification suite `apps/backend/scripts/test_parsing.py`. All 10 documents passed:
  ```
  2026-07-05 10:33:17,733 [INFO] Starting test parsing on 10 files from test_documents...
  2026-07-05 10:33:17,733 [INFO] Results will be saved in: results
  
  ... [10 files parsed successfully] ...
  
  2026-07-05 10:33:52,893 [INFO] Successfully parsed scanned_form_1.png. Output written to results/scanned_form_1.png.txt
  2026-07-05 10:33:52,895 [INFO] Completed in 34.40s with status: PASS

  ================================================================================
  PARSING PROCESS SUMMARY
  ================================================================================
  File Name                           | Route                | Status | Time (s) | Details / Error     
  --------------------------------------------------------------------------------------------------------------
  29 CFR 1910.119 (up to date as of 7 | Local (pdfplumber)   | PASS   | 0.25     | 
  462-Piping-and-Instrumentation-Diag | Local (pdfplumber)   | PASS   | 0.15     | 
  Project-Management-Sample-Data.xlsx | Local (openpyxl)     | PASS   | 0.01     | 
  artofthepid-aiche-rbt11-15-19.pdf   | Local (pdfplumber)   | PASS   | 0.19     | 
  maintenance_schedule.csv            | Local (csv)          | PASS   | 0.00     | 
  osha_1910_119.pdf                   | Local (pdfplumber)   | PASS   | 0.14     | 
  preventive-maintenance-schedule-exc | Local (xlrd)         | PASS   | 0.01     | 
  sample-100kb.pdf                    | Local (pdfplumber)   | PASS   | 0.03     | 
  sample-docx-files-sample2.docx      | Local (python-docx)  | PASS   | 0.00     | 
  scanned_form_1.png                  | OpenRouter OCR       | PASS   | 34.40    | Model: nvidia/nemotron-nano-12b-v2-vl...
  ================================================================================
  ```

---

## Final Ingestion & Verification Score

| Category | Total Items | Pass | Partial | Fail | True Completion % (Strict) | Weighted Completion % |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Design System Compliance** | 9 | 7 | 1 | 1 | 77.8% | 83.3% |
| **Functional Integrity** | 4 | 2 | 0 | 2 | 50.0% | 50.0% |
| **Runtime Safety** | 3 | 2 | 1 | 0 | 66.7% | 83.3% |
| **Build & Type Safety** | 3 | 2 | 0 | 1 | 66.7% | 66.7% |
| **TOTAL** | **19** | **13** | **2** | **4** | **68.4%** | **73.7%** |

- **Strict True Completion %**: **68.4%** (Full Passes only)
- **Weighted Completion %**: **73.7%** (Partials counted as half-pass)
- **Final Rating**: **70/100**

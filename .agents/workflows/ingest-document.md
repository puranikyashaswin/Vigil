# Ingestion Pipeline Workflow: Document Ingestion

This workflow defines the literal, step-by-step procedure for processing and ingesting fragmented industrial documents into Vigil's OKF knowledge graph and Qdrant vector database.

---

## Input
- **`document_path`**: Absolute or relative path to the raw physical document (PDF, DOCX, PNG, JPG, or CSV).

---

## Step 1: Detect Document Type and Route

### Procedure:
1. Examine the file extension and MIME type of `document_path`.
2. **Path A (Text-Native Document)**: If the document is a text-based PDF or DOCX:
   - Route to **Local Parsers**.
   - If PDF, initialize `pdfplumber` or `unstructured`.
   - If DOCX, initialize `python-docx`.
3. **Path B (Scanned Document or Image)**: If the document is an image (PNG, JPG) or scanned/non-selectable PDF:
   - Route to the **OpenRouter Vision OCR Chain**.
   - Query the primary free-tier vision model: `nvidia/nemotron-nano-12b-v2-vl:free`.

### Failure Handling:
- **Local Parser Failure**: If a local parser throws an decoding or layout error, attempt parsing via `unstructured` layout detection as a secondary local method. If that also fails, treat the document as an image and route to the OpenRouter Vision OCR Chain.
- **OpenRouter Primary Model Failure (HTTP 429/500/Timeout)**:
  - Catch the exception. Log a warning: `[WARNING] Primary vision model failed. Activating Fallback 1.`
  - **Fallback 1**: Query `google/gemma-4-26b-a4b-it:free`.
  - **Fallback 2 (If Fallback 1 fails)**: Query `openrouter/free`.
  - **Hard Failure**: If all OCR fallbacks fail, log a critical error: `[CRITICAL] OCR pipeline failed for file: <path>`. Abort execution, clean up temporary file handles, and return an ingestion error status. Never fail silently.

---

## Step 2: Parse to Raw Text / Markdown

### Procedure:
1. Extract text layout-by-layout.
2. Format tables into standard Markdown tables (`| Col 1 | Col 2 |`) to preserve structural information for downstream parsing.
3. Clean up double spacing, line break artifacts, and trailing non-printable characters.

### Failure Handling:
- **Empty Output**: If the parsed output contains fewer than 10 characters, treat the parser result as corrupted. Raise `ParserEmptyException`, log the error, and halt the ingestion pipeline.

---

## Step 3: LLM Entity Extraction

### Procedure:
1. Construct the extraction prompt containing the raw text block and structured output formatting instructions.
2. Invoke the Groq reasoning engine (`groq/llama-3.3-70b-versatile` via Portkey) enforcing a JSON response format.

### Pydantic Output Schema:
```python
from pydantic import BaseModel, Field
from typing import List, Optional

class ExtractedEntity(BaseModel):
    name: str = Field(description="Formal name of the entity, e.g., 'High-Pressure Valve V-202'")
    type: str = Field(description="Must be one of: concept, procedure, regulation, maintenance_log, drawing")
    description: str = Field(description="Summary of the entity's purpose, parameters, or specifications")
    equipment_tags: List[str] = Field(default=[], description="List of standard equipment IDs, e.g., ['V-202', 'P-101']")
    regulatory_references: List[str] = Field(default=[], description="List of referenced standards, e.g., ['OSHA 1910.119']")
    linked_concepts: List[str] = Field(default=[], description="Titles/names of other entities mentioned in this text to create markdown links to")
    tags: List[str] = Field(default=[], description="Descriptive classification tags")
```

### Extraction Prompt Template:
```
You are an expert industrial knowledge parser. Analyze the raw text below and extract all primary entities.
Return a valid JSON array matching the ExtractedEntity schema.

Rules:
1. Ground every extracted field strictly in the text.
2. For linked_concepts, identify existing entities or clear external concepts referenced in the document.

Raw Text:
---
{raw_text}
---
```

### Failure Handling:
- **Empty Extraction / Invalid JSON**: If the model output fails validation against the Pydantic schema:
  - Attempt a single JSON correction self-repair call by feeding the validation error back to the model.
  - If it fails a second time, log a warning: `[WARNING] Extraction returned invalid schema for document. Falling back to generic concept classification.`
  - Construct a generic fallback entity with `type: concept`, deriving the title from the document name, and putting the entire raw text into the description field.

---

## Step 4: Write Concept Files (`okf_writer`)

### Procedure:
1. For each extracted entity, invoke the [okf_writer skill](file:///Users/yashaswinsharma/Documents/github/vigil/.agents/skills/okf_writer/SKILL.md) conventions.
2. Derivations:
   - Determine target directory based on entity `type` (e.g., `procedures/`).
   - Create the slug-based filename (e.g., `safety-interlock-v-202.md`).
3. Write the markdown file containing the YAML frontmatter and structured body text.
4. **Append references & Handle conflicts**:
   - If the file already exists (write conflict): Compare the timestamp. If the incoming entity is newer, overwrite the file. Rely on Git commits for historical tracking.
   - Register the file reference in the directory's `index.md`.
   - Add a date-headed log entry to the directory's `log.md` with action **INGEST** (or **UPDATE** if overwriting).

### Failure Handling:
- **Disk Write Failure**: If write fails due to disk permissions, raise a terminal alert and log: `[CRITICAL] Disk write failed. Permission denied on directory.` Halting the step.

---

## Step 5: Double-Sided Contradiction Detection

To ensure proactive alert generation, the contradiction check must evaluate both out-links (forward) and in-links (reverse).

### Part A: Forward Contradiction Check
1. Retrieve all concepts referenced via relative links in the newly created concept's body and frontmatter.
2. Retrieve the content of each linked concept file.
3. Compare them using the verification query below.

### Part B: Reverse Contradiction Check
1. Search all existing OKF files in the workspace for markdown link references pointing to the newly ingested concept's filename (e.g., `../procedures/crude-feed-startup.md`).
   - *Brute-Force Scan (Hackathon Scope)*: Perform a simple local full-text scan using regex/glob across all `.md` files in the OKF bundle to find link matches (takes <50ms for a few hundred small markdown files).
   - *Known Scaling Limitation*: For large-scale production databases (>1,000 files), this brute-force scan will cause ingestion bottlenecks. In production, replace this with a metadata lookup in Qdrant (querying the `linked_concepts` payload array) or by querying a cached in-memory graph index.
2. For each matching file found, retrieve its content.
3. Compare the existing file's rules against the newly ingested concept's content using the verification query below.

### Verification Prompt:
Query `groq/llama-3.3-70b-versatile` via Portkey with temperature `0.0`:
```
Compare the two industrial source texts below.
Check if the rules, limits, or instructions in Source A conflict with, violate, or contradict the rules/parameters of Source B.

Source A:
{concept_content_a}

Source B:
{concept_content_b}

Provide your analysis in JSON format:
{
  "contradiction_detected": true/false,
  "confidence_score": float (0.0 to 1.0),
  "description": "Details of the discrepancy",
  "severity": "low" | "medium" | "high" | "critical"
}
```

### Action Trigger:
If `contradiction_detected` is `true` AND `confidence_score` > 0.7:
- Generate a new alert OKF concept file in the `alerts/` directory (e.g., `alerts/conflict-xxxx.md`).
- Link the alert file back to both source concepts.
- Update `alerts/index.md` and append an entry to `alerts/log.md` with action **ALERT**.

### Failure Handling:
- **LLM Rate-Limit / Timeout**:
  - Catch exception and retry with exponential backoff up to 3 times.
  - If all retries fail, do not block the primary ingestion success path.
  - Log `[ERROR] Contradiction check failed due to LLM rate limit. Ingestion marked as UNVERIFIED.` and record `unverified` in the completion report.

---

## Step 6: Embed and Index in Qdrant

### Procedure:
1. Split the concept markdown content into logical chunks (e.g. paragraphs or max 500 characters).
2. For each chunk, call the FastEmbed embedding model:
   ```python
   from fastembed import TextEmbedding
   embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
   vector = list(next(embedding_model.embed([chunk_text])))
   ```
3. Upsert the chunk vectors to Qdrant collection `vigil_okf` with the required payload metadata schema:
   ```json
   {
     "file_path": "procedures/crude-feed-startup.md",
     "directory": "procedures",
     "text": "..." ,
     "type": "procedure"
   }
   ```

### Failure Handling:
- **Embedding / Qdrant Connection Failure**:
  - Attempt up to 3 automatic retries with exponential backoff.
  - If all retries fail, do not crash the pipeline.
  - Log `[ERROR] Qdrant indexing failed for chunk. Continuing without vector search capability for this chunk.` and mark `indexing_status: failed` in the confirmation report.

---

## Step 7: Confirm Completion

### Ingestion Output Payload:
Upon successful execution, the pipeline must log and return a structured JSON report matching the schema below:

```json
{
  "status": "success",
  "session_id": "pipeline/session-48ca",
  "document_parsed": "raw_document.pdf",
  "created_files": [
    "procedures/crude-feed-startup.md"
  ],
  "alerts_raised": [
    "alerts/conflict-crude-startup-safety.md"
  ],
  "indexing_status": "success",  # success | failed
  "contradiction_check_status": "verified",  # verified | unverified
  "timestamp": "2026-07-04T09:25:56+05:30"
}
```
---

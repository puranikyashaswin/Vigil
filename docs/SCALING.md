# Vigil Production Scaling Guide
*Technical Reference for Enterprise Deployment*

This document outlines the engineering path to scale Vigil from a hackathon-scale prototype (tested on ~50 documents) to a production-grade deployment handling 100,000+ documents in a large industrial organization.

---

## 1. Architectural Summary

Vigil's core architecture does **not** need to be rebuilt or rewritten to scale. The following patterns remain unchanged at enterprise scale:
- **LangGraph Agent Routing**: The StateGraph definition, state transition nodes, and categorical query classification are stateless and scale horizontally behind standard load balancers.
- **Open Knowledge Format (OKF)**: The markdown-based schema with YAML frontmatter is natively portable and can be parsed efficiently by distributed workers.
- **Contradiction Detection Logic**: The forward and reverse comparison model remains conceptually identical, though the lookups will be backed by metadata search rather than disk regex.
- **4-Agent Design**: The modular division of responsibilities (Copilot, RCA, Compliance, Lessons-Learned) allows individual agents to be deployed as independent microservices or scaled selectively.

The primary transition from prototype to production consists of replacing in-process file operations and free-tier APIs with distributed infrastructure.

---

## 2. Infrastructure Swaps

Below is the scaling path for each system component, outlining the current implementation, estimated bottlenecks, and production replacements.

### LLM Inference
- **Current Setup**: OpenRouter free tier (`meta-llama/llama-3.3-70b-instruct`).
- **Bottlenecks**: The free tier is rate-limited to approximately 10 to 20 requests per minute. Processing 100,000 documents during an initial bulk ingestion (requiring at least one extraction and one contradiction check per file) would require 200,000 LLM calls. At 15 requests per minute, this would take **222 hours** (over 9 days) of continuous, error-free streaming. Connection timeouts and network instability make this completely unfeasible.
- **Production Replacement**: A dedicated enterprise LLM gateway (such as **Portkey AI**, **LiteLLM**, or **Kong**) configured with paid commercial endpoints (e.g., **Azure OpenAI**, **AWS Bedrock**, or paid tier **Groq** keys) using provisioned throughput limits (tokens per minute / requests per minute) and fallback routing rules.

### OCR & Vision Processing
- **Current Setup**: OpenRouter free vision model (`nvidia/nemotron-nano-12b-v2-vl:free`).
- **Bottlenecks**: Visual document parsing of scanned assets via free vision endpoints suffers from extremely high latency (5 to 10 seconds per page) and tight request limits. Converting 10,000 scanned PDFs or P&ID title blocks using this channel would trigger continuous `429 Too Many Requests` errors.
- **Production Replacement**: Cloud-native document processing suites (e.g., **Azure AI Document Intelligence**, **Google Cloud Document AI**) or a self-hosted OCR parsing service (e.g., **Tesseract** or **EasyOCR** containerized on GPU-enabled instances within the organization's private network).

### Vector Database
- **Current Setup**: Local file-based Qdrant database (`vigil_qdrant.db`).
- **Bottlenecks**: SQLite-backed local databases run in-process and perform synchronous disk I/O. Assuming an average chunking ratio of 8 to 10 chunks per document, a corpus of 20,000 to 30,000 documents will produce 160,000 to 300,000 vectors. At this scale, in-memory indexing overhead inside the FastAPI process will cause memory usage to swell, and concurrent query latency on the local SQLite storage will degrade significantly. It also offers no support for backups, replication, high availability, or horizontal scaling.
- **Production Replacement**: A **Qdrant Cloud** cluster or self-hosted **Qdrant cluster** deployed on Kubernetes (EKS/GKE), using sharded collections (split by concept category or plant location) and a replication factor of at least 2 for fault tolerance.
  
  > [!NOTE]
  > **Local Quantized Alternative (turbovec)**:
  > For deployments where teams want to avoid the operational cost and network dependencies of a managed Qdrant Cloud cluster while maintaining a low memory footprint at scale, [turbovec](https://github.com/RyanCodrai/turbovec) serves as a viable production path. It is a Rust-based vector index using **TurboQuant** quantization, offering roughly 16x memory compression over float32 embeddings and faster ARM/x86 SIMD search execution than FAISS. This allows for a fully local, high-performance option with zero external managed service dependencies.
  > 
  > *Implementation Impact:* Choosing turbovec requires a real architectural swap rather than a drop-in addition, as it requires completely replacing the current `qdrant-client` integration across all backend query graphs and pipeline ingestion scripts.

### Contradiction Detection's Reverse-Link Scan
- **Current Setup**: Brute-force regex scan over all local files (`build_graph.py:65`).
- **Bottlenecks**: To discover which existing documents link *to* a newly ingested document (reverse check), the current script scans the contents of every markdown file in the database. At 100,000 documents, a single file ingestion would trigger 100,000 read operations, completely stalling the disk I/O of the ingestion server. This is an $O(N)$ operation that does not scale.
- **Production Replacement**: Store link metadata inside Qdrant as a payload field (e.g., `linked_concepts: [file_path_a, file_path_b]`). A reverse link scan then becomes an index-backed metadata query to Qdrant: search for all vector points where the payload `linked_concepts` array contains the target path. This reduces the search complexity to $O(1)$. Alternatively, run a lightweight in-memory graph index (e.g., **NetworkX**) or sync the schema to a dedicated Graph Database (e.g., **Neo4j**).

### Ingestion Pipeline Execution
- **Current Setup**: Sequential, single-process execution scripts (`build_graph.py`, `index_graph.py`).
- **Bottlenecks**: If a single file format error or API timeout occurs during batch execution, the pipeline halts or crashes. There is no state management, execution tracking, or parallel processing.
- **Production Replacement**: An asynchronous workflow coordinator like **Temporal.io** or a task queue like **Celery** (with **RabbitMQ** or **Redis** as a message broker). Workers process files in parallel, log execution states, and place failed items into a Dead Letter Queue (DLQ) for manual inspection without halting the rest of the batch.

### Knowledge Storage
- **Current Setup**: Local directory structures (`knowledge_graph/`).
- **Bottlenecks**: Operating systems degrade in performance when directories hold tens of thousands of flat files. Local storage cannot be shared easily across multiple distributed agent workers and lacks version tracking or audit history.
- **Production Replacement**: Enterprise object storage (e.g., **AWS S3** or **Google Cloud Storage**) backed by a versioned audit database. To maintain git-like history, updates can be synchronized with an internal Git provider (e.g., **GitLab Enterprise**) via webhooks to preserve commit-based change histories.

### Observability
- **Current Setup**: Optional LangSmith logging.
- **Bottlenecks**: Without centralized log collection and monitoring, engineers cannot detect drift, retrieval precision issues, or latent errors across the agent network.
- **Production Replacement**: Mandatory distributed tracing (e.g., **LangSmith Enterprise**, **Langfuse**, or **Arize Phoenix**) integrated with enterprise alert monitors (e.g., **Datadog** or **Grafana**), alerting team members if context recall averages drop below `0.85` or if agent classification errors spike.

### Access Control & Security
- **Current Setup**: None (unauthenticated API allows access to all data).
- **Bottlenecks**: Industrial compliance and security standards require strict compartmentalization. Technicians should not view restricted regulatory strategy papers, and external compliance auditors must not view private maintenance logs.
- **Production Replacement**: Scoped retrieval. User groups are mapped via JWT headers at the API layer. Retrieval queries to Qdrant must contain a metadata group filter (e.g., `user_roles` matching `document_security_tag`).

---

## 3. What Breaks First: Scaling Timeline

Below is an estimate of when specific bottlenecks will begin to impact performance based on document volume:

1. **At ~500 Documents**:
   - *LLM / Vision Rate Limits*: Free tier key quotas will exhaust within minutes of starting a batch upload.
2. **At ~2,000 Documents**:
   - *Sequential Ingestion Speed*: In-process parsing and brute-force regex reverse-link scans will cause the ingestion script to take upwards of 5 seconds per file, making batch updates slow.
3. **At ~5,000 Documents**:
   - *Local Disk Lookup Performance*: Reading raw markdown files directly from disk for Copilot queries will cause request timeouts.
4. **At ~20,000 to 30,000 Documents**:
   - *SQLite-backed Qdrant Latency*: Total vector count reaches ~160,000 to 300,000 vectors. Search execution times on `vigil_qdrant.db` will exceed 1,000ms due to lack of index memory caching and disk I/O bottlenecks.
   - *Audit & Security Compliance*: The lack of authorization scoping and file audit trails will trigger internal corporate security reviews.
5. **At ~100,000 Documents**:
   - *Storage Scaling Limit*: Flat file lookups on local storage fail; memory limits on single-node web servers cause out-of-memory crashes during large queries.

---

## 4. Cost and Infrastructure Estimates

The following table lists rough infrastructure estimates for a 100,000 document index. *Note: Actual sizing requires empirical load testing under production traffic.*

| Resource | Size Estimate | Notes |
|:---|:---|:---|
| **Vector DB Nodes** | 2x Node (8GB RAM, 2 vCPUs) | Qdrant requires RAM to store indexes in memory for sub-10ms retrieval. |
| **Storage (Object / Git)** | ~50GB to 150GB | Assumes plain text extraction and title blocks. Media assets will increase this. |
| **Task Queue Broker** | 1x Redis instance (4GB RAM) | Manages celery worker task lists and pipeline states. |
| **Compute Instances** | 3x Worker Nodes (4 vCPUs each) | Scale up/down during peak ingestion schedules. |
| **GPU Nodes (Optional)** | 1x NVIDIA T4 (or equivalent) | Only required if opting for self-hosted OCR rather than cloud APIs. |

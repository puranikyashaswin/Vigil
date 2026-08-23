# Vigil - Hackathon Pitch Source Document

## Project Name
Vigil - Industrial Knowledge Intelligence Platform

## One-Line Description
An AI-powered platform that ingests heterogeneous industrial documents, builds a living knowledge graph, proactively detects safety contradictions at ingestion time, and answers grounded queries through specialized multi-agent RAG pipeline.

## Problem Statement (ET AI Hackathon 2026 - Octave Challenge)
Build an AI-powered Industrial Knowledge Intelligence platform that ingests heterogeneous documents (engineering drawings, maintenance records, safety procedures, inspection reports, operating instructions, project files) across structured and unstructured formats, and makes their collective intelligence queryable, actionable, and continuously updated at the point of need, across any device or function.

## Problem Context (Industry Data)
- McKinsey 2024: Professionals in asset-intensive industries spend 35% of working hours searching for information
- NASSCOM-EY: Average large plant in India operates across 7-12 disconnected document systems
- BIS Research: Document fragmentation contributes to 18-22% of unplanned downtime in Indian heavy industry
- 25% of India's experienced industrial engineers will retire within the next decade, taking undocumented knowledge with them

## Core Differentiator: Proactive Contradiction Detection
Every knowledge management system answers questions reactively. Vigil detects contradictions PROACTIVELY at ingestion time using double-sided checking:
- Forward check: New document compared against every concept it references
- Reverse check: All existing concepts that reference the new document are re-checked
- If contradiction exceeds 0.7 confidence threshold, an automatic safety alert is generated

Example: A procedure says "Set bypass to 120 PSI" while a regulation says "Max pressure 100 PSI". Vigil catches this contradiction the moment the procedure is ingested, not when equipment fails.

## Technical Architecture

### Backend (Python)
- Agent orchestration: LangGraph with parallel fan-out/fan-in topology
- LLM gateway: Amazon Bedrock (Claude Opus 4.6 for safety-critical, Claude Sonnet 4.6 for speed)
- 4 specialized agents: Expert Copilot, RCA (Root Cause Analysis), Compliance, Lessons-Learned
- Vector storage: Qdrant (local SQLite or cloud clustered)
- Embeddings: FastEmbed (BAAI/bge-small-en-v1.5)
- Reranking: FlashRank (ms-marco-MiniLM-L-12-v2)
- 3-component confidence model: 0.5 x relevance + 0.3 x consensus + 0.2 x coverage
- Streaming: FastAPI SSE for real-time token delivery
- WebSocket: Real-time graph update notifications after ingestion
- Document parsing: PyMuPDF (94% faster than pdfplumber), Claude Vision OCR for scanned docs

### Frontend (Next.js 16)
- Interactive force-directed 2D knowledge graph
- Real-time search and filter for nodes
- Streaming chat with token-by-token delivery
- Bidirectional graph-to-chat linking ("Ask Vigil About This Asset" button)
- WebSocket auto-refresh when new documents ingested
- Drag-and-drop file upload with live pipeline progress
- Mobile responsive with dark/light theme

### Pipeline Flow
START > route_intent (parallel) + retrieve_context (parallel) > rerank_context > agent_dispatch > contradiction_guard > log_metrics > END

The parallel fan-out saves 300-400ms per query compared to sequential execution.

## Quantified Benchmarks

### Contradiction Detection (n=42 pairs, hand-written hard cases)
- Precision: 88.24%
- Recall: 71.43%
- F1 Score: 0.7895
- Threshold: 0.7 (robust safety margin)
- Contradictory cohort avg score: 0.6995 (median 0.95)
- Clean control cohort avg score: 0.0919 (median 0.00)

### RAG Quality (40-question benchmark)
- Faithfulness: 0.8112
- Answer Relevancy: 0.8307
- Context Precision: 0.7197
- Context Recall: 0.7167
- Correct Refusal Rate (out-of-scope): 100% (10/10)
- False Refusal Rate: 6.67% (2/30)

### Retrieval Ablation
- Without reranking: Hit@5 = 0.9667, MRR = 0.8944
- With FlashRank: Hit@5 = 1.0000, MRR = 0.9333 (+4.3% improvement)

## Key Features
1. Proactive contradiction detection (double-sided, forward + reverse)
2. Interactive knowledge graph with search/filter
3. 4 specialized AI agents routed by intent
4. Streaming SSE responses (first token in under 2 seconds)
5. Real-time WebSocket updates (graph refreshes on ingestion)
6. Bidirectional graph-chat linking (click node to ask AI about it)
7. Multi-format document parsing (PDF, DOCX, XLSX, XLS, CSV, images)
8. 3-component confidence scoring (mathematically grounded, not random)
9. Contradiction guard on generated responses (safety check)
10. Compliance evidence export (auto-generated audit zip)

## Business Viability
- Target market: 15,000+ large industrial facilities in India
- Revenue model: Per-plant SaaS subscription (5-8L/year per facility)
- Value proposition: One avoided unplanned shutdown saves 50L-2Cr in a refinery
- ROI: 10x+ from day one
- Data sovereignty: Runs on Amazon Bedrock, data never leaves the organization
- Deployment: Zero hardware needed, runs on existing AWS infrastructure

## Scalability Path
- LLM: Bedrock on-demand to Provisioned Throughput
- Vector Index: SQLite Qdrant to Qdrant Cloud clustered
- Pipeline: Sync thread to Celery/Temporal async queue
- Storage: Local directories to versioned S3

## Innovation Points (What No Competitor Has)
1. PROACTIVE contradiction detection - not just reactive Q&A
2. Double-sided checking (forward + reverse) at ingestion time
3. Parallel LangGraph with fan-out/fan-in (not sequential chain)
4. 3-component confidence model with mathematical formula
5. Smart guard skipping (saves 800ms when confidence > 0.85)
6. Real-time WebSocket graph updates on ingestion
7. Bidirectional graph-to-chat linking

## Presentation Style
- SCQA framework (Situation, Complication, Question, Answer)
- Dark theme, minimal text, maximum visual impact
- Accent color: warm clay/orange (#D97757)
- 7-8 minutes presentation + 7-8 minutes Q&A
- Live demo included showing real functionality

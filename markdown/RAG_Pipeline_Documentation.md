# RAG Pipeline Documentation

## Hub4Learners — AI Chat with Retrieval-Augmented Generation

---

## Table of Contents

1. [What is RAG and why use it?](#1-what-is-rag-and-why-use-it)
2. [Architecture Overview](#2-architecture-overview)
3. [Technologies & Services](#3-technologies--services)
4. [Step-by-step Pipeline](#4-step-by-step-pipeline)
   - 4.1 [Indexing — when a PDF is uploaded](#41-indexing--when-a-pdf-is-uploaded)
   - 4.2 [Retrieval — when the user sends a message](#42-retrieval--when-the-user-sends-a-message)
   - 4.3 [Generation — calling Groq with context](#43-generation--calling-groq-with-context)
5. [Database Schema](#5-database-schema)
6. [Files Created / Modified](#6-files-created--modified)
7. [Configuration & Environment Variables](#7-configuration--environment-variables)
8. [Auto-Indexing Behaviour](#8-auto-indexing-behaviour)
9. [Chunking Strategy](#9-chunking-strategy)
10. [Embedding Model](#10-embedding-model)
11. [Similarity Search (pgvector)](#11-similarity-search-pgvector)
12. [API Reference](#12-api-reference)
13. [Full Flow Diagram](#13-full-flow-diagram)

---

## 1. What is RAG and why use it?

**RAG (Retrieval-Augmented Generation)** is a technique that gives an AI model access to a private knowledge base *at query time* rather than training it on that data.

Without RAG the old approach was:
> Dump the **entire** course content (potentially hundreds of pages) into every single prompt → slow, expensive, hits token limits.

With RAG:
> **Only the most relevant passages** for the user's specific question are retrieved and sent to the AI → faster, cheaper, more accurate, strictly scoped to this course.

---

## 2. Architecture Overview

```
                        ┌──────────────────────────────────┐
    PDF upload          │         INDEXING PIPELINE         │
    ──────────►  chunk  │  chunker.py                       │
                 text   │  Split content into ~1500-char    │
                   │    │  overlapping passages             │
                   ▼    └──────────────────────────────────┘
             embed each chunk
             (Together AI → BAAI/bge-base-en-v1.5)
                   │
                   ▼
        ┌─────────────────────┐
        │   material_chunks   │  pgvector table in Neon DB
        │   (768-dim vectors) │  course_id | content | embedding
        └─────────────────────┘

                        ┌──────────────────────────────────┐
    User question       │        QUERY PIPELINE             │
    ──────────►  embed  │  embeddings.py                    │
                question│  Same model → 768-dim vector      │
                   │    └──────────────────────────────────┘
                   ▼
        cosine similarity search  (<=> operator)
        top 6 most relevant chunks for this course
                   │
                   ▼
        ┌──────────────────────┐
        │     Groq / Llama     │  grok.py
        │  system: chunks only │  llama-3.3-70b-versatile
        │  user: question      │
        └──────────────────────┘
                   │
                   ▼
            Answer to user
```

---

## 3. Technologies & Services

| Component | Technology | Purpose |
|---|---|---|
| **Chunking** | `chunker.py` (custom Python) | Split extracted markdown into overlapping passages |
| **Embedding model** | `BAAI/bge-base-en-v1.5` via Together AI | Convert text → 768-dim dense vectors |
| **Vector store** | pgvector on Neon PostgreSQL | Store & search embeddings with cosine similarity |
| **Similarity search** | `<=>` cosine operator (pgvector) | Find the most relevant chunks for a query |
| **LLM** | Groq → `llama-3.3-70b-versatile` | Generate the final answer from retrieved context |
| **HTTP client** | `requests` (already installed) | All external API calls, no new packages needed |

---

## 4. Step-by-step Pipeline

### 4.1 Indexing — when a PDF is uploaded

Triggered automatically inside `upload_material()` in `course_controller.py` right after the PDF-to-markdown conversion.

```
Professor uploads PDF
        │
        ▼
pdf_to_markdown()          ← Together AI converts PDF → markdown (existing)
        │
        ▼
content_text saved to DB   ← CourseMaterial row committed
        │
        ▼
embed_and_store_material()  ← NEW: RAG indexing
    │
    ├── chunker.chunk_text(content_text)
    │       Split into ~1500-char overlapping passages
    │
    ├── For each chunk:
    │       embeddings.embed_text(chunk)
    │           POST https://api.together.xyz/v1/embeddings
    │           model: BAAI/bge-base-en-v1.5
    │           → [f1, f2, … f768]
    │
    └── INSERT INTO material_chunks
            (material_id, course_id, section_title,
             material_title, chunk_index, content, embedding::vector)
```

**Failure safety:** the entire embedding block is wrapped in `try/except`. If Together AI is down or the key is missing, the upload still succeeds — only the chat will lack indexed content for that material.

---

### 4.2 Retrieval — when the user sends a message

```
User types: "What is backpropagation?"
        │
        ▼
POST /api/ai/chat
    { course_id, message, history }
        │
        ▼
course_has_chunks(course_id)
    ├── True  → proceed
    └── False → _index_all_materials()   ← auto-index legacy content
                then proceed
        │
        ▼
retrieve_relevant_chunks(query, course_id, top_k=6)
    │
    ├── embed_text("What is backpropagation?")
    │       → [0.12, -0.03, …]  (768 floats)
    │
    └── SELECT content, section_title, material_title,
               1 - (embedding <=> query_vector::vector) AS similarity
           FROM material_chunks
           WHERE course_id = :cid
           ORDER BY embedding <=> query_vector::vector
           LIMIT 6
        → Top 6 most semantically relevant passages
```

---

### 4.3 Generation — calling Groq with context

```
retrieved_chunks (6 passages)
        │
        ▼
grok.chat(course_title, retrieved_chunks, history, user_message)
    │
    ├── Build system prompt:
    │     "You are a study assistant for course X.
    │      Here are the relevant passages:
    │      [Section > Material]
    │      <chunk text>
    │      ---
    │      [Section > Material]
    │      <chunk text>
    │      ...
    │      Answer ONLY from these passages."
    │
    ├── Append conversation history (last 20 turns)
    ├── Append user message
    │
    └── POST https://api.groq.com/openai/v1/chat/completions
            model: llama-3.3-70b-versatile
            max_tokens: 2048, temperature: 0.4
        → reply text
```

---

## 5. Database Schema

### `material_chunks` table

```sql
CREATE TABLE material_chunks (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     UUID    NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
    course_id       UUID    NOT NULL REFERENCES courses(id)          ON DELETE CASCADE,
    section_title   VARCHAR(500),
    material_title  VARCHAR(500),
    chunk_index     INTEGER NOT NULL DEFAULT 0,
    content         TEXT    NOT NULL,
    embedding       vector(768)         -- pgvector type, cosine similarity
);

CREATE INDEX material_chunks_course_idx ON material_chunks (course_id);
```

- `ON DELETE CASCADE` — when a material or course is deleted, its chunks are automatically removed.
- `embedding vector(768)` — 768-dimensional float vector stored natively by pgvector.
- The course index makes filtering by `course_id` fast before the vector scan.

---

## 6. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `backend/app/utils/chunker.py` | **Created** | Smart paragraph-aware text splitter with overlap |
| `backend/app/utils/embeddings.py` | **Created** | Together AI embedding calls + pgvector store/retrieve |
| `backend/app/utils/grok.py` | **Modified** | `chat()` now takes `retrieved_chunks` instead of raw sections |
| `backend/app/routes/ai_routes.py` | **Modified** | Auto-index + RAG retrieval before calling Groq; added `/reindex` endpoint |
| `backend/app/controller/course_controller.py` | **Modified** | Triggers `embed_and_store_material()` after PDF upload |
| `backend/app/main.py` | **Modified** | Added `CREATE EXTENSION IF NOT EXISTS vector` + `material_chunks` table migration |

---

## 7. Configuration & Environment Variables

| Variable | Service | Used in |
|---|---|---|
| `TOGETHER_API_KEY` | Together AI | Embedding calls (`embeddings.py`) and PDF-to-markdown (`pdf_converter.py`) |
| `GROK_API_KEY` | Groq | LLM generation (`grok.py`) |

Both are read from `backend/.env` via `python-dotenv`.

---

## 8. Auto-Indexing Behaviour

Materials uploaded **before** RAG was set up have no chunks in the DB. When a user sends their **first chat message** in such a course, `ai_routes.py` detects the missing chunks and transparently calls `_index_all_materials()` to embed everything on the fly.

```
First chat in course X
    │
    course_has_chunks("X") → False
    │
    _index_all_materials("X")   ← one-time, may take a few seconds
    │
    course_has_chunks("X") → True (for all future messages)
    │
    retrieve_relevant_chunks(...)
    │
    reply
```

After that one-time indexing, all subsequent messages use the fast vector search path.

A professor can also manually force a re-index at any time via:
```
POST /api/ai/reindex/{course_id}
Authorization: Bearer <token>
```

---

## 9. Chunking Strategy

**File:** `backend/app/utils/chunker.py`

| Parameter | Value | Reason |
|---|---|---|
| Chunk size | 1 500 characters | ~375 tokens — fits comfortably in an embedding model's window |
| Overlap | 200 characters | Prevents losing context at chunk boundaries |
| Split boundary | Blank lines (paragraphs/headings) | Keeps semantically related sentences together |
| Hard-split fallback | If a single paragraph > 2 250 chars | Prevents runaway chunks from huge code blocks |

**Example:**

```
Original text (4 000 chars):
  Paragraph A (500 chars)
  Paragraph B (600 chars)
  Paragraph C (700 chars)
  Paragraph D (800 chars)
  Paragraph E (500 chars)
  Paragraph F (900 chars)

Chunks produced:
  Chunk 1: A + B + C  (1 800 chars → fits ≤ 1 500 × 1.5)
  Chunk 2: [tail of C, 200 chars] + D + E  (overlap carries context)
  Chunk 3: [tail of E, 200 chars] + F
```

---

## 10. Embedding Model

**Model:** `BAAI/bge-base-en-v1.5` via Together AI

| Property | Value |
|---|---|
| Dimensions | 768 |
| Max input tokens | 512 |
| Language | English (primary) |
| Similarity metric | Cosine |
| API | `POST https://api.together.xyz/v1/embeddings` |

The same model is used for both **indexing** (chunk embeddings) and **querying** (question embedding). This is required — you must use the same model at both stages or similarity scores are meaningless.

---

## 11. Similarity Search (pgvector)

pgvector's `<=>` operator computes **cosine distance** between two vectors.

```sql
-- cosine distance (lower = more similar)
embedding <=> query_vector::vector

-- cosine similarity (higher = more similar, range 0–1)
1 - (embedding <=> query_vector::vector)
```

The query used in `retrieve_relevant_chunks`:

```sql
SELECT
    content,
    section_title,
    material_title,
    1 - (embedding <=> :qvec::vector) AS similarity
FROM material_chunks
WHERE course_id = :cid
ORDER BY embedding <=> :qvec::vector   -- ascending distance = most similar first
LIMIT 6;
```

This returns the 6 passages whose meaning is closest to the student's question, **scoped strictly to the current course** (`WHERE course_id = :cid`).

---

## 12. API Reference

### `POST /api/ai/chat`

Ask the AI a question about a course.

**Auth:** Any authenticated user (JWT Bearer token)

**Request body:**
```json
{
  "course_id": "uuid",
  "message": "What is gradient descent?",
  "history": [
    { "role": "user",      "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

**Response:**
```json
{
  "reply": "**Gradient descent** is an optimisation algorithm used to..."
}
```

---

### `POST /api/ai/reindex/{course_id}`

Force re-embedding of all materials in a course.

**Auth:** Any authenticated user (JWT Bearer token)

**Response:**
```json
{
  "detail": "Reindexing complete for course 'Introduction to Machine Learning'"
}
```

---

## 13. Full Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INDEXING  (upload time)                      │
│                                                                     │
│  Professor                                                          │
│     │ uploads PDF                                                   │
│     ▼                                                               │
│  course_controller.upload_material()                                │
│     │                                                               │
│     ├─► pdf_to_markdown()  ──► content_text (markdown)             │
│     │                                                               │
│     └─► embed_and_store_material()                                  │
│              │                                                      │
│              ├─► chunker.chunk_text()                               │
│              │       ["chunk1", "chunk2", …]                        │
│              │                                                      │
│              └─► for each chunk:                                    │
│                      embeddings.embed_text(chunk)                   │
│                          Together AI → [f1…f768]                    │
│                      INSERT INTO material_chunks                    │
│                          (content, embedding, course_id, …)         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        QUERYING  (chat time)                        │
│                                                                     │
│  Student / Professor                                                │
│     │ asks "What is backpropagation?"                               │
│     ▼                                                               │
│  POST /api/ai/chat  { course_id, message, history }                │
│     │                                                               │
│     ├─► course_has_chunks?                                          │
│     │       No  → _index_all_materials()  (first-time, one-off)    │
│     │       Yes → continue                                          │
│     │                                                               │
│     ├─► retrieve_relevant_chunks(message, course_id, top_k=6)      │
│     │       embed_text(message) → query_vector                      │
│     │       SELECT … ORDER BY embedding <=> query_vector LIMIT 6   │
│     │       → [{content, section, material, similarity}, …]        │
│     │                                                               │
│     ├─► grok.chat(course_title, chunks, history, message)          │
│     │       Build system prompt with retrieved passages             │
│     │       POST https://api.groq.com/…/chat/completions           │
│     │       model: llama-3.3-70b-versatile                         │
│     │       → reply text (markdown)                                 │
│     │                                                               │
│     └─► { "reply": "…" }  → frontend renders as markdown           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Document generated for PFE project Hub4Learners — April 2026*

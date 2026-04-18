# RAG Pipeline — Complete Rework Documentation
## Hub4Learners AI Chat Feature

---

## Table of Contents

1. [Overview](#1-overview)
2. [Why It Was Reworked](#2-why-it-was-reworked)
3. [Architecture](#3-architecture)
4. [Pipeline Step-by-Step](#4-pipeline-step-by-step)
   - 4.1 [PDF Upload & Indexing (On Upload)](#41-pdf-upload--indexing-on-upload)
   - 4.2 [Lazy Indexing (First Chat)](#42-lazy-indexing-first-chat)
   - 4.3 [Force Reindex](#43-force-reindex)
   - 4.4 [Chat & Retrieval](#44-chat--retrieval)
5. [Files & Their Roles](#5-files--their-roles)
6. [Database — material_chunks Table](#6-database--material_chunks-table)
7. [Backend Implementation Detail](#7-backend-implementation-detail)
   - 7.1 [pdf_text_extractor.py](#71-pdf_text_extractorpy)
   - 7.2 [chunker.py](#72-chunkerpy)
   - 7.3 [embeddings.py](#73-embeddingspy)
   - 7.4 [course_controller.py — upload_material()](#74-course_controllerpy--upload_material)
   - 7.5 [ai_routes.py — _index_all_materials()](#75-ai_routespy--_index_all_materials)
   - 7.6 [ai_routes.py — /chat endpoint](#76-ai_routespy--chat-endpoint)
   - 7.7 [grok.py — chat()](#77-grokpy--chat)
8. [API Reference](#8-api-reference)
9. [Environment Variables](#9-environment-variables)
10. [Files Modified](#10-files-modified)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Business Rules](#12-business-rules)

---

## 1. Overview

The RAG (Retrieval-Augmented Generation) pipeline powers the AI chat panel
inside the course learning page. A student can ask any question about a
course and receive an answer grounded in the actual course PDF materials —
the AI does not guess or hallucinate, it answers only from what the professor
uploaded.

| Component | Technology |
|---|---|
| PDF text extraction | PyMuPDF (`fitz`) |
| Text chunking | Custom Python chunker (`chunker.py`) |
| Embedding model | BAAI/bge-base-en-v1.5 via Together AI (768 dimensions) |
| Vector store | pgvector on Neon PostgreSQL (`material_chunks` table) |
| Similarity search | pgvector `<=>` cosine distance operator |
| LLM for answers | Groq — `llama-3.3-70b-versatile` |
| PDF display (frontend) | `react-pdf` + pdfjs-dist (completely separate from RAG) |

---

## 2. Why It Was Reworked

**Before the rework**, the pipeline depended on `CourseMaterial.content_text`:
- Professors were expected to paste or provide the text content of a PDF
  when uploading it.
- The RAG would read `mat.content_text` to chunk and embed.
- If `content_text` was null (which it almost always was), nothing was
  indexed and the chat had nothing to retrieve.

**After the rework**, the pipeline is fully decoupled from how the PDF is
*displayed*:
- PDFs are displayed in the browser using **react-pdf** reading the raw file
  directly from the server — no text extraction needed for display.
- The RAG extracts text **server-side** using **PyMuPDF**, which reads the
  embedded text layer of the PDF (no OCR, no AI, just the PDF's own text).
- `content_text` is never written and never read by the pipeline.
- The frontend PDF viewer and the backend RAG are completely independent.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  PROFESSOR UPLOADS PDF                                          │
│                                                                 │
│  POST /courses/{id}/sections/{id}/materials                     │
│       │                                                         │
│       ▼                                                         │
│  course_controller.upload_material()                            │
│       │                                                         │
│       ├─► Save file to  uploads/materials/<uuid>.pdf            │
│       │                                                         │
│       ├─► PyMuPDF extracts raw text from the file              │
│       │                                                         │
│       ├─► chunker.chunk_text()  →  list of 1500-char chunks    │
│       │                                                         │
│       └─► embed_and_store_material()                            │
│               │                                                 │
│               ├─► Together AI → 768-dim embedding per chunk    │
│               └─► INSERT INTO material_chunks (pgvector)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STUDENT ASKS A QUESTION                                        │
│                                                                 │
│  POST /ai/chat  { course_id, message, history }                 │
│       │                                                         │
│       ├─► course_has_chunks()?                                  │
│       │       └── NO → _index_all_materials()  (lazy fallback) │
│       │                                                         │
│       ├─► embed_text(message) → query vector                   │
│       │                                                         │
│       ├─► SELECT … FROM material_chunks                         │
│       │   ORDER BY embedding <=> query_vec  LIMIT 6            │
│       │                                                         │
│       ├─► Build context block from top-6 chunks                │
│       │                                                         │
│       └─► Groq llama-3.3-70b  →  answer grounded in chunks    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STUDENT VIEWS PDF (completely separate)                        │
│                                                                 │
│  GET /uploads/materials/<uuid>.pdf                              │
│       │                                                         │
│       └─► react-pdf renders it in the browser                  │
│           (zoom, page nav, scroll-spy — no server involvement) │
└─────────────────────────────────────────────────────────────────┘
```

**File layout after rework:**

```
backend/
├── uploads/
│   └── materials/           ← PDF files stored here
│       └── <uuid>.pdf
├── app/
│   ├── controller/
│   │   └── course_controller.py   ← upload_material() now triggers indexing
│   ├── routes/
│   │   └── ai_routes.py           ← /chat, /reindex endpoints
│   └── utils/
│       ├── pdf_text_extractor.py  ← NEW: PyMuPDF text extraction
│       ├── chunker.py             ← paragraph-aware overlapping chunker
│       ├── embeddings.py          ← Together AI + pgvector
│       └── grok.py                ← Groq LLM call
```

---

## 4. Pipeline Step-by-Step

### 4.1 PDF Upload & Indexing (On Upload)

This is the **primary indexing path** — triggered every time a professor
uploads a PDF material.

```
1. Professor submits multipart form with PDF file
2. _save_file() writes the PDF to uploads/materials/<uuid>.pdf
3. CourseMaterial row is inserted in the database (content_text stays null)
4. upload_material() calls extract_pdf_text(full_path)
   └── PyMuPDF opens the file and reads every page's text layer
   └── Returns one big string: "page1 text\n\npage2 text\n\n..."
5. If extracted text is non-empty:
   └── embed_and_store_material() is called
       ├── DELETE FROM material_chunks WHERE material_id = <id>
       ├── chunk_text() splits text into 1500-char overlapping chunks
       └── For each chunk:
           ├── embed_text() → Together AI API → 768-float vector
           └── INSERT INTO material_chunks (id, material_id, course_id,
               section_title, material_title, chunk_index, content, embedding)
6. Failures are caught silently — a bad PDF never breaks the upload response
```

### 4.2 Lazy Indexing (First Chat)

This is the **fallback path** for materials that were uploaded *before* the
RAG pipeline existed (or for courses with no chunks yet for any reason).

```
1. Student sends first message for a course
2. course_has_chunks(course_id) returns False
3. _index_all_materials(course_id) runs:
   ├── Queries all sections for the course
   ├── For each section, queries all materials
   ├── Skips non-PDF materials (video, audio, exercise)
   ├── Builds file path: uploads/materials/<basename of mat.file_url>
   ├── Checks file exists on disk
   └── Calls extract_pdf_text() + embed_and_store_material() for each PDF
4. After indexing, retrieval proceeds normally
```

### 4.3 Force Reindex

Professors (or admins) can force a full re-embedding of a course's materials:

```
POST /ai/reindex/{course_id}
└── Calls _index_all_materials() unconditionally
    (embed_and_store_material deletes old chunks before inserting new ones)
```

Use this after uploading updated versions of PDFs.

### 4.4 Chat & Retrieval

```
1. Student sends: { course_id, message, history: [{role, content}, ...] }
2. embed_text(message) → 768-float query vector via Together AI
3. pgvector query:
   SELECT content, section_title, material_title,
          1 - (embedding <=> query_vec) AS similarity
   FROM material_chunks
   WHERE course_id = <id>
   ORDER BY embedding <=> query_vec
   LIMIT 6
4. Top 6 chunks are assembled into a context block:
   [Section Name › Material Title]
   <chunk content>
   ---
   [Section Name › Material Title]
   <chunk content>
   ...
5. Groq llama-3.3-70b receives:
   - system prompt with course title + retrieved context
   - conversation history (last 20 turns)
   - the user's new question
6. LLM returns a markdown-formatted answer citing only the retrieved content
7. Response: { reply: "..." }
```

---

## 5. Files & Their Roles

| File | Role |
|---|---|
| `utils/pdf_text_extractor.py` | **NEW** — PyMuPDF text extraction from a file path |
| `utils/chunker.py` | Splits raw text into 1500-char overlapping chunks |
| `utils/embeddings.py` | Together AI calls, pgvector insert/query |
| `utils/grok.py` | Groq LLM call with system prompt + retrieved context |
| `controller/course_controller.py` | On PDF upload: extract → chunk → embed |
| `routes/ai_routes.py` | `/chat` and `/reindex` endpoints |

---

## 6. Database — material_chunks Table

```sql
CREATE TABLE material_chunks (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id    UUID REFERENCES course_materials(id),
    course_id      UUID REFERENCES courses(id),
    section_title  TEXT NOT NULL,
    material_title TEXT NOT NULL,
    chunk_index    INTEGER NOT NULL,
    content        TEXT NOT NULL,
    embedding      vector(768)        -- pgvector column
);
```

**Key points:**
- One row per chunk. A 30-page PDF typically produces 20–60 chunks.
- `embedding vector(768)` stores the BAAI/bge-base-en-v1.5 output.
- The `<=>` operator on `embedding` computes cosine distance (lower = more similar).
- `1 - (embedding <=> query_vec)` converts to cosine *similarity* (higher = more relevant).
- When a material is re-uploaded or re-indexed, all its old chunks are deleted first (`DELETE WHERE material_id = ...`) so there are no duplicates.
- When a course is deleted, `material_chunks` rows are removed first in `delete_course()` using raw SQL.

---

## 7. Backend Implementation Detail

### 7.1 `pdf_text_extractor.py`

**Location:** `backend/app/utils/pdf_text_extractor.py`

```python
import fitz  # PyMuPDF

def extract_pdf_text(file_path: str) -> str:
    doc = fitz.open(file_path)
    pages = []
    for page in doc:
        text = page.get_text("text").strip()
        if text:
            pages.append(text)
    doc.close()
    return "\n\n".join(pages)
```

- Uses `page.get_text("text")` — extracts the embedded text layer only.
- No OCR, no image processing — purely structural text from the PDF spec.
- Scanned PDFs (image-only) will return an empty string; they are silently skipped.
- Pages are joined with `\n\n` so the chunker treats page breaks as paragraph breaks.

### 7.2 `chunker.py`

**Location:** `backend/app/utils/chunker.py`

Splits text into overlapping chunks:
- **Target size:** 1500 characters per chunk
- **Overlap:** 200 characters carried from the end of the previous chunk
- **Strategy:** respects paragraph boundaries (`\n\n` splits), then hard-splits oversized paragraphs
- **Why overlap?** A question about a concept that spans a paragraph boundary will still find a chunk containing both sides.

### 7.3 `embeddings.py`

**Location:** `backend/app/utils/embeddings.py`

| Function | What it does |
|---|---|
| `embed_text(text)` | POST to Together AI, returns list of 768 floats |
| `embed_and_store_material(...)` | Deletes old chunks, chunks text, embeds each chunk, inserts into pgvector |
| `course_has_chunks(course_id, db)` | Returns True if at least 1 chunk exists for the course |
| `retrieve_relevant_chunks(query, course_id, db, top_k)` | Embeds query, runs cosine similarity search, returns top_k dicts |

The embedding model is `BAAI/bge-base-en-v1.5` from HuggingFace, hosted by
Together AI. It produces 768-dimensional vectors optimised for semantic
similarity in retrieval tasks.

### 7.4 `course_controller.py` — `upload_material()`

**What changed:** After saving the file and committing the `CourseMaterial`
row, if the material type is `"pdf"`, the controller now:

1. Builds the absolute path to the saved file using `MATERIALS_DIR` + `filename`
2. Calls `extract_pdf_text(full_path)` to get raw text
3. If text is non-empty, calls `embed_and_store_material()`
4. Wraps everything in `try/except` — embedding failure never blocks the upload

```python
if mat_type == "pdf":
    full_path = os.path.join(MATERIALS_DIR, filename)
    try:
        pdf_text = extract_pdf_text(full_path)
        if pdf_text.strip():
            embed_and_store_material(
                material_id=str(material.id),
                course_id=course_id,
                section_title=section.title,
                material_title=title,
                content_text=pdf_text,
                db=db,
            )
    except Exception:
        pass
```

### 7.5 `ai_routes.py` — `_index_all_materials()`

**What changed:** Completely rewritten. Before:

```python
# OLD — broken: content_text is always null
for mat in materials:
    if mat.content_text:          # ← this was never True
        embed_and_store_material(...)
```

After:

```python
# NEW — reads from disk
for mat in materials:
    if mat.type != "pdf":         # skip video, audio, exercise
        continue
    file_path = os.path.join(_MATERIALS_DIR, os.path.basename(mat.file_url))
    if not os.path.isfile(file_path):  # skip if file was deleted
        continue
    pdf_text = extract_pdf_text(file_path)
    if pdf_text.strip():
        embed_and_store_material(...)
```

`_MATERIALS_DIR` is resolved relative to the routes file:
```python
_MATERIALS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "materials")
# backend/app/routes/ → ../../ → backend/ → uploads/materials/
```

### 7.6 `ai_routes.py` — `/chat` endpoint

```
POST /ai/chat
Auth: Bearer token (any logged-in user)
Body: { course_id, message, history: [{role, content}] }

Flow:
1. Verify course exists
2. If no chunks → _index_all_materials() (lazy init)
3. retrieve_relevant_chunks(message, course_id, top_k=6)
4. grok.chat(course_title, chunks, history, message)
5. Return { reply: "..." }
```

### 7.7 `grok.py` — `chat()`

Builds a system prompt that:
- Identifies the assistant as a study tutor for the specific course
- Pastes the retrieved chunks as context (`[Section › Material]\n<text>`)
- Instructs the LLM to answer only from the provided context
- Enforces markdown formatting in responses

LLM parameters: `temperature=0.4`, `max_tokens=2048`, history limited to
last 20 turns to stay within context limits.

---

## 8. API Reference

### `POST /ai/chat`

Ask the AI a question about a course.

**Auth:** Bearer token (student or professor)

**Request body:**
```json
{
  "course_id": "uuid",
  "message": "What is a probability distribution?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Success 200:**
```json
{ "reply": "A probability distribution is..." }
```

**Error responses:**

| Status | Detail |
|---|---|
| 401 | Not authenticated |
| 404 | Course not found |

---

### `POST /ai/reindex/{course_id}`

Force re-embedding of all PDF materials in a course.

**Auth:** Bearer token (any authenticated user)

**Success 200:**
```json
{ "detail": "Reindexing complete for course 'Statistics 101'" }
```

**Error responses:**

| Status | Detail |
|---|---|
| 401 | Not authenticated |
| 404 | Course not found |

---

## 9. Environment Variables

| Variable | Purpose |
|---|---|
| `TOGETHER_API_KEY` | Together AI — used by `embed_text()` for BAAI/bge-base-en-v1.5 embeddings |
| `GROK_API_KEY` | Groq API — used by `grok.chat()` for llama-3.3-70b-versatile |

Both must be set in `backend/.env`. If `TOGETHER_API_KEY` is missing, embedding returns `None` and chunks are not stored. If `GROK_API_KEY` is missing, chat returns a configuration error message.

---

## 10. Files Modified

| File | Action | Purpose |
|---|---|---|
| `backend/app/utils/pdf_text_extractor.py` | Created | PyMuPDF text extraction from a PDF file path |
| `backend/app/controller/course_controller.py` | Modified | Added PDF extraction + embedding call after file save in `upload_material()` |
| `backend/app/routes/ai_routes.py` | Modified | Rewrote `_index_all_materials()` to read from disk; added `os` import, `_MATERIALS_DIR` constant, `extract_pdf_text` import |

---

## 11. Data Flow Diagrams

### Upload Flow

```
Professor
   │
   │  POST /courses/{id}/sections/{id}/materials
   │  Content-Type: multipart/form-data
   │  fields: title, type="pdf", order_index, file=<pdf>
   │
   ▼
course_controller.upload_material()
   │
   ├─► _save_file()
   │       └── writes to uploads/materials/sectionid_pdf_<uuid>.pdf
   │
   ├─► CourseMaterial INSERT (content_text=null)
   │
   └─► [PDF only]
           │
           ▼
       extract_pdf_text(file_path)
           │
           ▼
       "Chapter 1: Introduction\n\nStatistics is the science of..."
           │
           ▼
       embed_and_store_material()
           │
           ├─► DELETE material_chunks WHERE material_id = <id>
           │
           ├─► chunk_text() → ["Chapter 1: Intro...", "...the mean is", ...]
           │
           └─► for each chunk:
                   ├── Together AI /v1/embeddings → [0.012, -0.34, ...(768)]
                   └── INSERT INTO material_chunks
```

### Chat Flow

```
Student
   │
   │  POST /ai/chat
   │  { course_id, message: "what is the mean?", history: [...] }
   │
   ▼
ai_routes.ai_chat()
   │
   ├─► course_has_chunks(course_id)?
   │       └── NO → _index_all_materials()  [lazy path]
   │                    └── reads PDFs from disk → embed → store
   │
   ├─► embed_text("what is the mean?")
   │       └── Together AI → [0.021, -0.18, ...(768)]
   │
   ├─► SELECT content, section_title, material_title,
   │          1-(embedding <=> query_vec) AS similarity
   │   FROM material_chunks WHERE course_id = ?
   │   ORDER BY embedding <=> query_vec LIMIT 6
   │
   │   Result:
   │   ┌──────────────────────────────────────────────────────┐
   │   │ sim=0.91 [Ch1 › Lecture 1] "The mean is the sum..."  │
   │   │ sim=0.87 [Ch2 › Lecture 3] "...computed as Σx/n..."  │
   │   │ sim=0.83 [Ch1 › Lecture 1] "...also called average"  │
   │   └──────────────────────────────────────────────────────┘
   │
   ├─► Build context:
   │   [Ch1 › Lecture 1]
   │   The mean is the sum of all values...
   │   ---
   │   [Ch2 › Lecture 3]
   │   ...computed as Σx/n...
   │
   └─► Groq llama-3.3-70b
           system: "You are a tutor for 'Statistics 101'.
                    Answer ONLY from these passages: <context>"
           user:   "what is the mean?"
           reply:  "The **mean** (also called the average) is computed
                    as the sum of all values divided by n: **Σx/n**..."
```

---

## 12. Business Rules

| Rule | Where enforced |
|---|---|
| Only PDF materials are indexed for RAG | `upload_material()` (`if mat_type == "pdf"`), `_index_all_materials()` (`if mat.type != "pdf": continue`) |
| Embedding failure never blocks PDF upload | `try/except pass` around the whole extraction + embedding block |
| Old chunks are replaced on re-index | `embed_and_store_material()` deletes by `material_id` before inserting |
| Missing files are silently skipped during lazy indexing | `if not os.path.isfile(file_path): continue` |
| Scanned PDFs with no text layer are skipped | `if pdf_text.strip():` check before embedding |
| `content_text` column is never written or read by the RAG | Extraction goes directly from file → chunks → pgvector |
| Chat retrieves only chunks from the student's course | `WHERE course_id = :cid` in the pgvector query |
| LLM answers only from retrieved context | System prompt instructs: "Answer ONLY based on the retrieved passages" |
| Conversation history is capped at 20 turns | `trimmed = history[-MAX_HISTORY:]` in `grok.py` |

---

*Document generated for PFE project Hub4Learners — April 2026*

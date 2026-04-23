# AI Course Generation from PDF
## Automated PDF → Structured Course Sections & Lessons

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Model](#3-database-model)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [PDF Parser — `pdf_parser.py`](#41-pdf-parser--pdf_parserpy)
   - 4.2 [Course Generator — `course_generator.py`](#42-course-generator--course_generatorpy)
   - 4.3 [Schemas — `course_generation.py`](#43-schemas--course_generationpy)
   - 4.4 [Controller — `course_generation_controller.py`](#44-controller--course_generation_controllerpy)
   - 4.5 [Routes — `course_generation_routes.py`](#45-routes--course_generation_routespy)
   - 4.6 [PDF Text Extraction — `course_routes.py`](#46-pdf-text-extraction--course_routespy)
   - 4.7 [main.py Changes](#47-mainpy-changes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [API Client — `course.ts`](#51-api-client--coursets)
   - 5.2 [Generate from PDF Modal — `ProfessorDashboard.tsx`](#52-generate-from-pdf-modal--professordashboardtsx)
   - 5.3 [Content Viewer — `CourseLearningPage.tsx`](#53-content-viewer--courselearningpagetsx)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

### Problem
Professors must manually write every section, subsection, and lesson of a course from scratch — a time-consuming process even when reference material (textbook, lecture notes, research paper) already exists as a PDF.

### Solution
One-click pipeline: professor uploads a PDF → AI analyzes it → course sections and rich-text lessons are created automatically inside the existing course.

### What the pipeline produces

```
Course (existing)
└── Section 1: "Foundations of Machine Learning"       ← created from PDF heading
│   ├── Lesson: "What is Machine Learning?"            ← full HTML lesson
│   ├── Lesson: "Types of Learning Algorithms"
│   └── Lesson: "Key Terminology"
└── Section 2: "Supervised Learning"
    ├── Lesson: "Linear Regression"
    └── Lesson: "Decision Trees"
```

### Technologies

| Layer | Technology |
|---|---|
| PDF parsing | PyMuPDF (`fitz`) — span-level extraction with font metadata |
| AI model | `gemini-3.1-flash-lite-preview` via `google-generativeai` |
| Async concurrency | `asyncio.gather` + `asyncio.Semaphore(3)` |
| Background jobs | FastAPI `BackgroundTasks` |
| Job persistence | PostgreSQL — `generated_courses` table with JSONB result |
| Content storage | `course_materials.content_text` (TEXT column) |
| Content rendering | `dangerouslySetInnerHTML` with Tailwind prose styles |

---

## 2. Architecture

### High-Level Flow

```
Professor Dashboard
        │
        │  clicks "Generate from PDF"
        ▼
┌─────────────────────────────────┐
│  Modal: Upload PDF + Difficulty │
└───────────────┬─────────────────┘
                │ POST /api/course-gen/upload
                ▼
        ┌───────────────┐
        │  FastAPI      │──► INSERT generated_courses (status=processing)
        │  Route        │──► Return HTTP 202 { job_id }
        └───────────────┘
                │
                └──► BackgroundTask
                            │
                     ┌──────▼──────────────────────────────────────────┐
                     │  STEP 1 — pdf_parser.py                         │
                     │  fitz.open() → extract spans → detect headings  │
                     │  → chunk into 400-1500 word segments             │
                     └──────┬──────────────────────────────────────────┘
                            │ [PDFChunk, ...]
                     ┌──────▼──────────────────────────────────────────┐
                     │  STEP 2 — generate_structure()  [1 Gemini call] │
                     │  → { title, sections: [{ title, subsections }]} │
                     └──────┬──────────────────────────────────────────┘
                            │
                     ┌──────▼──────────────────────────────────────────┐
                     │  STEP 3 — generate_lesson_content()             │
                     │  asyncio.gather (max 3 concurrent Gemini calls) │
                     │  per subsection: keyword-match chunks → HTML    │
                     └──────┬──────────────────────────────────────────┘
                            │
                     ┌──────▼──────────────────────────────────────────┐
                     │  STEP 4 — persist result                        │
                     │  UPDATE generated_courses SET status=completed  │
                     │  SET result = { title, sections[{subsections    │
                     │  [{title, content: "<p>…</p>"}]}] }             │
                     └──────┬──────────────────────────────────────────┘
                            │
        Frontend polls GET /api/course-gen/{job_id} every 3 seconds
                            │
                     status = "completed"
                            │
                     Preview modal shows structure
                            │
                     Professor clicks "Import into Course"
                            │
                     POST /api/course-gen/{job_id}/import/{course_id}
                            │
                     ┌──────▼──────────────────────────────────────────┐
                     │  For each section  → INSERT course_sections     │
                     │  For each subsection → INSERT course_materials  │
                     │    type = "lesson"                              │
                     │    content_text = generated HTML                │
                     │    file_url = "ai-generated"                    │
                     └──────┬──────────────────────────────────────────┘
                            │
                     Course refreshes → AI lessons appear in sidebar
```

### File Tree

```
backend/
└── app/
    ├── utils/
    │   ├── pdf_parser.py              ← NEW   PDF → PDFChunk[]
    │   └── course_generator.py        ← NEW   Gemini pipeline
    ├── models/
    │   ├── generated_course.py        ← NEW   Job tracking table
    │   └── course_material.py         ← MODIFIED  Enum → String(20)
    ├── schemas/
    │   └── course_generation.py       ← NEW   Pydantic I/O
    ├── controller/
    │   └── course_generation_controller.py  ← NEW  CRUD + runner
    ├── routes/
    │   ├── course_generation_routes.py      ← NEW  5 endpoints
    │   └── course_routes.py                 ← MODIFIED  +text extraction
    └── main.py                              ← MODIFIED

frontend/src/
├── api/
│   └── course.ts          ← MODIFIED  +3 generation functions
├── pages/
│   ├── ProfessorDashboard.tsx  ← MODIFIED  +AI modal
│   └── CourseLearningPage.tsx  ← MODIFIED  ContentViewer + MaterialReader
```

---

## 3. Database Model

### `generated_courses` — Job tracking table

| Column | Type | Default | Description |
|---|---|---|---|
| `id` | UUID | `gen_random_uuid()` | Primary key |
| `user_id` | UUID (FK → users) | — | Professor who submitted |
| `pdf_filename` | VARCHAR(255) | — | Original filename |
| `status` | VARCHAR(20) | `processing` | `processing` / `completed` / `failed` |
| `difficulty` | VARCHAR(20) | `intermediate` | `beginner` / `intermediate` / `advanced` |
| `result` | JSONB | NULL | Full generated course JSON |
| `error` | TEXT | NULL | Error message on failure |
| `created_at` | TIMESTAMP | now | Creation time |
| `updated_at` | TIMESTAMP | now | Last status change |

### Status lifecycle

```
upload ──► processing ──► completed
                    └───► failed
```

### `course_materials` — Type column change

| Before | After |
|---|---|
| `Enum("pdf","video","audio","exercise")` | `String(20)` / `VARCHAR(20)` |

This unlocks the new `"lesson"` type for AI-generated content without requiring enum alterations. The change is backward-compatible — existing `pdf`, `video`, `audio`, `exercise` values continue to work unchanged.

### `course_materials` — AI lesson row shape

| Column | Value |
|---|---|
| `type` | `"lesson"` |
| `file_url` | `"ai-generated"` (sentinel — no real file) |
| `content_text` | Full Tiptap-ready HTML string |
| `title` | Subsection title from Gemini |

---

## 4. Backend Implementation

### 4.1 PDF Parser — `pdf_parser.py`

Converts raw PDF bytes into logical `PDFChunk` objects — segments of 400–1500 words that map to one topic each.

**`PDFChunk` dataclass:**
```python
@dataclass
class PDFChunk:
    index: int        # sequential position
    text: str         # raw text of the chunk
    word_count: int
    page_start: int   # first page (1-based)
    page_end: int     # last page
```

**Heading detection algorithm:**
```
median_font_size = median of all span sizes in document

span is heading if:
  size >= median × 1.25          # clearly larger
  OR (bold AND size >= median × 1.08)  # bold + slightly larger
```

**Chunking algorithm:**
```
for each span in document:
    if span is heading AND buffer >= 400 words:
        flush buffer → new PDFChunk
    append span text to buffer
    if buffer >= 1500 words:
        flush buffer → new PDFChunk
flush remaining buffer
```

---

### 4.2 Course Generator — `course_generator.py`

All Gemini AI logic. Three public async functions + one orchestrator.

#### `generate_structure(chunks)` — Step 2

Concatenates all chunk texts (truncated at 40,000 chars) into one prompt, asks Gemini to return the course skeleton.

**JSON retry loop:**
```
attempt 1..3:
    raw = Gemini(prompt)
    strip ```json fences
    json.loads(raw)
        OK  → validate fields → return
        FAIL → sleep 1s → retry
raise ValueError after 3 failures
```

**Strict rules injected into the prompt:**
- 3–7 top-level sections
- 2–5 subsections per section
- Unique, specific, educational titles
- Return raw JSON only — no markdown, no explanations

#### `generate_lesson_content(...)` — Step 3

Generates Tiptap-ready HTML for one subsection.

**Relevant chunk selection:**
```python
# keyword overlap scoring
keywords = {w.lower() for w in subsection_title.split() if len(w) > 3}
ranked   = sorted(chunks, key=lambda c: overlap_count(keywords, c), reverse=True)
reference = top_2_chunks[:6000_chars]
```

**HTML output validation:**
```
if response starts with "<"     → return as-is
elif HTML tag found inside      → slice from first tag
else                            → wrap in <p>…</p>
```

**Allowed HTML tags:** `<p>`, `<h3>`, `<h4>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<pre><code>`, `<blockquote>`

#### `generate_quiz(subsection_title, content_html)` — Bonus

Strips HTML, sends to Gemini, returns 4 multiple-choice questions as a JSON array.

#### `build_full_course(chunks, difficulty)` — Orchestrator

```python
structure = await generate_structure(chunks)   # 1 call

semaphore = asyncio.Semaphore(3)               # rate-limit guard
tasks = [generate_lesson_content(...) for each subsection]
results = await asyncio.gather(*tasks, return_exceptions=True)

# inject content → subsection["content"]
# failed subsections → fallback <p> tag, job continues
```

---

### 4.3 Schemas — `course_generation.py`

| Schema | Direction | Key Fields |
|---|---|---|
| `UploadPDFResponse` | Response | `job_id`, `status`, `message` |
| `JobStatusResponse` | Response | `job_id`, `status`, `difficulty`, `result`, `error`, timestamps |
| `RegenerateSubsectionRequest` | Request | `difficulty` (optional) |
| `RegenerateSubsectionResponse` | Response | `section_index`, `subsection_index`, `content` |
| `QuizQuestion` | Nested | `question`, `options[4]`, `correct_index`, `explanation` |
| `QuizResponse` | Response | `subsection_title`, `questions` |

---

### 4.4 Controller — `course_generation_controller.py`

**`create_job(user_id, filename, difficulty, db)`**
INSERT into `generated_courses`, status = `"processing"`, return row.

**`get_job(job_id, db)`**
Single query by UUID. Returns `None` on bad UUID or missing row.

**`run_pipeline(job_id, pdf_bytes, difficulty)`** — async BackgroundTask
```
own SessionLocal()
    chunks = parse_pdf(pdf_bytes)
    if not chunks → mark failed
    course = await build_full_course(chunks, difficulty)
    mark completed, write result JSON
except any exception:
    mark failed, write error string
finally:
    db.close()
```

The controller owns its own DB session — it never shares one across thread boundaries.

---

### 4.5 Routes — `course_generation_routes.py`

Router prefix: `/api/course-gen`

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/upload` | professor | Upload PDF, start background pipeline |
| `GET` | `/{job_id}` | any user | Poll job status + get result |
| `POST` | `/{job_id}/sections/{s}/subsections/{ss}/regenerate` | professor | Regenerate one subsection's HTML |
| `POST` | `/{job_id}/sections/{s}/subsections/{ss}/quiz` | any user | Generate 4 MCQ questions |
| `POST` | `/{job_id}/import/{course_id}` | professor | Import job result into course DB |

**Import endpoint logic (`POST /{job_id}/import/{course_id}`):**
```python
verify job is completed + belongs to current user
verify course exists + belongs to current user

section_offset = len(existing course sections)   # append, don't overwrite

for s_i, section in enumerate(generated["sections"]):
    INSERT CourseSection(order_index = offset + s_i)
    db.flush()   # get section.id without committing

    for ss_i, sub in enumerate(section["subsections"]):
        INSERT CourseMaterial(
            type         = "lesson",
            file_url     = "ai-generated",
            content_text = sub["content"],
            order_index  = ss_i,
        )

db.commit()
return { sections_created, lessons_created }
```

---

### 4.6 PDF Text Extraction — `course_routes.py`

**`GET /api/courses/materials/{material_id}/text`**

On-demand endpoint used by the student learning page to convert a stored PDF file into readable HTML. Called when `material.type === 'pdf'` and no `content_text` is available.

**`_pdf_to_html(path)` conversion rules:**

| Span characteristic | Output tag |
|---|---|
| `size >= median × 1.35` | `<h2>` |
| `size >= median × 1.15` AND bold | `<h3>` |
| Bold AND `size >= median × 1.02` | `<h4>` |
| Starts with `•`, `-`, `–`, `●`, `*`, `·` | `<ul><li>` |
| Starts with digit + `.` or `)` | `<ol><li>` |
| Everything else | accumulates in `<p>` buffer |

Consecutive `<ul>` / `<ol>` fragments are merged into a single list block.

---

### 4.7 main.py Changes

```python
# 1. Model import (so SQLModel.metadata.create_all picks it up)
from app.models.generated_course import GeneratedCourse

# 2. Router registration
from app.routes.course_generation_routes import router as course_gen_router
app.include_router(course_gen_router, prefix="/api")

# 3. Startup migrations
migrations = [
    ...
    # Convert material_type PG enum → VARCHAR(20) so "lesson" type is accepted
    """
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='course_materials' AND column_name='type'
                   AND udt_name='material_type') THEN
        ALTER TABLE course_materials ALTER COLUMN type TYPE VARCHAR(20) USING type::text;
      END IF;
    END $$;
    """,
    # Job tracking table
    """
    CREATE TABLE IF NOT EXISTS generated_courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pdf_filename VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'processing',
        difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate',
        result JSONB,
        error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_generated_courses_user_id ON generated_courses(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_generated_courses_status  ON generated_courses(status)",
]
```

---

## 5. Frontend Implementation

### 5.1 API Client — `course.ts`

Three new functions added:

```typescript
// Upload PDF → returns job_id immediately
uploadPdfForGeneration(token, file, difficulty)
  → POST /api/course-gen/upload
  → { job_id, status, message }

// Poll job status
pollGenerationJob(token, jobId)
  → GET /api/course-gen/{jobId}
  → GenerationJob { status, result?, error? }

// Import completed job into an existing course
importGeneratedCourse(token, jobId, courseId)
  → POST /api/course-gen/{jobId}/import/{courseId}
  → { sections_created, lessons_created }
```

New interfaces:
```typescript
interface GenerationJob {
  job_id: string
  status: 'processing' | 'completed' | 'failed'
  pdf_filename: string
  difficulty: string
  result?: {
    title: string
    sections: Array<{
      title: string
      subsections: Array<{ title: string; content: string }>
    }>
  }
  error?: string
}
```

---

### 5.2 Generate from PDF Modal — `ProfessorDashboard.tsx`

**Trigger:** Violet "Generate from PDF" button in the Course Sections header.

**Modal phases and UI:**

```
idle
  ┌──────────────────────────────────────────┐
  │  📄 PDF drop zone (click to upload)      │
  │  ┌────────────┬────────────┬──────────┐  │
  │  │  beginner  │ intermediate│ advanced │  │
  │  └────────────┴────────────┴──────────┘  │
  │  [    Start Generation    ]               │
  └──────────────────────────────────────────┘

uploading → HTTP 202 received → switch to polling

processing (polling every 3s)
  ┌──────────────────────────────────────────┐
  │        ◌ animated spinner with AI icon   │
  │  "AI is building your course…"           │
  │  📄 File: lecture_notes.pdf              │
  │  🎯 Difficulty: intermediate             │
  │  ⏳ Status: Processing…                  │
  └──────────────────────────────────────────┘

done (status = "completed")
  ┌──────────────────────────────────────────┐
  │  ✓ Course generated successfully!        │
  │                                          │
  │  Generated title: "Intro to ML"          │
  │                                          │
  │  Structure preview — 5 sections          │
  │  ┌──────────────────────────────────┐    │
  │  │ Foundations of ML               │    │
  │  │  · What is Machine Learning?    │    │
  │  │  · Types of Algorithms          │    │
  │  ├──────────────────────────────────┤    │
  │  │ Supervised Learning             │    │
  │  │  · Linear Regression            │    │
  │  └──────────────────────────────────┘    │
  │  [  Discard  ]  [  Import into Course  ] │
  └──────────────────────────────────────────┘

error
  ┌──────────────────────────────────────────┐
  │           ⚠ Generation failed            │
  │      "PDF contained no text"             │
  │           [  Try again  ]                │
  └──────────────────────────────────────────┘
```

**State machine in `CourseManager`:**

```typescript
aiPhase: 'idle' | 'uploading' | 'processing' | 'done' | 'error'
aiJob:   GenerationJob | null
aiError: string
aiPollRef: ReturnType<typeof setInterval>  // cleared on done/error/close

handleAIUpload():
  setAiPhase('uploading')
  job_id = await uploadPdfForGeneration(token, file, difficulty)
  setAiPhase('processing')
  aiPollRef = setInterval(3000, async () => {
    job = await pollGenerationJob(token, job_id)
    if completed → stopPolling → setAiPhase('done')
    if failed   → stopPolling → setAiError → setAiPhase('error')
  })

handleAIImport():
  await importGeneratedCourse(token, job.job_id, course.id)
  await refresh()         // re-fetch course from API
  setShowAI(false)        // close modal
  resetAI()               // clear all state
```

---

### 5.3 Content Viewer — `CourseLearningPage.tsx`

The learning page no longer uses `react-pdf` or `PdfViewer`. Everything is rendered as rich HTML.

**`MaterialReader` component — priority waterfall:**

```
material.content_text exists?
  YES → render in ContentViewer immediately (no fetch)
  NO  → material.type === 'pdf'?
          YES → GET /api/courses/materials/{id}/text
                    backend extracts PDF → returns { html }
                    render in ContentViewer
          NO  → "No readable content" message

material.type === 'video'?
  → <video> player (unchanged)
```

**`ContentViewer` styling (Tailwind):**

| HTML tag | Visual treatment |
|---|---|
| `<h2>` | Large, bold, white, red bottom border |
| `<h3>` | Semibold, slate, grey bottom border |
| `<h4>` | Smaller semibold, slightly muted |
| `<p>` | 0.9rem, `#CBD5E1`, 1.85 line-height |
| `<ul>` / `<ol>` | Disc/decimal, muted list items |
| `<blockquote>` | Red left border, italic, muted |
| `<pre><code>` | Dark background, monospace, muted teal |
| `<code>` | Inline, `#FF5533`, dark bg pill |

---

## 6. Complete Flow Diagrams

### Happy Path — Professor generates and imports

```
Professor                FastAPI              Gemini AI           PostgreSQL
    │                       │                     │                   │
    │── POST /upload ───────►│                     │                   │
    │                       │── INSERT job ────────────────────────────►│
    │◄── 202 { job_id } ────│                     │                   │
    │                       │                     │                   │
    │ (polls every 3s)      │   [BackgroundTask]  │                   │
    │── GET /{job_id} ──────►│                     │                   │
    │◄── { processing } ────│                     │                   │
    │                       │── parse_pdf()        │                   │
    │                       │── generate_structure ►│                   │
    │                       │◄─ { sections } ─────│                   │
    │                       │══ gather(≤3) ════════►│                   │
    │                       │◄═ HTML per lesson ══│                   │
    │                       │── UPDATE completed ───────────────────────►│
    │                       │                     │                   │
    │── GET /{job_id} ──────►│                     │                   │
    │◄── { completed, result }──────────────────────────────────────── │
    │                       │                     │                   │
    │ (previews structure)  │                     │                   │
    │── POST /import ───────►│                     │                   │
    │                       │── INSERT sections ───────────────────────►│
    │                       │── INSERT materials ──────────────────────►│
    │◄── { sections: 5, lessons: 18 } ─────────────────────────────── │
    │                       │                     │                   │
    │ (course refreshes)    │                     │                   │
```

### Student reads an AI lesson

```
Student                  FastAPI                PostgreSQL
    │                       │                       │
    │── GET /courses/{id} ──►│                       │
    │                       │── SELECT materials ───►│
    │◄── CourseOut { sections[{materials[{           │
    │      type:"lesson",                            │
    │      content_text:"<p>…</p>"                  │
    │    }]}]} ─────────────│                       │
    │                       │                       │
    │  MaterialReader checks content_text            │
    │  → ContentViewer renders HTML                 │
    │  (no extra fetch needed)                      │
```

### Student reads a raw PDF material

```
Student                  FastAPI                  uploads/
    │                       │                        │
    │── GET /materials/{id}/text ──►│                │
    │                       │── open PDF ────────────►│
    │                       │◄─ bytes ───────────────│
    │                       │── fitz extract + format │
    │◄── { html: "<h2>…</h2><p>…</p>" } ────────── │
    │                       │                        │
    │  ContentViewer renders html                    │
```

---

## 7. API Reference

### `POST /api/course-gen/upload`
**Auth:** professor · **Content-Type:** multipart/form-data

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File | Yes | PDF, max 20 MB |
| `difficulty` | string | No | `beginner` / `intermediate` / `advanced` |

**Success — HTTP 202:**
```json
{ "job_id": "uuid", "status": "processing", "message": "..." }
```

---

### `GET /api/course-gen/{job_id}`
**Auth:** any user

**Response — processing:**
```json
{ "job_id": "...", "status": "processing", "result": null, "error": null }
```

**Response — completed:**
```json
{
  "job_id": "...",
  "status": "completed",
  "result": {
    "title": "Introduction to Machine Learning",
    "sections": [
      {
        "title": "Foundations",
        "subsections": [
          { "title": "What is ML?", "content": "<p>...</p><ul>...</ul>" }
        ]
      }
    ]
  }
}
```

---

### `POST /api/course-gen/{job_id}/import/{course_id}`
**Auth:** professor (must own both job and course)

**Success — HTTP 200:**
```json
{
  "detail": "Import successful",
  "course_id": "uuid",
  "sections_created": 5,
  "lessons_created": 18
}
```

| Error | Status | Reason |
|---|---|---|
| Job not found | 404 | Invalid job_id |
| Job not completed | 400 | Still processing or failed |
| Access denied | 403 | Job or course belongs to another user |
| Course not found | 404 | Invalid course_id |

---

### `POST /api/course-gen/{job_id}/sections/{s}/subsections/{ss}/regenerate`
**Auth:** professor

Regenerates the HTML content of a single subsection without re-running the full pipeline.

**Request body:**
```json
{ "difficulty": "advanced" }
```

**Response:**
```json
{
  "section_index": 0,
  "subsection_index": 2,
  "subsection_title": "Gradient Descent",
  "content": "<p>Gradient descent is…</p><pre><code>lr = 0.01…</code></pre>"
}
```

---

### `POST /api/course-gen/{job_id}/sections/{s}/subsections/{ss}/quiz`
**Auth:** any user

**Response:**
```json
{
  "subsection_title": "Gradient Descent",
  "questions": [
    {
      "question": "What does gradient descent minimize?",
      "options": ["Accuracy", "Loss function", "Learning rate", "Batch size"],
      "correct_index": 1,
      "explanation": "Gradient descent iteratively reduces the loss function."
    }
  ]
}
```

---

### `GET /api/courses/materials/{material_id}/text`
**Auth:** any user

Extracts and returns the text content of a PDF material as HTML. Called by `MaterialReader` in the learning page when `content_text` is not pre-populated.

**Response:**
```json
{ "html": "<h2>Chapter 1</h2><p>...</p><ul><li>...</li></ul>" }
```

---

## 8. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `backend/app/utils/pdf_parser.py` | Created | PyMuPDF span extraction, heading detection, word-count chunking |
| `backend/app/utils/course_generator.py` | Created | Gemini structure + lesson + quiz generation, JSON retry, concurrency cap |
| `backend/app/models/generated_course.py` | Created | SQLModel table with JSONB result column |
| `backend/app/models/course_material.py` | Modified | `Enum` → `String(20)` — unlocks `"lesson"` type |
| `backend/app/schemas/course_generation.py` | Created | Pydantic request / response shapes |
| `backend/app/controller/course_generation_controller.py` | Created | DB CRUD + async background pipeline runner |
| `backend/app/routes/course_generation_routes.py` | Created | 5 endpoints: upload, poll, regenerate, quiz, import |
| `backend/app/routes/course_routes.py` | Modified | Added `GET /materials/{id}/text` PDF-to-HTML endpoint |
| `backend/app/main.py` | Modified | Model import, router registration, 3 new migrations |
| `frontend/src/api/course.ts` | Modified | `GenerationJob`, `ImportResult` types + 3 API functions |
| `frontend/src/pages/ProfessorDashboard.tsx` | Modified | AI generation modal with 4-phase state machine |
| `frontend/src/pages/CourseLearningPage.tsx` | Modified | Removed `PdfViewer`, added `MaterialReader` + `ContentViewer` |

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|---|---|
| Only professors can upload PDFs, import, and regenerate | `require_role("professor")` dependency |
| Any authenticated user can poll job status or request a quiz | `get_current_user` dependency |
| A professor can only access their own generation jobs | `_assert_owner()` in routes |
| A professor can only import into courses they own | `course.professor_id` check in import endpoint |
| PDF size capped at 20 MB | Route validates after `await file.read()` |
| Difficulty must be beginner / intermediate / advanced | Silently defaults to `intermediate` if invalid |
| Gemini JSON responses retried up to 3 times | `_call_json()` in `course_generator.py` |
| Max 3 concurrent Gemini calls during content generation | `asyncio.Semaphore(3)` in `build_full_course()` |
| A failed subsection does not abort the whole job | `return_exceptions=True` in `asyncio.gather()` |
| Background task owns its own DB session | `SessionLocal()` opened/closed inside `run_pipeline()` |
| AI sections are appended after existing sections | `order_index = len(existing_sections) + i` |
| `"lesson"` type materials are rendered as HTML, never downloaded | `MaterialReader` checks `content_text` first |
| SQLAlchemy no longer validates material type at Python level | `CourseMaterial.type` uses `String(20)` not `Enum` |

---

*Document generated for PFE project Hub4Learners — April 2026*

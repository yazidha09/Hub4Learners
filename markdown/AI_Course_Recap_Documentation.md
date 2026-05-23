# AI Course Recap

### Generating a polished, exam-ready markdown summary of an entire course on demand

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Models](#3-database-models)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

### Problem

Students finishing a Hub4Learners course often want a **single dense recap** that covers everything they just studied — overview, learning outcomes, key concepts per section, a cheat sheet for revision, and pointers for what to do next. Re-reading every lesson is slow; the AI chat only answers one question at a time. There was no holistic, printable view of the entire course.

### Solution

A **per-course AI-generated markdown recap**, rendered at the bottom of the learning page. The student clicks **Generate**, and Gemini produces a structured markdown document that mirrors the course's own section layout. The result is **persisted on the `courses` row** so it's instant on every subsequent visit, with a **Regenerate** button when the course content changes.

A deliberate design choice: **the recap pipeline does NOT use RAG**. RAG retrieves the *top-k* chunks closest to a query — the wrong tool for "summarize everything." Instead the endpoint pulls the *full* collected course content (`collect_course_content()`) and sends it to Gemini in one shot, defensively capped at 180k characters.

### Technologies

| Layer        | Tool                                              | Purpose                                           |
| ------------ | ------------------------------------------------- | ------------------------------------------------- |
| LLM          | Gemini `gemini-3.1-flash-lite-preview`            | Markdown recap generation                         |
| Backend      | FastAPI + SQLModel                                | Endpoints + persistence                           |
| DB           | PostgreSQL (Neon)                                 | Cache the generated markdown on `courses`        |
| Markdown     | `react-markdown` v10 + `remark-gfm`               | GFM tables (cheat sheet) + dark prose styling    |
| Content src  | `collect_course_content()` from `utils/rag.py`    | Reuses the indexer's text collector              |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            FRONTEND                                 │
│  CourseLearningPage.tsx                                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  on mount  ─►  GET /api/ai/course-summary/{id}  (cached)     │   │
│  │  Generate  ─►  POST /api/ai/course-summary/{id} (regenerate) │   │
│  │  render    ─►  <ReactMarkdown remarkPlugins={[remarkGfm]}/>  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │ HTTPS · JWT
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            BACKEND                                  │
│  routes/ai_routes.py                                                │
│  ┌────────────────────────────┐    ┌─────────────────────────────┐  │
│  │ GET  /ai/course-summary/id │    │ POST /ai/course-summary/id  │  │
│  │ (read cached column)       │    │ (regenerate + persist)      │  │
│  └────────────┬───────────────┘    └──────────────┬──────────────┘  │
│               │                                   │                 │
│               ▼                                   ▼                 │
│       courses.ai_summary           ┌──────────────────────────────┐ │
│       courses.ai_summary_         │  utils/rag.py                 │ │
│         generated_at              │  collect_course_content()    │ │
│                                   │  → all sections + lessons +  │ │
│                                   │    parsed PDF text            │ │
│                                   └──────────────┬───────────────┘ │
│                                                  ▼                 │
│                                   ┌──────────────────────────────┐ │
│                                   │  utils/gemini.py             │ │
│                                   │  generate_course_summary()   │ │
│                                   │  → strict markdown prompt    │ │
│                                   │  → Gemini single-shot call   │ │
│                                   └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### File tree (touched/added)

```
backend/
  app/
    models/
      courses.py             ← + ai_summary, ai_summary_generated_at
    routes/
      ai_routes.py           ← + GET/POST /course-summary/{course_id}
    utils/
      gemini.py              ← + generate_course_summary()
    main.py                  ← + 2 ALTER TABLE migrations
frontend/
  package.json               ← + remark-gfm dependency
  src/
    api/
      qcm.ts                 ← + CourseSummaryOut type + 2 client fns
    pages/
      CourseLearningPage.tsx ← + state, effects, handler, recap panel
```

---

## 3. Database Models

### `courses` (extended)

Two new columns added — both nullable, both backed by an idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS` migration in `main.py`.

| Field                     | Type                  | Nullable | Purpose                                         |
| ------------------------- | --------------------- | -------- | ----------------------------------------------- |
| `ai_summary`              | `TEXT`                | yes      | Cached markdown recap (whole document)          |
| `ai_summary_generated_at` | `TIMESTAMP`           | yes      | Last regeneration time, shown in the UI         |

No new tables are introduced — caching the recap on `courses` is the natural owner since there is at most one summary per course.

---

## 4. Backend Implementation

### 4.1 Util · `app/utils/gemini.py`

A new function `generate_course_summary(course_title, course_description, sections)` produces the markdown recap.

```python
SUMMARY_MODEL = "gemini-3.1-flash-lite-preview"
SUMMARY_MAX_INPUT_CHARS = 180_000   # defensive cap — large courses get truncated, not rejected
```

- **Input shape** — `sections` is a list of `{ "title": str, "items": [{ "label": str, "text": str }] }`, already stripped to plain text by the route.
- **System prompt** enforces the document structure:
  - `## Course Recap` heading
  - **Overview** — 2-3 sentence paragraph
  - `### Learning Outcomes` — 4-7 bullets, each starting with an action verb
  - `### Key Concepts` — one `#### Section Title` per source section, 3-6 bullets each, **bold** key terms on first mention
  - `### Quick-Reference Cheat Sheet` — markdown table with `Concept | What to remember`, 6-10 rows
  - `### Next Steps` — 2-4 bullets
- **Style guard** — *"Stay strictly grounded in the provided course content — do not invent topics the course did not cover."*
- **Output cleanup** — strips a wrapping ` ```markdown ... ``` ` fence if Gemini adds one.
- **Errors** — `RuntimeError("gemini_api_key is not set")` is raised eagerly so the endpoint surfaces a real 500, never silently caches a failure string.

### 4.2 Route · `app/routes/ai_routes.py`

Two new endpoints under the existing `/ai` router. Both require auth via `get_current_user`.

#### Schema

```python
class CourseSummaryOut(BaseModel):
    course_id: str
    summary: Optional[str] = None
    generated_at: Optional[datetime] = None
```

#### Helper · `_build_summary_sections(course_id, db)`

Calls `collect_course_content(course_id, db)` (reused from the RAG indexer) and **groups items by their source section** so the LLM can mirror the course's own outline. HTML-bearing lesson blocks are stripped to plain text via `_html_to_text()` before being handed to Gemini.

#### `GET /ai/course-summary/{course_id}`

Reads `course.ai_summary` and `course.ai_summary_generated_at` directly. **No LLM call.** Returns `null` summary on cache miss — the frontend treats that as "not yet generated."

#### `POST /ai/course-summary/{course_id}`

1. Loads the course (404 if missing).
2. Builds grouped sections; if every item's text is empty, returns **400** (`"Course has no text content yet — add lessons before generating a summary."`).
3. Calls `generate_course_summary()`. On exception, logs traceback and returns **500**.
4. Writes the result to `course.ai_summary` + `ai_summary_generated_at = datetime.utcnow()`, commits.
5. Returns the fresh `CourseSummaryOut`.

### 4.3 Migrations · `app/main.py`

Two lines added inside the existing startup migration list — idempotent and safe to run repeatedly:

```python
"ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_summary TEXT",
"ALTER TABLE courses ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMP",
```

---

## 5. Frontend Implementation

### 5.1 API service · `frontend/src/api/qcm.ts`

New type + two client functions, colocated with the AI/QCM clients (same router prefix on the backend):

```typescript
export interface CourseSummaryOut {
  course_id: string
  summary?: string | null
  generated_at?: string | null
}

export function getCourseSummary(token, courseId): Promise<CourseSummaryOut>
export function regenerateCourseSummary(token, courseId): Promise<CourseSummaryOut>
```

### 5.2 `CourseLearningPage.tsx`

#### New state

```typescript
const [summaryMd, setSummaryMd]                   = useState<string | null>(null)
const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null)
const [summaryGenerating, setSummaryGenerating]   = useState(false)
const [summaryError, setSummaryError]             = useState('')
```

#### Cache load on mount

```typescript
useEffect(() => {
  if (!courseId || !token || isPreview) return
  getCourseSummary(token, courseId).then(s => {
    setSummaryMd(s.summary ?? null)
    setSummaryGeneratedAt(s.generated_at ?? null)
  }).catch(() => {})
}, [courseId, token, isPreview])
```

#### Generate / regenerate handler

```typescript
const handleGenerateSummary = async () => {
  if (!courseId || !token || summaryGenerating) return
  setSummaryGenerating(true); setSummaryError('')
  try {
    const s = await regenerateCourseSummary(token, courseId)
    setSummaryMd(s.summary ?? null)
    setSummaryGeneratedAt(s.generated_at ?? null)
  } catch (e) {
    setSummaryError(e instanceof Error ? e.message : 'Could not generate summary.')
  } finally { setSummaryGenerating(false) }
}
```

#### Recap panel — UI mockup

Inserted between **AI Knowledge Checks** and **Student Reviews**, restricted to enrolled / non-preview views.

```
─────────────  AI COURSE RECAP  ─────────────

╭─────────────────────────────────────────────╮
│ ┃ 📓  Smart course recap          [↻ Re-  ] │
│ ┃     A polished AI-generated      [generate]│
│ ┃     summary covering every                 │
│ ┃     section — learning outcomes,           │
│ ┃     key concepts, and a cheat              │
│ ┃     sheet you can revise from.             │
│ ┃     Last generated May 8, 2026, 14:02      │
├─────────────────────────────────────────────┤
│                                             │
│  ## Course Recap                            │
│  ─────────────────────────────              │
│  Short overview paragraph...                │
│                                             │
│  ### Learning Outcomes                      │
│   • Understand …                            │
│   • Apply …                                 │
│   • Build …                                 │
│                                             │
│  ### Key Concepts                           │
│  #### SECTION 1: INTRODUCTION               │
│   • **Term** — definition…                  │
│                                             │
│  ### Quick-Reference Cheat Sheet            │
│  ┌──────────────┬────────────────────────┐  │
│  │ Concept      │ What to remember       │  │
│  ├──────────────┼────────────────────────┤  │
│  │ Big-O        │ Asymptotic upper bound │  │
│  │ Recursion    │ Base case is mandatory │  │
│  └──────────────┴────────────────────────┘  │
│                                             │
│  ### Next Steps                             │
│   • Try …                                   │
│                                             │
╰─────────────────────────────────────────────╯
```

The card is wrapped in a `prose prose-invert` container with custom Tailwind selectors so headings (`h2/h3/h4`), bullets, tables, code, and blockquotes all match the dark course theme:

- `h2` — bold white, bottom-bordered with `#FF5533/35`
- `h4` — uppercase tracking, `#FF5533` accent (perfect for section headers)
- table — rounded, `#1A1D25` thead, hover-highlighted rows in `#FF5533/[0.03]`
- inline `code` — orange on `#1A1D25` panel
- bold — pure white, regular text — `#CBD5E1`

#### Empty state

When `summaryMd` is `null` (never generated), the body shows a centered placeholder with a sparkles icon and the message *"Generate a structured AI summary of the full course — perfect for last-minute revision."*

#### Markdown rendering

```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryMd}</ReactMarkdown>
```

`remark-gfm` (newly installed) is **required** so the cheat-sheet table actually renders as a `<table>` instead of being passed through as plain text.

---

## 6. Complete Flow Diagrams

### 6.1 First view — empty state

```
Student opens course
        │
        ▼
[Page mounts, useEffect fires]
        │
        ▼
GET /api/ai/course-summary/{id}  ──►  course.ai_summary IS NULL
        │                                    │
        ▼                                    ▼
summary=null returned             setSummaryMd(null)
                                             │
                                             ▼
                              Recap panel renders empty state
                              with "Generate" button
```

### 6.2 Generation — happy path

```
Student clicks [✨ Generate]
        │
        ▼
setSummaryGenerating(true)
        │
        ▼
POST /api/ai/course-summary/{id}
        │
        ▼
load Course(id)
        │
        ▼
collect_course_content(id, db)            ◄── reuses RAG collector
        │  ├─ Course Overview chunk
        │  ├─ All text LessonBlocks (new + legacy hierarchies)
        │  └─ All CourseMaterial.content_text (parsed PDFs)
        ▼
_build_summary_sections()                  ◄── HTML→text + group by section
        │
        ▼
generate_course_summary(title, desc, sections)
        │
        ▼  Gemini single-shot, 180k char cap
        ▼
markdown reply
        │
        ▼
course.ai_summary = markdown
course.ai_summary_generated_at = utcnow()
db.commit()
        │
        ▼
return CourseSummaryOut
        │
        ▼
[frontend] setSummaryMd(...), setSummaryGeneratedAt(...)
        │
        ▼
ReactMarkdown re-renders → recap is visible
```

### 6.3 Subsequent visits — cache hit

```
Student opens course (anytime later)
        │
        ▼
GET /api/ai/course-summary/{id}            ◄── single SELECT, no Gemini call
        │
        ▼
summary=<cached markdown> + generated_at returned
        │
        ▼
Recap panel renders immediately with timestamp:
"Last generated May 8, 2026, 14:02"
[↻ Regenerate] button stays available for refresh
```

### 6.4 Edge case — empty course

```
POST /api/ai/course-summary/{id}
        │
        ▼
collect_course_content() → all items have empty text
        │
        ▼
HTTPException 400:
"Course has no text content yet — add lessons
 before generating a summary."
        │
        ▼
[frontend] setSummaryError(detail)
red banner shown above the empty-state placeholder
```

---

## 7. API Reference

All endpoints are mounted under `/api` and require a Bearer token.

### `GET /api/ai/course-summary/{course_id}`

Returns the cached recap if one exists. Cheap — does **not** call Gemini.

| Param        | Where | Type | Required | Notes               |
| ------------ | ----- | ---- | -------- | ------------------- |
| `course_id`  | path  | UUID | yes      | Target course       |

**200 OK**
```json
{
  "course_id": "f1a2…",
  "summary": "## Course Recap\n\n…",
  "generated_at": "2026-05-08T14:02:11.123456"
}
```

When the cache is empty:
```json
{ "course_id": "f1a2…", "summary": null, "generated_at": null }
```

| Status | When |
| ------ | ---- |
| `404`  | Course not found |
| `401`  | Missing / invalid token |

### `POST /api/ai/course-summary/{course_id}`

Synchronously regenerates the markdown recap, persists it on the `courses` row, and returns it. Subsequent `GET`s hit the new cache.

| Param        | Where | Type | Required | Notes               |
| ------------ | ----- | ---- | -------- | ------------------- |
| `course_id`  | path  | UUID | yes      | Target course       |

Body: *(none)*

**200 OK** — same shape as `GET`, with the freshly generated `summary` and `generated_at = now()`.

| Status | When |
| ------ | ---- |
| `400`  | Course has no text content (empty lessons + no parsed PDFs) |
| `404`  | Course not found |
| `500`  | Gemini call failed (`gemini_api_key` missing, network, etc.) |
| `401`  | Missing / invalid token |

---

## 8. Files Created / Modified

| File                                                      | Action   | Purpose                                                                                  |
| --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `backend/app/models/courses.py`                           | modified | Added `ai_summary` (Text) and `ai_summary_generated_at` (Timestamp) columns              |
| `backend/app/main.py`                                     | modified | Two `ALTER TABLE ADD COLUMN IF NOT EXISTS` lines in the startup migration list          |
| `backend/app/utils/gemini.py`                             | modified | Added `re` import + `generate_course_summary()` with strict structured prompt           |
| `backend/app/routes/ai_routes.py`                         | modified | Added `CourseSummaryOut`, `_html_to_text`, `_build_summary_sections`, GET + POST endpoints |
| `frontend/src/api/qcm.ts`                                 | modified | Added `CourseSummaryOut`, `getCourseSummary`, `regenerateCourseSummary`                  |
| `frontend/src/pages/CourseLearningPage.tsx`               | modified | Imports, state, fetch effect, handler, recap panel UI between Knowledge Checks & Reviews |
| `frontend/package.json`                                   | modified | Added `remark-gfm` dependency for GFM table rendering                                    |

---

## 9. Business Rules & Validation

| Rule                                                                                                  | Where enforced                                                |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Endpoint requires authentication                                                                      | `Depends(get_current_user)` on both routes                    |
| Course must exist                                                                                     | `db.query(Course).filter(...)` → 404                          |
| Cannot generate when there is no extractable text in any lesson or material                           | `_build_summary_sections` + 400 in `POST` route               |
| Recap is **single-shot, full-content** — no RAG retrieval is performed for summary generation         | `regenerate_course_summary` calls `collect_course_content` directly, never `search_course` |
| Input length capped at 180k chars before sending to Gemini                                            | `SUMMARY_MAX_INPUT_CHARS` in `gemini.py` (truncates with marker, never rejects) |
| One cached summary per course (overwrites on regenerate)                                              | Single `ai_summary` column on `courses` row                   |
| Recap card is hidden in preview mode and when the user is not authenticated                           | `{!isPreview && token && (...)}` guard in `CourseLearningPage` |
| Cache hit costs 1 SELECT — no LLM call on repeat visits                                               | `GET /ai/course-summary/{id}` reads only the persisted column |
| HTML in lesson blocks is stripped to plain text before reaching the LLM                               | `_html_to_text()` in the route                                |
| If Gemini returns a wrapping ` ```markdown … ``` ` fence, it is stripped before persisting            | Final regex cleanup in `generate_course_summary`              |
| Markdown rendering uses GFM (tables) via `remark-gfm`; chat panel still uses default markdown         | Plugin scoped to the recap `<ReactMarkdown>` only             |

---

*Document generated for PFE project Hub4Learners — March 2026*

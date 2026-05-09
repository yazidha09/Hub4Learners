# AI-Generated QCM (Quiz) Feature
## End-of-Section & Final Exam Knowledge Checks for Hub4Learners

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
Students who finished a section or a whole course had no way to **self-assess** what they had actually learned. The platform tracked which lessons they'd marked as "done", but completion ≠ comprehension. There was no checkpoint that pushed them to recall, apply, and reason about the material.

### Solution
After completing a **section** (all subsections / materials marked done) or the **entire course** (100% progress), the student can launch an **AI-generated multiple-choice quiz (QCM)** with three difficulty levels:

| Difficulty | # Questions | Style                                            |
|------------|-------------|--------------------------------------------------|
| Easy       | 5           | Recall, definitions, basic comprehension         |
| Medium     | 8           | Application, moderate comprehension              |
| Hard       | 10          | Analysis, synthesis, scenario-based reasoning    |

Each attempt:
- Is **regenerated fresh** by Gemini (no cached question pools — retakes feel different).
- Pulls **scope-specific course content** via the existing **Pinecone RAG pipeline** (falls back to a raw text dump if Pinecone is empty).
- Returns 4-option questions with a `correct_index` and a 1-2 sentence **explanation** for every question.
- Is graded server-side, persisted as a `QCMAttempt` row, and returns per-question feedback.
- Is marked **passed** at **≥ 70 %**.
- Is fully **optional** — the QCM does **not** gate course completion in any way.

### Technologies

| Layer    | Tools / Libraries                                      |
|----------|--------------------------------------------------------|
| Backend  | FastAPI · SQLModel · SQLAlchemy · PostgreSQL (Neon)   |
| AI       | Google Gemini (`gemini-3.1-flash-lite-preview`)        |
| RAG      | Pinecone (existing index `hub4learners`)               |
| Auth     | JWT (`python-jose`) — reuses `get_current_user`        |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS           |

---

## 2. Architecture

```
┌────────────────────────────── FRONTEND ─────────────────────────────┐
│                                                                      │
│  CourseLearningPage.tsx                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AI Knowledge Checks panel                                   │    │
│  │   ├─ Section 1 quiz card  (locked / unlocked + best score)   │    │
│  │   ├─ Section 2 quiz card                                     │    │
│  │   ├─ ...                                                     │    │
│  │   └─ Final Exam card  (gated by 100% progress)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                            │ click "Take Quiz"                       │
│                            ▼                                          │
│  QCMModal.tsx       (pick → loading → quiz → results)                │
│                            │                                          │
│                            │ fetch (qcm.ts)                          │
└────────────────────────────┼──────────────────────────────────────────┘
                             │  POST /api/ai/qcm/generate
                             │  POST /api/ai/qcm/submit
                             │  GET  /api/ai/qcm/history
                             ▼
┌────────────────────────────── BACKEND ──────────────────────────────┐
│                                                                      │
│  ai_routes.py    (router /api/ai/qcm/*)                              │
│        │                                                              │
│        ▼                                                              │
│  qcm_controller.py                                                   │
│        │                                                              │
│        ├─ generate_qcm() ──► search_course() (Pinecone RAG)          │
│        │                       │                                      │
│        │                       └─► fallback: raw LessonBlock text     │
│        │                                                              │
│        ├─ Gemini (system prompt + JSON schema enforcement)            │
│        │                                                              │
│        ├─ submit_qcm() ──► QCMAttempt INSERT (PostgreSQL)            │
│        │                                                              │
│        └─ list_attempts() ──► QCMAttempt SELECT                       │
└──────────────────────────────────────────────────────────────────────┘

File tree (changes only):
backend/app/
├── models/
│   └── qcm_attempt.py            (NEW)
├── schemas/
│   └── qcm.py                    (NEW)
├── controller/
│   └── qcm_controller.py         (NEW)
├── routes/
│   └── ai_routes.py              (MOD: 3 new endpoints)
└── main.py                       (MOD: model import + migration)

frontend/src/
├── api/
│   └── qcm.ts                    (NEW)
├── components/
│   └── QCMModal.tsx              (NEW)
└── pages/
    └── CourseLearningPage.tsx    (MOD: cards + modal mount)
```

---

## 3. Database Models

### `qcm_attempts` table

One row per student submission. Questions and answers are stored as JSON so retakes/audits can replay the exact attempt without joining a question pool table.

| Column           | Type            | Constraints                                                    |
|------------------|-----------------|----------------------------------------------------------------|
| `id`             | UUID            | PK, default `gen_random_uuid()`                                |
| `student_id`     | UUID            | FK → `users.id`, ON DELETE CASCADE, indexed                    |
| `course_id`      | UUID            | FK → `courses.id`, ON DELETE CASCADE, indexed                  |
| `section_id`     | UUID            | FK → `course_sections.id`, ON DELETE SET NULL, **nullable**, indexed |
| `difficulty`     | VARCHAR(16)     | `'easy'` / `'medium'` / `'hard'`                               |
| `score`          | INTEGER         | Number of correct answers                                      |
| `total`          | INTEGER         | Total number of questions                                      |
| `passed`         | BOOLEAN         | `true` if `score / total ≥ 0.70`                               |
| `questions_json` | TEXT            | Full questions array serialized as JSON                        |
| `answers_json`   | TEXT            | Student's chosen indices serialized as JSON                    |
| `completed_at`   | TIMESTAMP       | Default `CURRENT_TIMESTAMP`                                    |

### Pass threshold
Defined as a single source of truth in `qcm_attempt.py`:

```python
PASS_THRESHOLD_PCT = 70.0
```

### Scope semantics
- `section_id IS NOT NULL` → section quiz (per-section knowledge check)
- `section_id IS NULL`     → course-wide final exam

---

## 4. Backend Implementation

### 4.1 Schemas — `schemas/qcm.py`

| Schema              | Purpose                                                    |
|---------------------|------------------------------------------------------------|
| `QCMQuestion`       | `{question, options[4], correct_index, explanation}`       |
| `QCMGenerateIn`     | Request body for generation                                |
| `QCMGenerateOut`    | Response — list of `QCMQuestion`                           |
| `QCMSubmitIn`       | Submission — questions + chosen answer indices             |
| `QCMQuestionResult` | Per-question feedback row (correct vs chosen + explanation)|
| `QCMSubmitOut`      | Score, pct, passed flag, threshold, full results array     |
| `QCMAttemptOut`     | History row (no questions/answers — summary only)          |

### 4.2 Controller — `controller/qcm_controller.py`

#### `generate_qcm(course_id, section_id?, difficulty, db)`
1. Normalises difficulty → looks up `DIFFICULTY_CONFIG` (count + style).
2. Loads the course (and section if scoped).
3. **Tries Pinecone first** via `search_course()` with a query like *"key concepts from the section X of course Y"* (top-k = 8). If results come back, they form the AI context.
4. **Fallback**: pulls every text-block `LessonBlock` for that scope (section's subsections + legacy section blocks, or the whole course). HTML is stripped via `_strip_html()`. Total context capped at **12 000 characters** to stay safely under the model's input window.
5. If no text exists at all → `400` ("Not enough text content").
6. Configures Gemini with `gemini_api_key` (read at **call time** so `.env` loaded later in the import chain still applies).
7. Calls Gemini with a strict **system prompt** that requires raw JSON output (no markdown fences, no prose). The prompt also explicitly tells the model to **distribute `correct_index` evenly across 0–3** to avoid an "always B" failure mode.
8. **Robust JSON parsing**: `_extract_json()` strips ``` fences and uses a regex to grab the first `[{...}]` array if the model adds prose around it. `_validate_questions()` then drops any malformed item (wrong option count, non-string options, out-of-range correct_index) and rejects the response if too few valid questions remain.

#### `submit_qcm(student_id, course_id, section_id?, difficulty, questions, answers, db)`
1. Validates question/answer length parity.
2. Iterates through `(question, chosen_index)` pairs, building `QCMQuestionResult` items and incrementing `score`.
3. Computes `score_pct = round(score / total * 100, 1)`.
4. `passed = score_pct >= PASS_THRESHOLD_PCT` (70.0).
5. Persists a `QCMAttempt` row (questions and answers serialized via `json.dumps`).
6. Returns the full grading payload + `attempt_id`.

#### `list_attempts(student_id, course_id, db)`
Returns all attempts for a course, newest first, as lightweight `QCMAttemptOut` summaries.

### 4.3 Routes — `routes/ai_routes.py`

Three new endpoints registered under the existing `/api/ai` router:

```python
POST   /api/ai/qcm/generate     → QCMGenerateOut
POST   /api/ai/qcm/submit       → QCMSubmitOut
GET    /api/ai/qcm/history      → list[QCMAttemptOut]
```

All require `Authorization: Bearer <jwt>` (uses the shared `get_current_user` dependency).

### 4.4 Migration — `main.py`

Added an idempotent `CREATE TABLE IF NOT EXISTS qcm_attempts (...)` plus three indexes (`student_id`, `course_id`, `section_id`) to the existing on-startup migration list. Also registered `QCMAttempt` in the model import block so `SQLModel.metadata.create_all` knows about it.

### 4.5 Env-var loading fix

Initial bug: the controller read `os.getenv("gemini_api_key")` at module import time. Because `qcm_controller` is imported **before** `app.utils.gemini` (which calls `load_dotenv()`), the key came back as `None` → "AI is not configured."

**Fix**: call `load_dotenv()` at the top of `qcm_controller.py` and read the env var at function-call time inside `generate_qcm()`.

---

## 5. Frontend Implementation

### 5.1 API Client — `api/qcm.ts`

Vanilla `fetch` (matches existing `course.ts` style). Three exported functions:

```ts
generateQCM(token, courseId, difficulty, sectionId?)   → QCMGenerateOut
submitQCM(token, courseId, difficulty, questions, answers, sectionId?) → QCMSubmitOut
getQCMHistory(token, courseId)                          → QCMAttemptOut[]
```

JWT is attached via the `Authorization: Bearer <token>` header.

### 5.2 Component — `components/QCMModal.tsx`

A single full-screen modal with **five stages** managed by a `Stage` union:

```
   ┌─────────────────────────────────────────────────────────────────┐
   │ KNOWLEDGE CHECK · Section: Linear Algebra                  [×]  │
   ├─────────────────────────────────────────────────────────────────┤
   │  ● Easy    5 Qs   Basic recall & definitions             ►     │
   │  ● Medium  8 Qs   Application & comprehension            ►     │
   │  ● Hard   10 Qs   Analysis & scenario reasoning          ►     │
   └─────────────────────────────────────────────────────────────────┘
   stage = 'pick'

   ┌─────────────────────────────────────────────────────────────────┐
   │  Question 3 / 8                            2/8 answered          │
   │  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                       │
   │                                                                 │
   │  What does the determinant of a 2x2 matrix represent?           │
   │                                                                 │
   │  [A] The trace of the matrix                                    │
   │  [B] The signed area of the parallelogram      ← selected       │
   │  [C] The eigenvalue product (always)                            │
   │  [D] None of the above                                          │
   │                                                                 │
   │  ← Previous                                          Next →     │
   └─────────────────────────────────────────────────────────────────┘
   stage = 'quiz'

   ┌─────────────────────────────────────────────────────────────────┐
   │                          ✓ Passed                                │
   │                          7  / 8                                  │
   │                          87.5%                                   │
   │                                                                  │
   │  Review                                                          │
   │  ┌──────────────────────────────────────────────────────────┐   │
   │  │ ✓  What does the determinant of a 2x2 matrix represent?  │   │
   │  │     A. The trace of the matrix                            │   │
   │  │     B. ✓ The signed area of the parallelogram             │   │
   │  │     C. The eigenvalue product (always)                    │   │
   │  │     D. None of the above                                  │   │
   │  │     💡 The determinant gives the signed area of...        │   │
   │  └──────────────────────────────────────────────────────────┘   │
   │                                                                  │
   │  [ Retake Quiz ]                              [ Done ]           │
   └─────────────────────────────────────────────────────────────────┘
   stage = 'results'
```

| Stage      | What it shows                                                        |
|------------|----------------------------------------------------------------------|
| `pick`     | Difficulty cards (Easy/Medium/Hard) + 70 % pass-threshold note       |
| `loading`  | Spinner + "Generating your quiz…" message                            |
| `quiz`     | One question per page, A/B/C/D buttons, prev/next + Submit on last   |
| `results`  | Score banner (green pass / amber fail), per-question review w/ ✓/✗, explanations, Retake button |
| `error`    | Friendly error UI with "Try again" and "Close"                       |

Submit is disabled until **every** question has an answer (`answers.every(a => a >= 0)`).

### 5.3 Wire-up — `pages/CourseLearningPage.tsx`

Three additions:

1. **State + history fetch**
   ```ts
   const [qcmAttempts, setQcmAttempts] = useState<QCMAttemptOut[]>([])
   const [qcmModal, setQcmModal] = useState<{ sectionId?: string; scopeLabel: string } | null>(null)
   ```
   Plus a `useEffect` that calls `getQCMHistory()` on mount and after any quiz is closed.

2. **Helper functions**
   - `isSectionDone(section)` — `true` iff every subsection (or every legacy material if no subsections) is in the student's `completed_*_ids`.
   - `bestAttemptFor(sectionId?)` — returns the highest-`score_pct` attempt for the given scope, used to render the green "Best: 87.5% (medium)" badge on each card.

3. **AI Knowledge Checks panel**
   Inserted between the lesson content area and the existing Student Reviews block. For every section it renders a card:
   - **Locked grey card** if the section isn't fully completed
   - **Active card** with "Take Quiz" / "Retake" button once unlocked
   - **Green check icon** if a previous attempt passed
   - **Best score badge** if any prior attempt exists

   Below all section cards sits the **Final Exam** card — gradient-styled, gated behind `progress.progress_pct >= 100`. Triggering any card opens the same `<QCMModal>` with the right `scopeLabel` and optional `sectionId`.

---

## 6. Complete Flow Diagrams

### 6.1 Section Quiz — happy path

```
Student finishes last subsection of Section 2
     │
     ▼
markItemCompleted() updates progress
     │
     ▼
Section 2 card in "AI Knowledge Checks" turns from grey/locked → active
     │
     ▼
Student clicks "Take Quiz" on Section 2 card
     │
     ▼
QCMModal opens at stage='pick'
     │
     ▼
Student picks Medium  →  POST /api/ai/qcm/generate
                          { course_id, section_id, difficulty: "medium" }
     │
     ▼
Backend:
  1. search_course(course_id, "key concepts from section X")
       ↓ Pinecone returns top 8 chunks
  2. Build prompt → Gemini (gemini-3.1-flash-lite-preview)
  3. Parse JSON, validate → 8 QCMQuestion objects
     │
     ▼
Modal stage='quiz'  →  Student answers all 8 questions
     │
     ▼
Click "Submit Quiz"  →  POST /api/ai/qcm/submit
                         { course_id, section_id, difficulty,
                           questions, answers: [1, 0, 3, 2, ...] }
     │
     ▼
Backend grades:
  - score = 7
  - score_pct = 87.5
  - passed = (87.5 >= 70.0) → true
  - INSERT INTO qcm_attempts (...)
     │
     ▼
Modal stage='results'
  - Green "Passed" banner, 7/8, 87.5%
  - Per-question review with ✓/✗ and AI explanations
     │
     ▼
Student clicks "Done"  →  refreshQcmHistory()
     │
     ▼
Section 2 card now displays: ✓ icon  +  "Best: 87.5% (medium)"
```

### 6.2 Final Exam unlock flow

```
Student progress < 100%
     │
     ▼
Final Exam card is dashed-border, opacity-60, button disabled
     │
     ▼
Student finishes the last lesson →  progress_pct = 100.0
     │
     ▼
Final Exam card turns into a gradient-orange/purple card
"Bring it all together — questions span the whole course."
[Start Exam] button enabled
     │
     ▼
Click → QCMModal with sectionId=undefined  → course-wide context (whole course)
```

### 6.3 RAG → fallback decision

```
generate_qcm()
     │
     ▼
try: search_course(course_id, query, top_k=8)
     │
     ├─ Pinecone returns ≥1 chunk  →  use chunks (semantic, scoped)
     │
     └─ Pinecone unreachable / empty / 0 chunks
                  │
                  ▼
        _gather_context(db, course_id, section_id)
        - Pulls every text LessonBlock for the scope
        - Strips HTML
        - Joins with "---" separators
        - Truncates to 12 000 chars
                  │
                  ▼
        if still empty → HTTP 400 "Not enough text content"
```

---

## 7. API Reference

### 7.1 `POST /api/ai/qcm/generate`

**Auth**: required (any authenticated user — typically the enrolled student).

**Request body**
| Field         | Type                          | Required | Notes                              |
|---------------|-------------------------------|----------|------------------------------------|
| `course_id`   | string (UUID)                 | yes      | The course to quiz on              |
| `section_id`  | string (UUID) \| null         | no       | Omit/null for course-wide exam     |
| `difficulty`  | `"easy"` \| `"medium"` \| `"hard"` | yes  | Defaults to `"medium"`             |

**Success `200`**
```json
{
  "course_id": "…",
  "section_id": "…",
  "difficulty": "medium",
  "questions": [
    {
      "question": "What is the determinant of a 2x2 matrix?",
      "options": ["…", "…", "…", "…"],
      "correct_index": 1,
      "explanation": "It represents the signed area …"
    }
  ]
}
```

**Errors**
| Status | Detail                                                              |
|--------|---------------------------------------------------------------------|
| 400    | `"difficulty must be 'easy', 'medium', or 'hard'"`                  |
| 400    | `"Not enough text content to generate a quiz from this course/section yet."` |
| 404    | `"Course not found"` / `"Section not found"`                        |
| 500    | `"AI is not configured."` (env var missing)                         |
| 502    | `"AI generation failed: …"` / `"AI returned invalid JSON."` / `"AI returned too few valid questions."` |

### 7.2 `POST /api/ai/qcm/submit`

**Auth**: required.

**Request body**
| Field         | Type                          | Required | Notes                                                           |
|---------------|-------------------------------|----------|-----------------------------------------------------------------|
| `course_id`   | string (UUID)                 | yes      |                                                                 |
| `section_id`  | string (UUID) \| null         | no       | Must match the value used at generation                         |
| `difficulty`  | string                        | yes      |                                                                 |
| `questions`   | `QCMQuestion[]`               | yes      | Echo back what `/generate` returned                             |
| `answers`     | `number[]`                    | yes      | Same length as `questions`; each value is `0..3` (or `-1`)      |

**Success `200`**
```json
{
  "attempt_id": "…",
  "score": 7,
  "total": 8,
  "score_pct": 87.5,
  "passed": true,
  "pass_threshold_pct": 70.0,
  "results": [
    {
      "question": "…",
      "options": ["…","…","…","…"],
      "correct_index": 1,
      "chosen_index": 1,
      "is_correct": true,
      "explanation": "…"
    }
  ],
  "completed_at": "2026-05-03T15:43:21"
}
```

**Errors**
| Status | Detail                                                              |
|--------|---------------------------------------------------------------------|
| 400    | `"No questions submitted."`                                         |
| 400    | `"Answer count does not match question count."`                     |
| 400    | Difficulty validation                                               |

### 7.3 `GET /api/ai/qcm/history?course_id=<uuid>`

**Auth**: required. Returns this student's attempts for a course, newest first.

**Success `200`**
```json
[
  {
    "id": "…",
    "course_id": "…",
    "section_id": "…",
    "difficulty": "medium",
    "score": 7,
    "total": 8,
    "score_pct": 87.5,
    "passed": true,
    "completed_at": "2026-05-03T15:43:21"
  }
]
```

---

## 8. Files Created / Modified

| File                                                  | Action   | Purpose                                                       |
|-------------------------------------------------------|----------|---------------------------------------------------------------|
| `backend/app/models/qcm_attempt.py`                   | CREATED  | `QCMAttempt` table + `PASS_THRESHOLD_PCT` constant            |
| `backend/app/schemas/qcm.py`                          | CREATED  | Pydantic request/response schemas                             |
| `backend/app/controller/qcm_controller.py`            | CREATED  | `generate_qcm`, `submit_qcm`, `list_attempts`                 |
| `backend/app/routes/ai_routes.py`                     | MODIFIED | Added 3 endpoints under `/api/ai/qcm/*`                       |
| `backend/app/main.py`                                 | MODIFIED | Registered `QCMAttempt` model + `CREATE TABLE` migration      |
| `frontend/src/api/qcm.ts`                             | CREATED  | Typed API client (`generateQCM`, `submitQCM`, `getQCMHistory`)|
| `frontend/src/components/QCMModal.tsx`                | CREATED  | Difficulty picker + quiz UI + results screen                  |
| `frontend/src/pages/CourseLearningPage.tsx`           | MODIFIED | "AI Knowledge Checks" panel + modal mount + history fetch     |

---

## 9. Business Rules & Validation

| Rule                                                                                          | Where enforced                                                                 |
|-----------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Difficulty must be `easy`, `medium`, or `hard`                                                | `_normalize_difficulty()` in `qcm_controller.py`                               |
| 5 / 8 / 10 questions per difficulty                                                           | `DIFFICULTY_CONFIG` in `qcm_controller.py`                                     |
| Each question must have **exactly 4 distinct non-empty string options**                       | `_validate_questions()` in `qcm_controller.py`                                 |
| `correct_index` must be in `0..3`                                                             | `_validate_questions()`                                                        |
| If too few valid questions are returned, fail the attempt instead of degrading silently       | `_validate_questions()` raises `502`                                           |
| Course/section must exist                                                                     | DB lookups in `generate_qcm()`                                                 |
| Quiz cannot be generated if the scope has no text content                                     | `generate_qcm()` raises `400`                                                  |
| Pass threshold = **70 %**                                                                     | `PASS_THRESHOLD_PCT` constant in `qcm_attempt.py`                              |
| Submitting must echo back the generated `questions` array (server is stateless between calls) | `QCMSubmitIn` schema; `submit_qcm()` re-grades from this payload               |
| Section quiz unlocks only when **every** subsection (or every legacy material) is completed   | `isSectionDone()` in `CourseLearningPage.tsx`                                  |
| Final exam unlocks only at `progress_pct >= 100`                                              | `CourseLearningPage.tsx` final-exam card                                       |
| Quizzes are **optional** — they never gate course completion or feedback submission           | No backend coupling; only UI cards                                             |
| Questions are regenerated on **every** attempt — no caching                                   | `generate_qcm()` always calls Gemini                                           |
| All endpoints require a valid JWT                                                             | `get_current_user` dependency on each route                                    |
| `gemini_api_key` is loaded via `load_dotenv()` and read **at call time**, not at import time  | Top of `qcm_controller.py` + inside `generate_qcm()`                           |

---

*Document generated for PFE project Hub4Learners — March 2026*

# Learner Analytics
### Professor-side dashboard to track every learner's progress, quiz performance, and engagement

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
Hub4Learners now ships with two analytics surfaces:
- **Course Analytics** (professor) — aggregates per *course* (enrollments, completion, ratings).
- **Student Analytics** (student) — aggregates per *self* (own progress + quiz history).

What was missing: a professor-side view that aggregates per *learner*. Professors couldn't easily answer questions like:
- *Which of my students are falling behind?*
- *Who's mastering the material vs. who's struggling on hard quizzes?*
- *Who hasn't been active in a while?*
- *Across all my courses, which learner is on track and which needs follow-up?*

### Solution
A new **Learner insights** dashboard added to the existing **Students** tab in the professor dashboard. It mirrors the student-side analytics layout (KPIs → activity chart → highlights → per-row breakdown) but pivots the data on *learners* instead of *courses*.

The original simple students list (`MyStudentsSection`) is kept underneath so the professor still has the lightweight roster view they had before.

### Technologies
| Layer | Stack |
|-------|-------|
| Backend | FastAPI + SQLAlchemy ORM |
| Schemas | Pydantic v2 (reuses `DifficultyStat` from student analytics) |
| Frontend | React 19 + TypeScript |
| Charts | Inline SVG (no external chart lib) |
| Styling | Tailwind CSS, shared palette |
| Auth | JWT — endpoint requires `role == "professor"` |

---

## 2. Architecture

```
┌─────────────────────────────────────┐                ┌─────────────────────────────────────────────┐
│  ProfessorDashboard.tsx             │                │  course_routes.py                           │
│   nav = "students"                  │                │  GET /courses/professor/learners/analytics  │
│   ├─ <LearnersAnalyticsSection />   │ ── HTTPS ────▶ │  └─ get_learner_analytics(prof_id, db)      │
│   └─ <MyStudentsSection />          │   JWT bearer   │       │                                     │
└─────────────────────────────────────┘                │       ▼                                     │
         ▲                                             │  learner_analytics_controller               │
         │                                             │   ├─ load courses owned by prof             │
   getLearnerAnalytics()                               │   ├─ load enrollments + students            │
   (frontend/src/api/course.ts)                        │   ├─ batch progress + qcm_attempts          │
                                                       │   ├─ per-learner summary + risk bucket      │
                                                       │   ├─ 30-day trend (lessons + quizzes)       │
                                                       │   ├─ top performers + needs attention       │
                                                       │   └─ LearnerAnalyticsOut                    │
                                                       └─────────────────────────────────────────────┘

backend/
├── app/
│   ├── controller/
│   │   └── learner_analytics_controller.py     ← NEW
│   ├── schemas/
│   │   └── learner_analytics.py                ← NEW (reuses DifficultyStat)
│   └── routes/
│       └── course_routes.py                    ← MODIFIED (1 new endpoint)

frontend/
├── src/
│   ├── api/
│   │   └── course.ts                           ← MODIFIED (types + getLearnerAnalytics)
│   └── pages/
│       └── ProfessorDashboard.tsx              ← MODIFIED (LearnersAnalyticsSection + helpers)
```

---

## 3. Database Models

No new tables. The feature is read-only aggregation over already-existing tables.

### Tables read
| Table              | Purpose in this feature                                      |
|--------------------|--------------------------------------------------------------|
| `courses`          | Filter to only the professor's courses                       |
| `enrollments`      | Discover the set of learners and their per-course status     |
| `users`            | Resolve student `full_name` and `email`                      |
| `course_progress`  | Items completed per learner per course; lessons activity log |
| `qcm_attempts`     | Quiz history — score, difficulty, pass flag, timestamps      |
| `course_subsections` / `course_materials` | Determine each course's `total_items` |

No schema migrations — `main.py` is unchanged.

---

## 4. Backend Implementation

### 4.1 Schema — `backend/app/schemas/learner_analytics.py`

```python
class LearnerCourseStats(BaseModel):
    course_id, course_title: str
    enrollment_status: str
    enrolled_at: datetime
    progress_pct: float
    completed_items, total_items: int
    quiz_attempts: int
    quiz_avg_pct, quiz_pass_rate: float
    last_active_at: Optional[datetime]

class LearnerSummary(BaseModel):
    student_id, full_name, email: str
    courses_enrolled, courses_completed, courses_in_progress: int
    avg_progress_pct: float
    quiz_attempts, quizzes_passed: int
    quiz_avg_pct, quiz_pass_rate, best_quiz_score_pct: float
    last_active_at: Optional[datetime]
    active_days_30d: int
    risk_level: str                       # on_track | needs_attention | at_risk
    courses: List[LearnerCourseStats]

class LearnerActivityPoint(BaseModel):
    date: str                              # YYYY-MM-DD
    lessons_completed, quizzes_taken: int

class LearnerHighlight(BaseModel):
    student_id, full_name: str
    avg_quiz_pct, avg_progress_pct: float
    quiz_attempts: int

class LearnerAnalyticsOut(BaseModel):
    learners: List[LearnerSummary]
    total_learners, active_learners_30d: int
    avg_progress_pct: float
    completed_count, in_progress_count, not_started_count: int
    total_quiz_attempts: int
    overall_quiz_avg_pct, overall_quiz_pass_rate: float
    difficulty_breakdown: Dict[str, DifficultyStat]
    activity_trend: List[LearnerActivityPoint]    # always 30 entries
    lessons_completed_30d, quizzes_taken_30d: int
    top_performers, needs_attention: List[LearnerHighlight]
    at_risk_count, needs_attention_count: int
```

`DifficultyStat` is **reused as-is** from `student_analytics.py` to keep one source of truth for `{ attempts, avg_score_pct, pass_rate }`.

### 4.2 Controller — `learner_analytics_controller.py`

`get_learner_analytics(professor_id, db) -> LearnerAnalyticsOut`

Pipeline (all batched):
1. Load all courses owned by the professor.
2. Load all enrollments across those courses + group by `student_id`.
3. Batch-fetch the relevant `User` rows.
4. Pull all `course_progress` rows for `(student_id ∈ enrollees, course_id ∈ prof's courses)`.
5. Pull all `qcm_attempts` for the same learners + courses.
6. For each learner: walk their enrollments → build `LearnerCourseStats` for each course (progress %, completed/total items, per-course quiz stats, `last_active_at`).
7. Per-learner aggregates: `avg_progress_pct`, `quiz_avg_pct`, pass rate, best score, `active_days_30d`, `last_active_at`.
8. **Risk classification** (`_classify_risk`):
   - `at_risk`: `avg_progress < 25%` AND inactive ≥ 14 days (or never active)
   - `needs_attention`: failing quizzes (`quiz_avg < 60%`) OR inactive ≥ 7 days but has started
   - `on_track`: otherwise
9. Build the 30-day cohort activity trend by walking all progress rows and quiz attempts once.
10. Sort top performers (top 5 by `quiz_avg_pct` desc, tie-broken by attempts).
11. Sort needs-attention (at-risk + needs_attention bucket combined, top 5 by lowest `avg_progress_pct`).
12. Return `LearnerAnalyticsOut`.

Reused helpers:
- `course_controller._count_course_items` — `total_items` per course.
- (No need for `_batch_progress_pct` here — we walk progress rows directly because we need per-learner-per-course counts, not just percentages.)

### 4.3 Route — `course_routes.py`

```python
@router.get("/professor/learners/analytics", response_model=LearnerAnalyticsOut)
def learner_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return get_learner_analytics(current_user["sub"], db)
```

Placed alongside `/student/analytics` and **before** the `/{course_id}` wildcard. Guarded by `require_role("professor")` so only verified professor accounts can call it.

### 4.4 `main.py`
**No change.** The route ships through the existing `course_router` registration.

---

## 5. Frontend Implementation

### 5.1 API client — `frontend/src/api/course.ts`

Added types: `LearnerCourseStats`, `LearnerSummary`, `LearnerActivityPoint`, `LearnerHighlight`, `LearnerAnalyticsOut`.

```ts
export function getLearnerAnalytics(token: string): Promise<LearnerAnalyticsOut> {
  return request<LearnerAnalyticsOut>('/courses/professor/learners/analytics', token)
}
```

### 5.2 `ProfessorDashboard.tsx` — `LearnersAnalyticsSection`

Mounted **above** the existing `MyStudentsSection` inside the same `students` tab. Returns `null` for the empty cohort (so the existing list's empty state is shown instead — no double empty state).

Layout:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Learner insights                                                        │
│  Tracking 27 learners · 18 active in last 30d                            │
├──────────────────────────────────────────────────────────────────────────┤
│  [ Avg progress ]  [ Quiz average ]  [ Pass rate ]  [ Need follow-up ]   │
│      54%               72%               80%             5               │
│  12 done · 9 active   42 attempts     124 lessons     2 risk · 3 attn    │
├────────────────────────────────────┬─────────────────────────────────────┤
│   Cohort activity (last 30 days)   │   Quiz performance                  │
│   ┌─lessons─╮ ┌─quizzes─╮          │   ●Easy   85%  ████████░░  20      │
│   │  124    │ │   42    │          │   ●Medium 70%  ██████░░░░  15      │
│   └─────────┘ └─────────┘          │   ●Hard   50%  ████░░░░░░   7      │
│   ┌────────────────────────────┐   │                                     │
│   │  ▁▂▄█▆▃▂▅█▇▄▁▂▆█▇▅▃...     │   │                                     │
│   └────────────────────────────┘   │                                     │
├────────────────────────────────────┴─────────────────────────────────────┤
│  [ Top performers ]                  [ Needs attention ]                 │
│  1. Alice Smith    95%  6q · 80%     ⚠ Bob Jones    8%  no quizzes       │
│  2. Carol White    92%  4q · 75%     ⚠ Dan Miller  20%  44% quizzes      │
│  ...                                  ...                                │
├──────────────────────────────────────────────────────────────────────────┤
│  All learners        [All|On track|Attention|At risk]   [Sort: Recent]   │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ A   Alice Smith  [On track]                       [Details]        │  │
│  │     alice@uni.edu                                                  │  │
│  │     3 courses · 2 done · 1 active · Active 2h ago                  │  │
│  │ ┌Progress┐ ┌Quizzes┐ ┌Avg─────┐ ┌Pass───┐ ┌30-day┐                 │  │
│  │ │  88%   │ │   6   │ │  95%   │ │ 100%  │ │  18d │                 │  │
│  │ └────────┘ └───────┘ └────────┘ └───────┘ └──────┘                 │  │
│  │ Average progress              ████████████░  88% (2/3)             │  │
│  │  ─ Per-course breakdown (when expanded) ─                          │  │
│  │  React Fundamentals      [Completed]  8/8 · 5 quizzes · 96% avg    │  │
│  │  Linear Algebra                       6/10 · 1 quiz · 90% avg      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ...                                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

UI helpers added locally:
- **`LearnerActivityChart`** — 720×180 SVG with two paths (orange filled lessons, blue dashed quizzes).
- **`RISK_META`** — color/label map for the three risk buckets.
- **`learnerScoreColor`** — green ≥80, amber ≥60, red otherwise.
- **`relTimeShort`** — relative timestamp helper (just-now / m / h / d / mo / y).

Reused from existing professor analytics: `MiniStat`.

Filter / sort:
- Risk pill switcher: All · On track · Attention · At risk.
- Sort select: Recent activity · Progress · Quiz score · Name.
- Search: matches `full_name` or `email` substring.

The expand-collapse on each learner card reveals the **per-course breakdown** so the professor can drill into "where exactly is this student stuck?" without leaving the page.

---

## 6. Complete Flow Diagrams

### 6.1 Professor opens "Students" tab
```
[click sidebar "Students"]
  └─ setNav('students')
       └─ mounted Set adds 'students'
            ├─ <LearnersAnalyticsSection /> renders
            │     └─ useEffect → getLearnerAnalytics(token)
            │          └─ GET /api/courses/professor/learners/analytics  (Bearer JWT)
            │               └─ get_learner_analytics(prof_id, db)
            │                    ├─ load prof's courses
            │                    ├─ load enrollments + users
            │                    ├─ batch progress + qcm_attempts
            │                    ├─ build per-learner summaries + risk bucket
            │                    ├─ build 30-day trend
            │                    ├─ pick top 5 performers / 5 to follow up
            │                    └─ return LearnerAnalyticsOut
            │          ◀── JSON
            │     └─ setData(...) → render KPIs, chart, learner cards
            └─ <MyStudentsSection />           // existing roster list, untouched
```

### 6.2 Risk classification at a glance
```
                avg_progress < 25%  AND  inactive ≥ 14d
                                  │
                                  ▼
                              at_risk
                                  │
                          else if (quiz_avg < 60%
                                   OR inactive ≥ 7d)
                                  │
                                  ▼
                          needs_attention
                                  │
                                  ▼
                              on_track
```

### 6.3 Filter / sort flow (client-only)
```
[click "At risk" pill]                [select "Sort: Progress"]
  └─ setRiskFilter('at_risk')           └─ setSortBy('progress')
       └─ filtered = learners.filter         └─ sorted = [...filtered].sort
            (l.risk_level === 'at_risk')          ((a, b) => b.avg_progress - a.avg_progress)
       └─ list re-renders                  └─ list re-renders
```

---

## 7. API Reference

### `GET /api/courses/professor/learners/analytics`
Aggregated per-learner analytics for the courses owned by the authenticated professor.

| Field | Description |
|-------|-------------|
| **Method** | GET |
| **Path** | `/api/courses/professor/learners/analytics` |
| **Auth** | JWT bearer · `role == "professor"` |
| **Body** | — |

#### Success — `200 OK`
```jsonc
{
  "learners": [
    {
      "student_id": "...",
      "full_name": "Alice Smith",
      "email": "alice@uni.edu",
      "courses_enrolled": 3,
      "courses_completed": 2,
      "courses_in_progress": 1,
      "avg_progress_pct": 88.0,
      "quiz_attempts": 6,
      "quizzes_passed": 6,
      "quiz_avg_pct": 95.0,
      "quiz_pass_rate": 100.0,
      "best_quiz_score_pct": 100.0,
      "last_active_at": "2026-05-03T08:00:00",
      "active_days_30d": 18,
      "risk_level": "on_track",
      "courses": [
        {
          "course_id": "...",
          "course_title": "React Fundamentals",
          "enrollment_status": "completed",
          "enrolled_at": "2026-04-01T10:00:00",
          "progress_pct": 100.0,
          "completed_items": 8,
          "total_items": 8,
          "quiz_attempts": 5,
          "quiz_avg_pct": 96.0,
          "quiz_pass_rate": 100.0,
          "last_active_at": "2026-05-03T08:00:00"
        }
      ]
    }
  ],
  "total_learners": 27,
  "active_learners_30d": 18,
  "avg_progress_pct": 54.0,
  "completed_count": 12,
  "in_progress_count": 9,
  "not_started_count": 6,
  "total_quiz_attempts": 42,
  "overall_quiz_avg_pct": 72.0,
  "overall_quiz_pass_rate": 80.0,
  "difficulty_breakdown": {
    "easy":   { "attempts": 20, "avg_score_pct": 85.0, "pass_rate": 95.0 },
    "medium": { "attempts": 15, "avg_score_pct": 70.0, "pass_rate": 80.0 },
    "hard":   { "attempts": 7,  "avg_score_pct": 50.0, "pass_rate": 57.0 }
  },
  "activity_trend": [
    { "date": "2026-04-04", "lessons_completed": 0, "quizzes_taken": 0 },
    /* ...30 entries... */
    { "date": "2026-05-03", "lessons_completed": 7, "quizzes_taken": 2 }
  ],
  "lessons_completed_30d": 124,
  "quizzes_taken_30d": 42,
  "top_performers": [
    { "student_id": "...", "full_name": "Alice Smith", "avg_quiz_pct": 95.0, "avg_progress_pct": 88.0, "quiz_attempts": 6 }
  ],
  "needs_attention": [
    { "student_id": "...", "full_name": "Bob Jones", "avg_quiz_pct": 0.0, "avg_progress_pct": 8.0, "quiz_attempts": 0 }
  ],
  "at_risk_count": 2,
  "needs_attention_count": 3
}
```

#### Errors
| Code | When |
|------|------|
| 401  | Missing / invalid JWT |
| 403  | User is not a professor |

#### Empty-state contract
- Professor with **no courses** → `200 OK` with all zero aggregates and a 30-entry zero-filled `activity_trend`.
- Professor with courses but **no enrollments** → same shape (zero everything).
- Frontend treats `total_learners === 0` as a no-op (renders `null`) so the existing empty state on `MyStudentsSection` shows through.

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/schemas/learner_analytics.py` | **Created** | Pydantic schemas (reuses `DifficultyStat`) |
| `backend/app/controller/learner_analytics_controller.py` | **Created** | Aggregation + risk-bucket logic |
| `backend/app/routes/course_routes.py` | Modified | Added `GET /courses/professor/learners/analytics`; new imports |
| `frontend/src/api/course.ts` | Modified | Added `LearnerAnalyticsOut` types and `getLearnerAnalytics()` |
| `frontend/src/pages/ProfessorDashboard.tsx` | Modified | Added `LearnersAnalyticsSection` + helpers; mounted on `students` tab; widened tab container to `max-w-[1200px]` |
| `Learner_Analytics_Documentation.md` | **Created** | This document |

`main.py` — **no change** (no schema migration; route auto-registered through `course_router`).

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|------|----------------|
| Only professors can call the endpoint | `Depends(require_role("professor"))` |
| Only courses owned by the calling professor are aggregated | `Course.professor_id == pid` filter |
| A learner's data is scoped to enrollments **in this professor's courses** only | `course_id.in_(prof's course_ids)` filters on `progress_rows` and `attempts` |
| `progress_pct` clamps to 100 when enrollment status is `completed` | `if e.status == "completed": pct = 100.0` |
| `not_started` = `progress_pct == 0` AND `status != 'completed'` | Per-course tally in controller |
| `at_risk`: `avg_progress < 25%` AND inactive ≥ 14 days (or never) | `_classify_risk` |
| `needs_attention`: failing quizzes (`avg < 60%`) OR inactive ≥ 7 days | `_classify_risk` |
| Top performers limited to learners with ≥ 1 quiz attempt | `[l for l in learners if l.quiz_attempts > 0]` |
| Top performers / needs-attention capped at 5 entries each | `[:5]` slices |
| Activity trend always returns exactly 30 contiguous days | `for offset in range(29, -1, -1)` zero-fill |
| Overall quiz average is **weighted by attempts**, not "average of averages" | Controller re-walks the raw attempts list |
| `last_active_at` = max of last progress mark and last quiz attempt | Per-course max + student-level max |
| Frontend hides analytics when `total_learners === 0` so the legacy roster's empty state still appears | `if (!data || data.total_learners === 0) return null` |
| Search matches name OR email (case-insensitive substring) | Client-only filter |

---

*Document generated for PFE project Hub4Learners — March 2026*

# Student Analytics
### Track every learner's progress, quiz performance, and study activity from a single dashboard

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
The Hub4Learners platform already gave **professors** an analytics dashboard (enrollments, completion rates, ratings, trends). Students, however, had no parallel surface to:
- Track their progress across all enrolled courses in one place.
- See how they perform on AI-generated quizzes (overall + by difficulty + per course).
- Visualize study activity over time (lessons completed + quizzes taken per day).
- Identify their strongest subject and the one that needs more practice.
- Maintain motivation through an active-day streak counter.

### Solution
A new **Grades** dashboard tab (already present in the sidebar but previously empty) now hosts a full *Student Analytics* surface that aggregates progress data from `course_progress` and quiz data from `qcm_attempts` into one cohesive, professional view.

### Technologies
| Layer | Stack |
|-------|-------|
| Backend | FastAPI + SQLAlchemy ORM |
| Schemas | Pydantic v2 |
| Frontend | React 19 + TypeScript |
| Charts | Hand-rolled inline SVG (no external chart lib) |
| Styling | Tailwind CSS, project palette (`#0C0C0F`, `#FF5533`, `#3B82F6`, `#10B981`, `#F59E0B`) |
| Auth | JWT (`get_current_user`) — endpoint requires login |

---

## 2. Architecture

```
┌────────────────────────┐                ┌────────────────────────────────┐
│  StudentDashboard.tsx  │                │  course_routes.py              │
│   nav = "grades"       │                │  GET /courses/student/analytics│
│   └─ StudentAnalytics  │ ──── HTTPS ──▶ │  └─ get_student_analytics(...) │
│        Section         │   JWT bearer   │       │                        │
└────────────────────────┘                │       ▼                        │
         ▲                                │  student_analytics_controller  │
         │                                │   ├─ enrollments                │
   getStudentAnalytics()                  │   ├─ course_progress (batched)  │
   (frontend/src/api/course.ts)           │   ├─ qcm_attempts               │
                                          │   ├─ trend / streak builder     │
                                          │   └─ StudentAnalyticsOut        │
                                          └────────────────────────────────┘

backend/
├── app/
│   ├── controller/
│   │   └── student_analytics_controller.py   ← NEW
│   ├── schemas/
│   │   └── student_analytics.py              ← NEW
│   └── routes/
│       └── course_routes.py                  ← MODIFIED (1 new endpoint)

frontend/
├── src/
│   ├── api/
│   │   └── course.ts                         ← MODIFIED (types + getStudentAnalytics)
│   └── pages/
│       └── StudentDashboard.tsx              ← MODIFIED (StudentAnalyticsSection)
```

---

## 3. Database Models

No new tables. The feature is a pure read-side aggregation over three existing models.

### `enrollments`
| Field          | Type    | Notes                                        |
|----------------|---------|----------------------------------------------|
| id             | UUID    | PK                                           |
| student_id     | UUID    | FK → users.id                                |
| course_id      | UUID    | FK → courses.id                              |
| status         | VARCHAR | `active` · `completed` · `blocked`           |
| enrolled_at    | TIMESTAMP | server default                             |

Status lifecycle: `active` → `completed` (set automatically by `mark_item_completed` when `progress_pct >= 100`).

### `course_progress`
| Field          | Type    | Notes                                        |
|----------------|---------|----------------------------------------------|
| id             | UUID    | PK                                           |
| student_id     | UUID    | FK → users.id                                |
| course_id      | UUID    | FK → courses.id                              |
| subsection_id  | UUID    | nullable — FK → course_subsections.id        |
| material_id    | UUID    | nullable — FK → course_materials.id          |
| completed_at   | TIMESTAMP | UTC, default now                            |

Used by analytics for: items-completed-per-course, daily lessons trend, streak dates.

### `qcm_attempts`
| Field          | Type    | Notes                                        |
|----------------|---------|----------------------------------------------|
| id             | UUID    | PK                                           |
| student_id     | UUID    | FK → users.id                                |
| course_id      | UUID    | FK → courses.id                              |
| section_id     | UUID    | nullable                                     |
| difficulty     | VARCHAR(16) | `easy` · `medium` · `hard`               |
| score          | INT     | correct answers                              |
| total          | INT     | question count                               |
| passed         | BOOL    | `score/total*100 >= 70` (PASS_THRESHOLD_PCT) |
| questions_json | TEXT    | snapshot of generated quiz                   |
| answers_json   | TEXT    | student's chosen indexes                     |
| completed_at   | TIMESTAMP | UTC, default now                            |

Used by analytics for: overall avg/best/pass-rate, by-difficulty breakdown, recent attempts feed, daily quizzes trend, strongest/weakest course.

---

## 4. Backend Implementation

### 4.1 Schema — `backend/app/schemas/student_analytics.py`

```python
class DifficultyStat(BaseModel):
    attempts: int
    avg_score_pct: float
    pass_rate: float

class StudentQCMSummary(BaseModel):
    attempts, passed: int
    avg_score_pct, best_score_pct, pass_rate: float
    last_attempt_at: Optional[datetime]
    by_difficulty: Dict[str, DifficultyStat]

class StudentCourseAnalyticsItem(BaseModel):
    course_id, course_title, professor_name: str
    thumbnail, category_name: Optional[str]
    enrollment_status: str          # active|completed|blocked
    enrolled_at: datetime
    progress_pct, completed_items, total_items
    quiz: StudentQCMSummary

class StudentRecentAttempt(BaseModel):
    attempt_id, course_id, course_title, difficulty: str
    score, total: int
    score_pct: float
    passed: bool
    completed_at: datetime

class StudentActivityPoint(BaseModel):
    date: str           # YYYY-MM-DD
    lessons_completed: int
    quizzes_taken: int

class CourseHighlight(BaseModel):
    course_id, course_title: str
    avg_score_pct: float
    attempts: int

class StudentAnalyticsOut(BaseModel):
    courses: List[StudentCourseAnalyticsItem]
    total_courses, total_completed, total_in_progress, total_not_started: int
    overall_progress_pct: float

    total_quiz_attempts, quizzes_passed: int
    overall_quiz_avg_pct, overall_quiz_pass_rate, best_quiz_score_pct: float
    difficulty_breakdown: Dict[str, DifficultyStat]

    activity_trend: List[StudentActivityPoint]      # exactly 30 entries
    lessons_completed_30d, quizzes_taken_30d, active_days_30d: int
    current_streak_days, longest_streak_days: int

    recent_attempts: List[StudentRecentAttempt]     # max 10
    strongest_course, needs_work_course: Optional[CourseHighlight]
```

### 4.2 Controller — `backend/app/controller/student_analytics_controller.py`

`get_student_analytics(student_id, db) -> StudentAnalyticsOut`

Pipeline:
1. Load all enrollments for the student (ordered desc).
2. Batch-fetch courses, professors, categories.
3. Reuse `_batch_progress_pct()` from `course_controller` to compute progress per course in ~5 queries.
4. Load all `course_progress` rows + all `qcm_attempts` for the student in **two** queries.
5. Group attempts by course → per-course quiz summary via `_summarize_attempts()` (avg, best, pass rate, by-difficulty).
6. Walk progress rows + attempts to build a 30-day activity trend (always returns exactly 30 contiguous days, missing days zero-filled).
7. Compute streaks (`_compute_streaks`):
   - **Current**: consecutive days back from today (or yesterday if user wasn't active today) where `progress` or `quiz` activity exists.
   - **Longest**: longest run of consecutive active days across all history.
8. Pick **strongest** = course with highest `avg_score_pct` (must have ≥1 attempt). **Needs work** = lowest, only set if it's a different course.
9. Return aggregated `StudentAnalyticsOut`.

Key helpers reused from existing code:
- `course_controller._count_course_items` — counts subsections + legacy materials per course.
- `course_controller._batch_progress_pct` — already optimised batched progress percentage.

### 4.3 Route — `backend/app/routes/course_routes.py`

```python
@router.get("/student/analytics", response_model=StudentAnalyticsOut)
def student_analytics(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return get_student_analytics(current_user["sub"], db)
```

Placed **before** the `/{course_id}` wildcard so the static path matches first. Uses `get_current_user` (any authenticated role) — students, professors testing on their own progress, and admins all see their own.

### 4.4 `main.py` changes

None required. The route is registered through the existing `course_router` (`app.include_router(course_router, prefix="/api")`).

---

## 5. Frontend Implementation

### 5.1 API client — `frontend/src/api/course.ts`

Added types: `DifficultyStat`, `StudentQCMSummary`, `StudentCourseAnalyticsItem`, `StudentRecentAttempt`, `StudentActivityPoint`, `CourseHighlight`, `StudentAnalyticsOut`.

```ts
export function getStudentAnalytics(token: string): Promise<StudentAnalyticsOut> {
  return request<StudentAnalyticsOut>('/courses/student/analytics', token)
}
```

### 5.2 `StudentDashboard.tsx` — `StudentAnalyticsSection`

Mounted under the existing `nav === 'grades'` tab (already wired in the sidebar). Lazy-mounted: only fetches the API when the tab is opened for the first time (matches the dashboard's `mounted` Set pattern).

Layout:

```
┌──────────────────────────────────────────────────────────────────────┐
│  My Progress                                                         │
│  Tracking 4 courses · last 30 days of activity                       │
├──────────────────────────────────────────────────────────────────────┤
│  [ Overall progress ]  [ Quiz average ]  [ Pass rate ]  [ Streak  ]  │
│       62%                  78%               85%           7d        │
│  4 done · 2 active     12 attempts        10 passed     Best: 14d    │
├──────────────────────────────────────┬───────────────────────────────┤
│   Learning activity (last 30 days)   │  Quiz performance             │
│   ┌─lessons──╮ ┌─quizzes──╮ ┌─days─╮ │  ●Easy   100%  ████████ 4     │
│   │   42     │ │   12     │ │ 18  │ │  ●Medium  75%  ██████░░ 6     │
│   └──────────┘ └──────────┘ └─────┘ │  ●Hard    60%  ████░░░░ 2     │
│                                      │  ─────────                    │
│   ┌──────────────────────────────┐   │  Best score          95%      │
│   │  ▁▂▄█▆▃▂▅█▇▄▁▂▆█▇▅▃...      │   │                               │
│   └──────────────────────────────┘   │                               │
├──────────────────────────────────────┴───────────────────────────────┤
│  [ Strongest subject ]   [ Needs work ]   [ Completion mix ]         │
│  React Fundamentals      Statistics 101    ▰▰▰▱▱▱▱▱▱▱                │
│  92% · 5 quizzes         54% · 3 quizzes   2 done · 2 active · 0 not │
├──────────────────────────────────────────────────────────────────────┤
│  Recent quiz attempts                                                │
│  ✓ React Fundamentals        Easy   2h ago         95%   19/20       │
│  ✓ Linear Algebra            Medium 1d ago         80%    8/10       │
│  ✗ Statistics 101            Hard   3d ago         50%    5/10       │
│  ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  Course breakdown                  [All|Active|Done|Not yet]  [Sort] │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ React Fundamentals  [In progress] [Programming]              │    │
│  │ John Smith · Enrolled 12d ago · Last quiz 2h ago             │    │
│  │ ┌Lessons─┐ ┌Quizzes─┐ ┌Avg─────┐ ┌Best────┐                  │    │
│  │ │  6/8   │ │   5    │ │  92%   │ │  95%   │                  │    │
│  │ └────────┘ └────────┘ └────────┘ └────────┘                  │    │
│  │ Course progress              ███████████░░░░  75%            │    │
│  │ Easy 100% │ Medium 90% │ Hard 80%                            │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ...                                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

Key UI bits:
- **`StatCard`** — rebuilt locally to keep the section self-contained (mirrors the professor's `MiniStat`).
- **`ActivityChart`** — 720×180 SVG with two paths: filled lessons line (orange) + dashed quizzes line (blue). Auto y-scales to the max.
- **Difficulty breakdown** — three colored bars (green/amber/red) using `DIFFICULTY_META`.
- **Score color** — `>=80` green, `>=60` amber, else red, applied to all numeric quiz percentages.
- **Filter / sort controls** — pill switcher (All / Active / Done / Not yet) + sort select (Recent / Progress / Quiz score).
- **Empty state** — when `total_courses === 0`, shows a CTA button that calls `onJumpToCourses` (switches the dashboard nav to `'courses'`).

Wiring inside `StudentDashboard`:
```tsx
const knownNavIds = new Set([..., 'grades'])   // removed grades from “coming soon”

{/* ── Grades / Analytics ── */}
<div className={nav !== 'grades' ? 'hidden' : 'max-w-[1200px] mx-auto px-6 md:px-10 py-8'}>
  {mounted.has('grades') && (
    <StudentAnalyticsSection token={token!} onJumpToCourses={() => setNav('courses')} />
  )}
</div>
```

---

## 6. Complete Flow Diagrams

### 6.1 Student opens "Grades" for the first time
```
[click sidebar "Grades"]
  └─ setNav('grades')
       └─ mounted Set adds 'grades'
            └─ <StudentAnalyticsSection /> renders
                 └─ useEffect → getStudentAnalytics(token)
                      └─ GET /api/courses/student/analytics  (Bearer JWT)
                           └─ get_student_analytics(student_id, db)
                                ├─ load enrollments
                                ├─ batch progress + items + courses + attempts
                                ├─ build trend (30 zero-filled days)
                                ├─ compute streaks
                                ├─ pick strongest / needs-work
                                └─ return StudentAnalyticsOut
                      ◀── JSON
                 └─ setData(...) → render KPIs, chart, course cards
```

### 6.2 Filter + sort interactions (client-only, no refetch)
```
[click "Active" pill]                 [select "Sort: Quiz score"]
  └─ setFilter('in_progress')           └─ setSortBy('score')
       └─ filtered = courses.filter         └─ sorted = [...filtered].sort
            (progress_pct > 0 &&                 (b.quiz.avg - a.quiz.avg)
             status !== 'completed')
       └─ list re-renders                  └─ list re-renders
```

### 6.3 Activity / streak computation
```
progress_rows + qcm_attempts
       │
       ├─ for each row with completed_at within last 30d:
       │     trend_lessons[date] += 1   OR   trend_quizzes[date] += 1
       │     active_dates_30d.add(date)
       │
       ├─ for each row across ALL time:
       │     all_active_dates.add(date)
       │
       ├─ current_streak:
       │     cursor = today (or yesterday if today not active)
       │     while cursor in all_active_dates: streak++; cursor -= 1d
       │
       └─ longest_streak:
             scan sorted all_active_dates ascending,
             count longest run of consecutive days
```

---

## 7. API Reference

### `GET /api/courses/student/analytics`
Aggregated analytics for the currently authenticated user (acting as a student).

| Field | Description |
|-------|-------------|
| **Method** | GET |
| **Path** | `/api/courses/student/analytics` |
| **Auth** | JWT bearer (any authenticated role) |
| **Body** | — |

#### Success — `200 OK`
```jsonc
{
  "courses": [
    {
      "course_id": "...",
      "course_title": "React Fundamentals",
      "thumbnail": "thumbnails/abc.png",
      "professor_name": "John Smith",
      "category_name": "Programming",
      "enrollment_status": "active",
      "enrolled_at": "2026-04-21T10:00:00",
      "progress_pct": 75.0,
      "completed_items": 6,
      "total_items": 8,
      "quiz": {
        "attempts": 5,
        "passed": 5,
        "avg_score_pct": 92.0,
        "best_score_pct": 95.0,
        "pass_rate": 100.0,
        "last_attempt_at": "2026-05-03T08:00:00",
        "by_difficulty": {
          "easy":   { "attempts": 2, "avg_score_pct": 100.0, "pass_rate": 100.0 },
          "medium": { "attempts": 2, "avg_score_pct": 90.0,  "pass_rate": 100.0 },
          "hard":   { "attempts": 1, "avg_score_pct": 80.0,  "pass_rate": 100.0 }
        }
      }
    }
  ],
  "total_courses": 4,
  "total_completed": 1,
  "total_in_progress": 2,
  "total_not_started": 1,
  "overall_progress_pct": 62.0,
  "total_quiz_attempts": 12,
  "quizzes_passed": 10,
  "overall_quiz_avg_pct": 78.5,
  "overall_quiz_pass_rate": 83.3,
  "best_quiz_score_pct": 95.0,
  "difficulty_breakdown": { "easy": {...}, "medium": {...}, "hard": {...} },
  "activity_trend": [
    { "date": "2026-04-04", "lessons_completed": 0, "quizzes_taken": 0 },
    /* ...30 entries... */
    { "date": "2026-05-03", "lessons_completed": 2, "quizzes_taken": 1 }
  ],
  "lessons_completed_30d": 42,
  "quizzes_taken_30d": 12,
  "active_days_30d": 18,
  "current_streak_days": 7,
  "longest_streak_days": 14,
  "recent_attempts": [
    {
      "attempt_id": "...",
      "course_id": "...",
      "course_title": "React Fundamentals",
      "section_id": null,
      "difficulty": "easy",
      "score": 19,
      "total": 20,
      "score_pct": 95.0,
      "passed": true,
      "completed_at": "2026-05-03T08:00:00"
    }
    /* up to 10 */
  ],
  "strongest_course": {
    "course_id": "...",
    "course_title": "React Fundamentals",
    "avg_score_pct": 92.0,
    "attempts": 5
  },
  "needs_work_course": {
    "course_id": "...",
    "course_title": "Statistics 101",
    "avg_score_pct": 54.0,
    "attempts": 3
  }
}
```

#### Errors
| Code | When |
|------|------|
| 401  | Missing / invalid JWT |
| 422  | (Not expected — endpoint takes no input) |

#### Empty-state contract
- A student with **no enrollments** still receives `200 OK` with all aggregates at zero **and** a 30-entry zero-filled `activity_trend`. This lets the UI render the empty CTA without a fallback branch.

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/schemas/student_analytics.py` | **Created** | Pydantic response schemas |
| `backend/app/controller/student_analytics_controller.py` | **Created** | Aggregation + streak logic |
| `backend/app/routes/course_routes.py` | Modified | Added `GET /courses/student/analytics`; new imports |
| `frontend/src/api/course.ts` | Modified | Added `StudentAnalyticsOut` types and `getStudentAnalytics()` |
| `frontend/src/pages/StudentDashboard.tsx` | Modified | Added `StudentAnalyticsSection` + helpers; wired to `'grades'` nav; updated `knownNavIds` |
| `Student_Analytics_Documentation.md` | **Created** | This document |

`main.py` — **no change** (router already mounted; no new tables required).

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|------|----------------|
| Only the authenticated user's data is returned | `Depends(get_current_user)` + filters on `student_id == current_user["sub"]` |
| Quiz pass threshold is 70% | `qcm_attempt.PASS_THRESHOLD_PCT = 70.0` (existing); reused — analytics never recomputes pass |
| `total_in_progress` = enrolled but not completed and not started count | `total_courses - completed - not_started` |
| `not_started` = `progress_pct == 0` AND `status != 'completed'` | `student_analytics_controller.get_student_analytics` |
| `strongest` and `needs_work` are only set when ≥1 quiz attempt exists | Filter `[c for c in course_items if c.quiz.attempts > 0]` |
| `needs_work` is hidden when it would equal `strongest` | Equality check on `course_id` |
| Activity trend always returns exactly 30 contiguous days | Loop `for offset in range(29, -1, -1)` zero-fills missing days |
| Streak counts a day as "active" if the student completed a lesson **or** took a quiz that day | Union of `course_progress.completed_at` + `qcm_attempts.completed_at` dates |
| Current streak is forgiving of missing today (counts back from yesterday) | `if cursor not in active_dates: cursor = today - 1d` |
| Recent attempts capped at 10 | `attempts[:10]` slice in controller |
| Per-course quiz summary uses 0 defaults when no attempts | `StudentQCMSummary(by_difficulty=_empty_difficulty_map())` |
| Empty enrollment list still returns valid response | Early return with zero-filled trend in controller |

---

*Document generated for PFE project Hub4Learners — March 2026*

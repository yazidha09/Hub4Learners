# Hub4Learners — Course Management Documentation

## PFE Project — Course Upload, Browsing & Enrollment Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Models](#3-database-models)
   - 3.1 [courses](#31-courses)
   - 3.2 [course_sections](#32-course_sections)
   - 3.3 [course_materials](#33-course_materials)
   - 3.4 [enrollments](#34-enrollments)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Schemas (Pydantic Models)](#41-schemas-pydantic-models)
   - 4.2 [Controller (Business Logic)](#42-controller-business-logic)
   - 4.3 [Routes (API Endpoints)](#43-routes-api-endpoints)
   - 4.4 [File Storage & Static Serving](#44-file-storage--static-serving)
   - 4.5 [App Entry Point Changes](#45-app-entry-point-changes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [API Service](#51-api-service)
   - 5.2 [Professor Dashboard — My Courses](#52-professor-dashboard--my-courses)
   - 5.3 [Student Dashboard — Browse & Enroll](#53-student-dashboard--browse--enroll)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

This document describes the **Course Management** system for the Hub4Learners platform. It covers every layer — from the database tables, to the backend API, to the React UI.

### What was built

The full lifecycle of a course on the platform:

1. A **professor** creates a course by filling in a title, description, and optionally uploading a thumbnail image.
2. The professor organizes the course by adding **sections** (like chapters).
3. The professor uploads **material files** (PDFs, videos, audios, exercises) to each section.
4. When the professor is satisfied, they **publish** the course so it becomes visible to students.
5. **Students** browse all published free courses and click **Enroll**.
6. Enrolled students can open and download every material file in the course directly from their dashboard.

> **Paid courses are not active in this iteration.** The `price`, `is_free`, and `is_subscription` fields are already in the database to support it later — but for now only `is_free = true` courses are visible and enrollable. The payment layer will be added separately.

### Technologies Used

| Layer    | Technology                                           |
|----------|------------------------------------------------------|
| Backend  | FastAPI (Python)                                     |
| Database | PostgreSQL (Neon cloud) — 4 new tables               |
| ORM      | SQLModel + SQLAlchemy                                |
| Files    | `python-multipart` + `fastapi.StaticFiles`           |
| Frontend | React 19 + TypeScript                                |
| Styling  | Tailwind CSS                                         |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│                                                                     │
│  ProfessorDashboard — "My Courses" nav                              │
│    CoursesSection      → GET  /api/courses/my                       │
│    NewCourseModal      → POST /api/courses          (multipart)     │
│    CourseManager                                                    │
│      Add Section       → POST /api/courses/{id}/sections            │
│      Upload Material   → POST /api/courses/{id}/sections/{sid}/…    │
│      Publish Toggle    → PATCH /api/courses/{id}/publish            │
│                                                                     │
│  StudentDashboard — "My Courses" nav                                │
│    Browse tab          → GET  /api/courses                          │
│    Enrolled tab        → GET  /api/courses/enrolled                 │
│    Enroll button       → POST /api/courses/{id}/enroll              │
│    Course detail       → GET  /api/courses/{id}                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  HTTP  (JSON + Bearer Token)
┌──────────────────────────▼──────────────────────────────────────────┐
│                          BACKEND (FastAPI)                          │
│                                                                     │
│  course_routes.py  →  course_controller.py                          │
│       ├── saves thumbnails  →  backend/uploads/thumbnails/          │
│       ├── saves materials   →  backend/uploads/materials/           │
│       └── reads/writes 4 PostgreSQL tables                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Backend Layer Structure

```
backend/app/
├── main.py                              # MODIFIED — 4 new model imports + course router
├── models/
│   ├── user.py                          # Existing
│   ├── upgrade_request.py               # Existing
│   ├── courses.py                       # NEW — courses table
│   ├── course_section.py                # NEW — course_sections table
│   ├── course_material.py               # NEW — course_materials table
│   └── enrollment.py                    # NEW — enrollments table
├── schemas/
│   └── course.py                        # NEW — all course Pydantic schemas
├── controller/
│   └── course_controller.py             # NEW — all course business logic + file saving
└── routes/
    └── course_routes.py                 # NEW — 9 API endpoints

backend/uploads/
├── upgrade_docs/                        # Existing
├── thumbnails/                          # NEW — course thumbnail images
│   └── {professor_id}_{uuid}.{ext}
└── materials/                           # NEW — uploaded course files
    └── {section_id}_{type}_{uuid}.{ext}
```

---

## 3. Database Models

Four new PostgreSQL tables were created. All models use **SQLModel**, which lets the same class act as both a database table definition and a Pydantic validation model.

### 3.1 `courses`

**File:** `backend/app/models/courses.py` *(created)*

```python
class Course(SQLModel, table=True):
    __tablename__ = "courses"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str                    # String(255) — required
    description: Optional[str]   # Text, nullable — what the course teaches
    thumbnail: Optional[str]      # Text, nullable — relative path to image file
    price: Decimal                # Numeric(10,2) — default 0.00
    is_free: bool                 # True = free, False = paid
    is_subscription: bool         # For subscription-based access (future)
    professor_id: UUID            # FK → users.id — who created the course
    is_published: bool            # False = draft, True = visible to students
    created_at: datetime
    updated_at: datetime
```

**Why `is_published`?** A professor needs to be able to work on a course privately before it's live. Draft courses (`is_published=False`) are invisible to students. The professor publishes it when it's ready. They can also unpublish it later.

**Why is `price` stored even though free courses are the only ones active?** The schema is built for the full platform. When the payment module is added, the `price` field is already in place — no migration needed.

---

### 3.2 `course_sections`

**File:** `backend/app/models/course_section.py` *(created)*

```python
class CourseSection(SQLModel, table=True):
    __tablename__ = "course_sections"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    course_id: UUID   # FK → courses.id — which course this belongs to
    title: str        # String(255) — e.g. "Chapter 1: Introduction"
    order_index: int  # Determines display order (0, 1, 2, …)
    created_at: datetime
```

**Why sections?** Instead of dumping all files into a flat list, sections let the professor organize content into logical groups (chapters, weeks, topics). Students see a clearly structured curriculum.

**Why `order_index`?** The professor controls the order of sections. When displayed, the backend fetches sections `.order_by(CourseSection.order_index)` so they always appear in the intended sequence.

---

### 3.3 `course_materials`

**File:** `backend/app/models/course_material.py` *(created)*

```python
MaterialType = Enum("pdf", "video", "audio", "exercise", name="material_type")

class CourseMaterial(SQLModel, table=True):
    __tablename__ = "course_materials"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    section_id: UUID          # FK → course_sections.id
    title: str                # Display name — e.g. "Week 2 Slides"
    type: str                 # MaterialType enum: pdf | video | audio | exercise
    file_url: str             # Relative path — e.g. "materials/abc123.pdf"
    content_text: Optional[str]  # Plain text for future AI search/indexing
    order_index: int          # Display order within the section
    created_at: datetime
```

**Why a `MaterialType` enum?** Each material type has a different set of allowed file extensions (a "video" can't be a `.pdf`). Storing the type as a named PostgreSQL ENUM enforces the constraint at the database level — it's impossible to insert an invalid type.

**Why is `content_text` there even though it's unused?** This field is reserved for a future AI feature. The idea is that PDFs and exercises can have their text content extracted and stored here for semantic search and AI-powered Q&A. The field exists now so it can be populated without a schema migration later.

**Allowed file extensions per type:**

| Type | Accepted Extensions |
|------|---------------------|
| `pdf` | `.pdf` |
| `video` | `.mp4`, `.webm`, `.mov`, `.avi` |
| `audio` | `.mp3`, `.wav`, `.ogg`, `.m4a` |
| `exercise` | `.pdf`, `.docx`, `.zip`, `.txt` |

---

### 3.4 `enrollments`

**File:** `backend/app/models/enrollment.py` *(created)*

```python
EnrollmentStatus = Enum("active", "completed", "blocked", name="enrollment_status")

class Enrollment(SQLModel, table=True):
    __tablename__ = "enrollments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    student_id: UUID  # FK → users.id — who is enrolled
    course_id: UUID   # FK → courses.id — in which course
    status: str       # active | completed | blocked
    enrolled_at: datetime
```

**Why an `EnrollmentStatus` enum?** The enrollment has a lifecycle beyond just existing. A student can be `active` (currently learning), `completed` (finished all content), or `blocked` (admin removed access). Like `MaterialType`, this is a PostgreSQL-level enum so invalid values are rejected by the database.

**Current active states:** Only `active` is assigned when a student enrolls. `completed` and `blocked` transitions are reserved for a future progress-tracking module.

**Status lifecycle:**
```
Student enrolls → status = "active"
                      │
                      ├── Finishes content (future) → status = "completed"
                      │
                      └── Admin blocks (future)     → status = "blocked"
```

---

## 4. Backend Implementation

### 4.1 Schemas (Pydantic Models)

**File:** `backend/app/schemas/course.py` *(created)*

These are the **response shapes** — the format that the API returns in JSON. They are separate from the database models because the API response often needs computed fields (like `professor_name` or `enrolled_count`) that don't exist as columns.

```python
class MaterialOut(BaseModel):
    id: UUID
    section_id: UUID
    title: str
    type: str                    # "pdf" | "video" | "audio" | "exercise"
    file_url: str                # Relative path — frontend prepends the base URL
    content_text: Optional[str]
    order_index: int
    created_at: datetime

class SectionOut(BaseModel):
    id: UUID
    course_id: UUID
    title: str
    order_index: int
    created_at: datetime
    materials: List[MaterialOut] = []   # ← Nested: all files in this section

class CourseOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    thumbnail: Optional[str]
    is_free: bool
    professor_id: UUID
    professor_name: str                 # ← Computed: joined from users table
    is_published: bool
    created_at: datetime
    updated_at: datetime
    sections: List[SectionOut] = []     # ← Nested: all sections (with their files)
    enrolled_count: int = 0             # ← Computed: count from enrollments table

class SectionCreate(BaseModel):
    title: str
    order_index: int = 0                # Used as the request body when adding a section

class EnrollmentOut(BaseModel):
    id: UUID
    student_id: UUID
    course_id: UUID
    status: str
    enrolled_at: datetime
```

**Why fully nested responses?** A `CourseOut` contains its sections, and each section contains its materials. This means one API call gives the frontend the complete data tree it needs to render any view. The alternative — separate requests for sections and materials — would create multiple round trips per page load.

---

### 4.2 Controller (Business Logic)

**File:** `backend/app/controller/course_controller.py` *(created)*

This is where all the real work happens. Routes just receive HTTP requests and pass them here.

#### a) File Saving — `_save_file()`

```python
THUMBNAILS_DIR = "backend/uploads/thumbnails"
MATERIALS_DIR  = "backend/uploads/materials"

THUMBNAIL_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MATERIAL_EXTS  = {
    "pdf":      {".pdf"},
    "video":    {".mp4", ".webm", ".mov", ".avi"},
    "audio":    {".mp3", ".wav", ".ogg", ".m4a"},
    "exercise": {".pdf", ".docx", ".zip", ".txt"},
}

def _save_file(file: UploadFile, dest_dir: str, allowed_exts: set, prefix: str) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()

    # Reject if extension is not allowed
    if ext not in allowed_exts:
        raise HTTPException(400, f"File type '{ext}' not allowed.")

    os.makedirs(dest_dir, exist_ok=True)

    # Create a unique filename to avoid collisions
    filename = f"{prefix}_{uuid4().hex}{ext}"

    with open(os.path.join(dest_dir, filename), "wb") as f:
        shutil.copyfileobj(file.file, f)   # Stream to disk — memory safe for large files

    return filename   # Return just the name; caller builds the relative path
```

**Why `uuid4().hex` in the filename?** If two professors upload a file with the same name (e.g., `slides.pdf`), they would overwrite each other on disk. Adding a random UUID makes every filename unique.

**Why `shutil.copyfileobj`?** It streams the file in chunks instead of loading the entire file into RAM. This is essential for large video files.

#### b) Nested Response Builder — `_build_course_out()`

```python
def _build_course_out(course: Course, db: Session) -> CourseOut:
    # 1. Get professor's name from the users table
    professor = db.query(User).filter(User.id == course.professor_id).first()

    # 2. Get sections ordered by order_index
    sections_raw = db.query(CourseSection) \
        .filter(CourseSection.course_id == course.id) \
        .order_by(CourseSection.order_index).all()

    # 3. For each section, load its materials ordered by order_index
    sections = [_build_section_out(s, db) for s in sections_raw]

    # 4. Count enrollments for this course
    enrolled_count = db.query(Enrollment) \
        .filter(Enrollment.course_id == course.id).count()

    return CourseOut(
        id=course.id,
        title=course.title,
        ...
        professor_name=professor.full_name if professor else "Unknown",
        sections=sections,
        enrolled_count=enrolled_count,
    )
```

This helper is called by every function that returns a course — `create_course`, `get_my_courses`, `toggle_publish`, etc. It ensures every response is always fully nested and consistent.

#### c) Ownership Check

Every professor write operation (add section, upload material, publish) starts with this check:

```python
course = db.query(Course).filter(Course.id == UUID(course_id)).first()
if not course:
    raise HTTPException(404, "Course not found")
if str(course.professor_id) != professor_id:
    raise HTTPException(403, "Not your course")
```

**Why is this necessary?** Without it, Professor A could send a request to add materials to Professor B's course just by knowing its ID. The backend verifies ownership on every single write — it never trusts the frontend to enforce this.

#### d) Enrollment Validation

```python
def enroll_student(student_id, course_id, db):
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()

    if not course.is_published:
        raise HTTPException(400, "Course is not published")

    if not course.is_free:
        raise HTTPException(400, "Paid courses are not available yet")

    existing = db.query(Enrollment).filter(
        Enrollment.student_id == UUID(student_id),
        Enrollment.course_id  == UUID(course_id),
    ).first()
    if existing:
        raise HTTPException(409, "Already enrolled")

    enrollment = Enrollment(student_id=..., course_id=..., status="active")
    db.add(enrollment)
    db.commit()
```

Three things are checked before enrolling:
1. The course actually exists and is published
2. It's a free course (no payment required)
3. The student isn't already enrolled — prevents duplicate rows

---

### 4.3 Routes (API Endpoints)

**File:** `backend/app/routes/course_routes.py` *(created)*

```python
router = APIRouter(prefix="/courses", tags=["courses"])
```

> **Important — Route ordering:** FastAPI matches routes from top to bottom. The paths `/my` and `/enrolled` must be defined **before** `/{course_id}`. If `/{course_id}` came first, a request to `/api/courses/my` would match it and treat `"my"` as a course ID (which would 404). Always define specific static paths before dynamic wildcards.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/courses` | Professor only | Create a course (multipart) |
| `GET` | `/api/courses/my` | Professor only | My courses (newest first) |
| `POST` | `/api/courses/{id}/sections` | Professor only | Add a section (JSON) |
| `POST` | `/api/courses/{id}/sections/{sid}/materials` | Professor only | Upload a file (multipart) |
| `PATCH` | `/api/courses/{id}/publish` | Professor only | Toggle published / draft |
| `GET` | `/api/courses/enrolled` | Any logged-in user | My enrolled courses |
| `GET` | `/api/courses` | Public — no token | List all published free courses |
| `GET` | `/api/courses/{id}` | Public — no token | Full course detail (sections + files) |
| `POST` | `/api/courses/{id}/enroll` | Any logged-in user | Enroll in a course |

**Why are browse and detail public (no auth)?** Students should be able to see what courses exist before creating an account. The materials themselves are gated by enrollment — but browsing the catalog is intentionally open.

**Multipart endpoints** mix `Form(...)` and `File(...)` parameters because they receive both text fields and files in the same request:

```python
@router.post("")
async def create_course(
    title: str = Form(...),                        # text field
    description: Optional[str] = Form(None),       # text field
    is_free: bool = Form(True),                    # text field
    thumbnail: Optional[UploadFile] = File(None),  # file
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    ...
```

---

### 4.4 File Storage & Static Serving

Files are stored on the server's filesystem under `backend/uploads/`. This directory is already mounted as a static file server in `main.py`:

```python
app.mount("/uploads", StaticFiles(directory="backend/uploads"), name="uploads")
```

This means any file at `backend/uploads/X` is accessible at `http://localhost:8000/uploads/X`.

**What is stored in the database vs what is stored on disk:**

| Stored in Database | Stored on Disk |
|--------------------|---------------|
| `thumbnail: "thumbnails/abc123.jpg"` | `backend/uploads/thumbnails/abc123.jpg` |
| `file_url: "materials/xyz789.mp4"` | `backend/uploads/materials/xyz789.mp4` |

The database only stores the **relative path**. The frontend builds the full URL:

```typescript
// Frontend
const fullUrl = `http://localhost:8000/uploads/${material.file_url}`
// → "http://localhost:8000/uploads/materials/xyz789.mp4"
```

**Why relative paths in the database?** If the server domain ever changes (e.g., from localhost to a production server), you only update one URL prefix in the frontend — not thousands of rows in the database.

**Filename format:**

| File type | Filename pattern | Example |
|-----------|-----------------|---------|
| Thumbnail | `{professor_id}_{uuid}.{ext}` | `550e8400_a1b2c3d4.jpg` |
| Material | `{section_id}_{type}_{uuid}.{ext}` | `f3a9b2c1_pdf_7d8e9f0a.pdf` |

---

### 4.5 App Entry Point Changes

**File:** `backend/app/main.py` *(modified)*

Two sets of additions were made:

```python
# 1. Import all 4 new models — this registers them with SQLModel's metadata
#    so SQLModel.metadata.create_all() creates their tables on startup.
#    The "noqa: F401" comment suppresses the "imported but unused" linting warning.
from app.models.courses import Course               # noqa: F401
from app.models.course_section import CourseSection # noqa: F401
from app.models.course_material import CourseMaterial # noqa: F401
from app.models.enrollment import Enrollment        # noqa: F401

# 2. Register the course router under /api
from app.routes.course_routes import router as course_router
app.include_router(course_router, prefix="/api")
```

**Why do the models need to be imported even if not used directly?** SQLModel uses a metadata registry — it tracks all table definitions. A model only gets registered when its Python file is imported. If the import is missing, `create_all()` doesn't know the table exists and never creates it. The `# noqa: F401` silences the linter warning about unused imports so the code stays clean.

On the next backend startup, `SQLModel.metadata.create_all(engine)` automatically creates all 4 new tables. No manual SQL or migration tool needed.

---

## 5. Frontend Implementation

### 5.1 API Service

**File:** `frontend/src/api/course.ts` *(created)*

A typed HTTP client for all 9 course endpoints.

```typescript
// Shared request helper — handles auth header and error parsing
async function request<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`http://localhost:8000/api${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json()
}
```

**Why a shared `request()` helper?** Every call needs the auth header and the same error handling. Without the helper, every function would repeat 10+ lines of boilerplate. The helper also extracts FastAPI's `{ "detail": "..." }` error format into a proper JavaScript `Error`, so callers just `catch (e) { setErr(e.message) }`.

Exported functions:

```typescript
listPublishedCourses()                               // GET /courses — no token
getCourseDetail(courseId)                            // GET /courses/{id} — no token
getMyCourses(token)                                  // GET /courses/my
createCourse(token, formData: FormData)              // POST /courses
addSection(token, courseId, title, order_index)      // POST /courses/{id}/sections
uploadMaterial(token, courseId, sectionId, formData) // POST /courses/{id}/sections/{sid}/materials
togglePublish(token, courseId)                       // PATCH /courses/{id}/publish
enrollInCourse(token, courseId)                      // POST /courses/{id}/enroll
getEnrolledCourses(token)                            // GET /courses/enrolled
```

**Why `FormData` for create and upload?** These endpoints send both text fields and files in the same request. `FormData` is the browser's built-in multipart form data builder. Critically, you must **NOT** set `Content-Type` manually — the browser sets it automatically with the correct multipart boundary. Setting it manually breaks the request.

---

### 5.2 Professor Dashboard — My Courses

**File:** `frontend/src/pages/ProfessorDashboard.tsx` *(modified)*

When the professor clicks "My Courses" in the sidebar, everything is handled by a `CoursesSection` component. It has three distinct views that layer on top of each other.

#### View 1 — Course List

```
MY COURSES                                      [+ New Course]
──────────────────────────────────────────────────────────────
  Introduction to Machine Learning    2 sections · 5 students
  [Free]  ● Published
──────────────────────────────────────────────────────────────
  Deep Learning Basics                0 sections · 0 students
  [Free]  ○ Draft
──────────────────────────────────────────────────────────────
```

On mount, calls `GET /api/courses/my` and renders the list. Each row is clickable — it sets `selected` state and transitions to View 3.

#### View 2 — New Course Modal

Triggered by "+ New Course". An overlay form:

```
┌──────────────────────────────────────┐
│  New course                      [✕] │
├──────────────────────────────────────┤
│  Title *                             │
│  [ e.g. Introduction to ML        ] │
│                                      │
│  Description                         │
│  [ What students will learn…      ] │
│                                      │
│  Thumbnail (optional)                │
│  [ Click to select image          ] │
│                                      │
│  ○──  Free course  (toggle)          │
│                                      │
│     [Cancel]    [Create course]      │
└──────────────────────────────────────┘
```

On submit, fields are built into a `FormData` object (because there's an optional file) and sent to `POST /api/courses`. On success, the modal closes and immediately opens View 3 (Course Manager) for the newly created course.

#### View 3 — Course Manager

The full control panel for a single course:

```
← Back to courses

Introduction to Machine Learning               ○ Draft   [Publish]
"Learn the core concepts of ML…"

SECTIONS
┌─────────────────────────────────────────────────┐
│  Chapter 1: Introduction             [+ Add file]│
│    📄  Course Slides      PDF         [View]     │
│    🎬  Intro Video        Video       [View]     │
├─────────────────────────────────────────────────┤
│  Chapter 2: Algorithms               [+ Add file]│
│    (no files yet)                               │
└─────────────────────────────────────────────────┘

NEW SECTION
[ Section title...           ]  [Add]
```

Clicking "+ Add file" on any section expands an inline upload form directly below that section:

```
┌─────────────────────────────────────────┐
│  Upload material                        │
│                                         │
│  [ Material title                     ] │
│                                         │
│  [PDF]  [Video]  [Audio]  [Exercise]    │
│                                         │
│  [ Click to select file             ]   │
│           [Cancel]  [Upload]            │
└─────────────────────────────────────────┘
```

Clicking a type button (PDF, Video, etc.) both highlights it and updates the file input's `accept` attribute so the OS file picker pre-filters to the right formats. After a successful upload, the section refreshes and the new file appears immediately.

**Publish toggle:** Clicking "Publish" calls `PATCH /api/courses/{id}/publish`. The backend flips `is_published` and returns the updated course. The badge instantly changes from "Draft" (grey) to "Published" (green) without a page reload.

#### Component Structure

| Component | Purpose |
|-----------|---------|
| `CoursesSection` | Top-level: loads list, owns navigation between views |
| `CourseManager` | Full management view for one course |
| `NewCourseModal` | Overlay form for creating a new course |
| `UploadMaterialForm` | Inline form for uploading a file into a section |
| `FilePicker` | Reusable styled file input (click-to-open, shows filename, clear button) |

---

### 5.3 Student Dashboard — Browse & Enroll

**File:** `frontend/src/pages/StudentDashboard.tsx` *(modified)*

When a student clicks "My Courses", a `CoursesSection` component loads with two tabs.

#### Tab 1 — Browse

On mount calls `GET /api/courses` (no auth) and `GET /api/courses/enrolled` (with token) in parallel via `Promise.all`. This gets both the full catalog and the student's existing enrollments in one round trip.

```
[ Browse ]  [ Enrolled (2) ]

┌──────────────────────┐  ┌──────────────────────┐
│  [thumbnail]         │  │  [thumbnail]         │
│  Intro to ML  [Free] │  │  Web Dev Basics [Free]│
│  by Dr. Benali       │  │  by Sarah Chen       │
│  "Learn the basics…" │  │  "HTML, CSS & JS…"   │
│  3 sections          │  │  5 sections          │
│          [Enroll]    │  │     [✓ Enrolled]     │
└──────────────────────┘  └──────────────────────┘
```

Already-enrolled courses show a green "✓ Enrolled" badge instead of an enroll button. This is computed from `enrolledIds = new Set(enrolled.map(c => c.id))` — a fast O(1) lookup.

Clicking a card opens the Course Detail view. If using the small "Enroll" button on the card, `stopPropagation()` is called so it doesn't also trigger the card click.

#### Tab 2 — Enrolled

```
[ Browse ]  [ Enrolled (2) ]

┌─────────────────────────────────────────────────┐
│  Introduction to ML         3 sections  Active  │
│  by Dr. Benali                                  │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  Web Dev Basics             5 sections  Active  │
│  by Sarah Chen                                  │
└─────────────────────────────────────────────────┘
```

Clicking a row opens the Course Detail view.

#### Course Detail View (Both Tabs)

Shown when a course is selected from either tab. Replaces the tab UI entirely:

```
← Back

Introduction to Machine Learning
by Dr. Benali
"Learn the fundamentals of machine learning…"        [Enroll — Free]

Chapter 1: Introduction
  📄  Course Slides   PDF      [Open]
  🎬  Intro Video     Video    [Open]

Chapter 2: Algorithms
  📄  Algorithm Notes  PDF     [Open]
```

**File access control (frontend):**
- If the student **is enrolled** → "Open" link is shown (direct link to the file)
- If **not enrolled** → "Enroll to access" text is shown instead

This is enforced on the frontend for UX only. The files themselves are served as static files at `/uploads/...` by the backend — full backend access control for file downloads will be a future addition.

---

## 6. Complete Flow Diagrams

### Professor creates and publishes a course

```
Professor logs in → lands on ProfessorDashboard
       │
       ▼
Clicks "My Courses" in sidebar
       │
       ▼
GET /api/courses/my → course list rendered
       │
       ▼
Clicks "+ New Course" → modal opens
  Fills: title, description, thumbnail (optional), is_free toggle
  Clicks "Create course"
       │
       ▼
POST /api/courses   (multipart/form-data)
       │
       ├── 403 → user is not a professor
       └── 200 → Course created (is_published=False, sections=[])
                 → modal closes → navigates to CourseManager
       │
       ▼
Professor adds sections:
  Types title → clicks "Add"
  POST /api/courses/{id}/sections  { "title": "Chapter 1", "order_index": 0 }
  → Section appears in manager
       │
       ▼
Professor uploads materials:
  Clicks "+ Add file" on a section
  Fills: title → selects type → selects file → clicks "Upload"
  POST /api/courses/{id}/sections/{sid}/materials  (multipart)
       │
       ├── 400 → wrong file extension for selected type
       ├── 403 → not the course owner
       └── 200 → CourseMaterial saved on disk + inserted in DB
                 → file appears in section list with icon
       │
       ▼
Professor clicks "Publish"
  PATCH /api/courses/{id}/publish
  → is_published flips to True
  → badge: "Draft" → "Published" (green)
  → course is now visible to all students
```

### Student browses and enrolls

```
Student logs in → lands on StudentDashboard
       │
       ▼
Clicks "My Courses" → Browse tab shown
       │
       ▼
Promise.all([
  GET /api/courses          (no auth) → full published catalog
  GET /api/courses/enrolled (with token) → student's enrollments
])
       │
       ▼
Course cards rendered in grid
Already-enrolled courses show "✓ Enrolled" badge

       │
       ├── Student clicks on a card → Course detail view
       │       │
       │       └── Materials listed by section
       │             ├── Not enrolled → "Enroll to access"
       │             └── Enrolled     → "Open" link to file
       │
       └── Student clicks "Enroll" on a card
               │
               ▼
           POST /api/courses/{id}/enroll
               │
               ├── 400 → course not published or not free
               ├── 409 → already enrolled
               └── 200 → Enrollment created (status: "active")
                         → both lists refreshed
                         → tab switches to "Enrolled"
                         → "Open" links now appear on materials
```

---

## 7. API Reference

### POST `/api/courses`

Create a new course. **Professor only.**

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Course title |
| `description` | string | No | What the course covers |
| `is_free` | boolean | No | Default: `true` |
| `thumbnail` | File | No | Image — `.jpg`, `.jpeg`, `.png`, `.webp` |

**Success Response (200):**
```json
{
  "id": "a1b2c3d4-0000-0000-0000-000000000001",
  "title": "Introduction to Machine Learning",
  "description": "Learn the core concepts of ML from scratch.",
  "thumbnail": "thumbnails/550e8400_abc123.jpg",
  "is_free": true,
  "professor_id": "550e8400-0000-0000-0000-000000000001",
  "professor_name": "Dr. Benali",
  "is_published": false,
  "created_at": "2026-03-16T10:00:00",
  "updated_at": "2026-03-16T10:00:00",
  "sections": [],
  "enrolled_count": 0
}
```

**Error (403):** `{ "detail": "Access restricted to professors" }`

---

### GET `/api/courses/my`

List the authenticated professor's courses. **Professor only.**

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):** Array of `CourseOut`, newest first.

---

### POST `/api/courses/{course_id}/sections`

Add a section to a course. **Professor only.**

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Request Body:**
```json
{ "title": "Chapter 1: Introduction", "order_index": 0 }
```

**Success Response (200):**
```json
{
  "id": "b2c3d4e5-0000-0000-0000-000000000001",
  "course_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "title": "Chapter 1: Introduction",
  "order_index": 0,
  "created_at": "2026-03-16T10:05:00",
  "materials": []
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 403 | Course belongs to a different professor |
| 404 | Course not found |

---

### POST `/api/courses/{course_id}/sections/{section_id}/materials`

Upload a file into a section. **Professor only.**

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Display name |
| `mat_type` | string | Yes | `pdf` / `video` / `audio` / `exercise` |
| `file` | File | Yes | The file to upload |
| `order_index` | integer | No | Default: `0` |
| `content_text` | string | No | Optional raw text for AI indexing |

**Success Response (200):**
```json
{
  "id": "c3d4e5f6-0000-0000-0000-000000000001",
  "section_id": "b2c3d4e5-0000-0000-0000-000000000001",
  "title": "Week 1 Slides",
  "type": "pdf",
  "file_url": "materials/b2c3d4e5_pdf_7d8e9f0a.pdf",
  "content_text": null,
  "order_index": 0,
  "created_at": "2026-03-16T10:10:00"
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Invalid `mat_type` or file extension not allowed for that type |
| 403 | Course belongs to a different professor |
| 404 | Course or section not found |

---

### PATCH `/api/courses/{course_id}/publish`

Toggle a course between published and draft. **Professor only.**

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):** Full `CourseOut` with updated `is_published` value.

---

### GET `/api/courses`

List all published free courses. **No token required.**

**Success Response (200):** Array of `CourseOut`, newest first.

---

### GET `/api/courses/{course_id}`

Get full course detail. **No token required.**

**Success Response (200):** `CourseOut` with all sections and materials nested inside.

**Error (404):** `{ "detail": "Course not found" }`

---

### POST `/api/courses/{course_id}/enroll`

Enroll the authenticated user in a course.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):**
```json
{
  "id": "d4e5f6a7-0000-0000-0000-000000000001",
  "student_id": "440e8400-0000-0000-0000-000000000001",
  "course_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "status": "active",
  "enrolled_at": "2026-03-16T11:00:00"
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Course is not published |
| 400 | Course is not free (paid courses not available yet) |
| 404 | Course not found |
| 409 | Student is already enrolled |

---

### GET `/api/courses/enrolled`

Get all courses the authenticated user is enrolled in.

**Headers:** `Authorization: Bearer <token>`

**Success Response (200):** Array of `CourseOut` (fully nested, including all sections and materials).

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/courses.py` | Created | `courses` DB table — main course record |
| `backend/app/models/course_section.py` | Created | `course_sections` DB table — sections within a course |
| `backend/app/models/course_material.py` | Created | `course_materials` DB table — uploaded files, with `material_type` enum |
| `backend/app/models/enrollment.py` | Created | `enrollments` DB table — student → course link, with `enrollment_status` enum |
| `backend/app/schemas/course.py` | Created | All Pydantic response types: `CourseOut`, `SectionOut`, `MaterialOut`, `SectionCreate`, `EnrollmentOut` |
| `backend/app/controller/course_controller.py` | Created | All business logic: create, manage sections/materials, publish, browse, enroll |
| `backend/app/routes/course_routes.py` | Created | 9 API endpoints |
| `backend/app/main.py` | Modified | Import 4 models + register course router |
| `frontend/src/api/course.ts` | Created | Typed API client for all 9 course endpoints |
| `frontend/src/pages/ProfessorDashboard.tsx` | Modified | "My Courses" tab: course list, create modal, section + material management, publish toggle |
| `frontend/src/pages/StudentDashboard.tsx` | Modified | "My Courses" tab: Browse + Enrolled tabs, course detail with gated material access |

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|------|----------------|
| Only professors can create courses | `course_routes.py` — `require_role("professor")` dependency |
| Only the course owner can add sections, upload materials, or publish | `course_controller.py` — ownership check (`course.professor_id != professor_id` → 403) |
| New courses always start as drafts | `course_controller.py` — `is_published=False` hardcoded on creation |
| Students can only enroll in published courses | `course_controller.py` — checks `course.is_published` |
| Students can only enroll in free courses | `course_controller.py` — checks `course.is_free` |
| A student cannot enroll in the same course twice | `course_controller.py` — queries existing enrollment before inserting (→ 409 if found) |
| Material `type` must be one of the 4 valid values | `course_controller.py` — checked against `MATERIAL_EXTS` dict (→ 400 if invalid) |
| File extension must match the declared material type | `course_controller.py` — `_save_file()` validates extension against type-specific set |
| Thumbnail must be an image | `course_controller.py` — `THUMBNAIL_EXTS = {".jpg", ".jpeg", ".png", ".webp"}` |
| Browse catalog requires no login | `course_routes.py` — `GET /api/courses` and `GET /api/courses/{id}` have no auth dependency |
| Material files are only accessible via "Open" links when enrolled | Frontend (`StudentDashboard.tsx`) — checks `enrolledIds.has(course.id)` before rendering link |

---

*Document generated for PFE project Hub4Learners — March 2026*

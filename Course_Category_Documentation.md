# Hub4Learners — Course Category Classification Documentation

## PFE Project — Category-Based Course Organization Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Model](#3-database-model)
   - 3.1 [categories](#31-categories)
   - 3.2 [courses (updated)](#32-courses-updated)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Schemas (Pydantic Models)](#41-schemas-pydantic-models)
   - 4.2 [Category Controller](#42-category-controller)
   - 4.3 [Category Routes](#43-category-routes)
   - 4.4 [Course Controller Updates](#44-course-controller-updates)
   - 4.5 [Course Routes Updates](#45-course-routes-updates)
   - 4.6 [App Entry Point Changes](#46-app-entry-point-changes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [Category API Service](#51-category-api-service)
   - 5.2 [Course API Updates](#52-course-api-updates)
   - 5.3 [Professor Dashboard — Category on Create + Browse Filter](#53-professor-dashboard--category-on-create--browse-filter)
   - 5.4 [Student Dashboard — Category Filter Tabs](#54-student-dashboard--category-filter-tabs)
   - 5.5 [Home Page — Category Showcase](#55-home-page--category-showcase)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)
10. [Default Categories](#10-default-categories)

---

## 1. Overview

This document describes the **Course Category Classification** system for the Hub4Learners platform. The feature organizes courses under big subject categories (Science, Mathematics, Technology, etc.) so that:

- **Professors** classify their courses into the right category when creating them
- **Students** can quickly filter and browse courses by category instead of scrolling through everything
- **Home page** visitors see available categories at a glance

### Problem & Solution

| Problem | Solution |
|---|---|
| All courses displayed in a flat list | Organized into 10 predefined categories |
| Students must scroll/search through all courses | Category filter tabs for instant filtering |
| Professors can't classify their work | Category dropdown required when creating a course |
| No visual organization on home page | Category showcase section with course counts |

### Technologies

| Layer | Technology |
|---|---|
| Database | PostgreSQL (Neon) — new `categories` table, FK on `courses` |
| Backend | FastAPI + SQLModel — new model, controller, routes |
| Frontend | React 19 + TypeScript — category tabs, dropdown, showcase |
| Seeding | Auto-seed 10 default categories on app startup |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│                                                         │
│  HomePage ─────── category showcase (cards with icons)  │
│  ProfessorDash ── category dropdown (create course)     │
│                   category tabs (browse courses)        │
│  StudentDash ──── category tabs (browse courses)        │
│                   category badge (course cards)         │
│                                                         │
│  api/category.ts ── listCategories()                    │
│  api/course.ts ──── listPublishedCourses(categoryId?)   │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP (localhost:8000/api)
┌───────────────────▼─────────────────────────────────────┐
│                      BACKEND                            │
│                                                         │
│  routes/category_routes.py ── GET /categories           │
│                                GET /categories/{id}     │
│  routes/course_routes.py ──── POST /courses             │
│                                 (+category_id form)     │
│                                GET /courses             │
│                                 (?category_id=...)      │
│                                                         │
│  controller/category_controller.py ── list, get, seed   │
│  controller/course_controller.py ──── filter by cat     │
│                                                         │
│  models/category.py ── Category table                   │
│  models/courses.py ─── Course.category_id FK            │
└───────────────────┬─────────────────────────────────────┘
                    │ SQLAlchemy ORM
┌───────────────────▼─────────────────────────────────────┐
│                    POSTGRESQL                           │
│                                                         │
│  categories (id, name, description, icon, order_index)  │
│  courses ─── category_id FK → categories.id (nullable)  │
└─────────────────────────────────────────────────────────┘
```

### File Tree (new/modified)

```
backend/app/
├── models/
│   ├── category.py          ← NEW
│   └── courses.py           ← MODIFIED (+ category_id FK)
├── schemas/
│   ├── category.py          ← NEW
│   └── course.py            ← MODIFIED (+ category fields)
├── controller/
│   ├── category_controller.py ← NEW
│   └── course_controller.py   ← MODIFIED
├── routes/
│   ├── category_routes.py   ← NEW
│   └── course_routes.py     ← MODIFIED
└── main.py                  ← MODIFIED (import, seed, register)

frontend/src/
├── api/
│   ├── category.ts          ← NEW
│   └── course.ts            ← MODIFIED
└── pages/
    ├── HomePage.tsx          ← MODIFIED
    ├── ProfessorDashboard.tsx ← MODIFIED
    └── StudentDashboard.tsx  ← MODIFIED
```

---

## 3. Database Model

### 3.1 categories

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default uuid4 | Unique category identifier |
| `name` | VARCHAR(100) | NOT NULL, UNIQUE | Category display name |
| `description` | TEXT | nullable | Short description of the category |
| `icon` | VARCHAR(50) | NOT NULL, default "📚" | Emoji icon for UI display |
| `order_index` | INTEGER | NOT NULL, default 0 | Sort order for display |
| `created_at` | DATETIME | NOT NULL, server default | Creation timestamp |

### 3.2 courses (updated)

New field added to the existing `courses` table:

| Field | Type | Constraints | Description |
|---|---|---|---|
| `category_id` | UUID | FK → categories.id, nullable, indexed | Category this course belongs to |

The FK is nullable to maintain backward compatibility with existing courses that were created before categories existed.

---

## 4. Backend Implementation

### 4.1 Schemas (Pydantic Models)

**New: `schemas/category.py`**

```python
class CategoryOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    icon: str
    order_index: int
    course_count: int = 0   # computed: published courses in this category
    created_at: datetime
```

**Updated: `schemas/course.py` → `CourseOut`**

Two new fields added:

```python
category_id: Optional[UUID] = None
category_name: Optional[str] = None
```

### 4.2 Category Controller

**File: `controller/category_controller.py`**

| Function | Description |
|---|---|
| `seed_categories(db)` | Inserts 10 default categories if table is empty |
| `_build_category_out(cat, db)` | Builds `CategoryOut` with live `course_count` |
| `list_categories(db)` | Returns all categories sorted by `order_index` |
| `get_category(category_id, db)` | Returns single category or 404 |

The `course_count` is computed dynamically by counting published courses with the matching `category_id`.

### 4.3 Category Routes

**File: `routes/category_routes.py`**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/categories` | None | List all categories with course counts |
| GET | `/api/categories/{category_id}` | None | Get single category details |

### 4.4 Course Controller Updates

**`create_course()`** — new parameter `category_id: Optional[str]`:
- Validates category exists if provided
- Sets `course.category_id` on the new course

**`_build_course_out()`** — now includes:
- Loads the `Category` record if `course.category_id` is set
- Adds `category_id` and `category_name` to the response

**`list_published_courses()`** — new parameter `category_id: Optional[str]`:
- When provided, filters courses to only those in the specified category
- When absent, returns all published courses (existing behavior)

### 4.5 Course Routes Updates

**`POST /api/courses`** — new form field:
```
category_id: Optional[str] = Form(None)
```

**`GET /api/courses`** — new query parameter:
```
category_id: Optional[str] = None
```

### 4.6 App Entry Point Changes

**`main.py`** additions:
1. Import `Category` model (ensures table registration)
2. Import `seed_categories` from category controller
3. Import and register `category_router` at `/api`
4. Call `seed_categories(db)` during `on_startup` event (after table creation)

---

## 5. Frontend Implementation

### 5.1 Category API Service

**New file: `api/category.ts`**

```typescript
interface CategoryOut {
  id: string
  name: string
  description?: string
  icon: string
  order_index: number
  course_count: number
  created_at: string
}

listCategories(): Promise<CategoryOut[]>
```

### 5.2 Course API Updates

**`api/course.ts`**

`CourseOut` interface — two new optional fields:
```typescript
category_id?: string
category_name?: string
```

`listPublishedCourses()` — now accepts optional `categoryId`:
```typescript
listPublishedCourses(categoryId?: string): Promise<CourseOut[]>
// Appends ?category_id=... to the URL when provided
```

### 5.3 Professor Dashboard — Category on Create + Browse Filter

**NewCourseModal changes:**

```
┌─────────────────────────────────────────────┐
│ Create new course                       [X] │
├─────────────────────────────────────────────┤
│                                             │
│ TITLE *                                     │
│ ┌─────────────────────────────────────────┐ │
│ │ e.g. Introduction to Machine Learning   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ DESCRIPTION                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ What will students learn...             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ CATEGORY *                      ← NEW FIELD │
│ ┌─────────────────────────────────────────┐ │
│ │ Select a category...              ▼     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ THUMBNAIL (optional)                        │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│ │       Click to select file              │ │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│                                             │
│ ○ Free course                               │
│                                             │
│ [  Cancel  ]  [  Create course  ]           │
└─────────────────────────────────────────────┘
```

- Categories loaded on modal open via `listCategories()`
- Dropdown shows icon + name for each category
- Category is required — Create button disabled until selected
- `category_id` appended to FormData on submit

**BrowseCoursesSection changes:**

```
┌─────────────────────────────────────────────────────────┐
│ Browse Courses                          12 courses      │
│ Explore all published courses on the platform           │
│                                                         │
│ [All] [🔬 Science] [📐 Mathematics] [💻 Technology]    │ ← NEW
│ [⚙️ Engineering] [🌍 Languages] [📊 Business] [...]    │ ← TABS
│                                                         │
│ 🔍 Search courses by title or instructor...             │
│                                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│ │ Course  │ │ Course  │ │ Course  │  ← each card now   │
│ │ [Math]  │ │ [Sci]   │ │ [Tech]  │    shows category  │
│ │  ...    │ │  ...    │ │  ...    │    badge            │
│ └─────────┘ └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────────────────┘
```

- "All" tab fetches all courses (no filter)
- Clicking a category tab re-fetches courses filtered by that category
- Active tab gets dark background, inactive tabs are light with hover
- Each course card shows a violet category badge below the title

### 5.4 Student Dashboard — Category Filter Tabs

Identical category tab UI to the professor's browse section:

```
┌─────────────────────────────────────────────────────────┐
│ Browse Courses                          8 courses       │
│ Discover and enroll in courses that interest you        │
│                                                         │
│ [All] [🔬 Science] [📐 Mathematics] [💻 Technology]    │ ← NEW
│ [⚙️ Engineering] [🌍 Languages] [📊 Business] [...]    │ ← TABS
│                                                         │
│ 🔍 Search courses by title or instructor...             │
│                                                         │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐             │
│ │  Course   │ │  Course   │ │  Course   │             │
│ │ [Science] │ │ [Math]    │ │ [Tech]    │  ← badge    │
│ │  Prof X   │ │  Prof Y   │ │  Prof Z   │             │
│ │  [Enroll] │ │ ✓Enrolled │ │  [Enroll] │             │
│ └───────────┘ └───────────┘ └───────────┘             │
└─────────────────────────────────────────────────────────┘
```

- Categories loaded once on mount
- Selecting a category re-fetches courses from backend with `?category_id=`
- Search still works within the filtered results (client-side text filter)
- Category badge (violet) on each course card

### 5.5 Home Page — Category Showcase

New section between "What you get" and "How it works":

```
┌─────────────────────────────────────────────────────────┐
│                  BROWSE BY CATEGORY                     │
│                                                         │
│  Find exactly what you want to learn.                   │
│  Courses are organized into clear categories so you     │
│  can jump straight to your field of interest.           │
│                                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────┐│
│ │   🔬    │ │   📐    │ │   💻    │ │   ⚙️    │ │ 🌍 ││
│ │ Science │ │  Math   │ │  Tech   │ │  Eng.   │ │Lang.││
│ │ 5 cours │ │ 3 cours │ │ 8 cours │ │ 2 cours │ │ 1  ││
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────┘│
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────┐│
│ │   📊    │ │   🎨    │ │   🏥    │ │   📖    │ │ 📚 ││
│ │Business │ │ Arts    │ │ Health  │ │ Social  │ │Other││
│ │ 4 cours │ │ 1 cours │ │ 0 cours │ │ 2 cours │ │ 0  ││
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────┘│
└─────────────────────────────────────────────────────────┘
```

- 5-column grid on desktop, 3 on tablet, 2 on mobile
- Each card shows emoji, name, and published course count
- Cards link to `/register` (encouraging sign-up)
- Hover animation (lift + shadow)

---

## 6. Complete Flow Diagrams

### Professor: Creating a Course with Category

```
Professor clicks "New Course"
        │
        ▼
Modal opens → listCategories() loads dropdown
        │
        ▼
Professor fills: title, description, category*, thumbnail, free toggle
        │
        ▼
Clicks "Create course"
        │
        ▼
Frontend sends POST /api/courses (FormData with category_id)
        │
        ▼
Backend validates:
  ├── category exists? → 400 if not
  ├── save thumbnail if provided
  └── create Course with category_id
        │
        ▼
Returns CourseOut (with category_name)
        │
        ▼
Modal closes, course appears in "My Courses"
```

### Student: Browsing by Category

```
Student navigates to "Courses" tab
        │
        ▼
Page loads:
  ├── listCategories() → renders category tabs
  └── listPublishedCourses() → shows all courses
        │
        ▼
Student clicks "🔬 Science" tab
        │
        ▼
setActiveCat(scienceCategoryId)
        │
        ▼
listPublishedCourses(scienceCategoryId) → GET /api/courses?category_id=xxx
        │
        ▼
Backend filters: WHERE category_id = xxx AND is_published AND is_free
        │
        ▼
Only science courses displayed
        │
        ▼
Student can further search within results (client-side text filter)
        │
        ▼
Student clicks "All" tab → removes filter, shows all courses again
```

### Home Page: Category Discovery

```
Visitor lands on homepage
        │
        ▼
listCategories() → loads 10 categories with course_count
        │
        ▼
"Browse by Category" section renders grid of category cards
        │
        ▼
Visitor sees: icon + name + course count per category
        │
        ▼
Clicks any category card → redirected to /register
```

---

## 7. API Reference

### GET `/api/categories`

List all categories with published course counts.

| Field | Value |
|---|---|
| **Auth** | None (public) |
| **Response** | `CategoryOut[]` |

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Science",
    "description": "Physics, Chemistry, Biology and Natural Sciences",
    "icon": "🔬",
    "order_index": 0,
    "course_count": 5,
    "created_at": "2026-03-30T..."
  }
]
```

---

### GET `/api/categories/{category_id}`

Get a single category by ID.

| Field | Value |
|---|---|
| **Auth** | None (public) |
| **Path Param** | `category_id` (UUID string) |
| **Response** | `CategoryOut` |

**Error Response (404):**
```json
{ "detail": "Category not found" }
```

---

### GET `/api/courses` (updated)

List published free courses, optionally filtered by category.

| Field | Value |
|---|---|
| **Auth** | None (public) |
| **Query Param** | `category_id` (optional UUID string) |
| **Response** | `CourseOut[]` (now includes `category_id`, `category_name`) |

**Example:** `GET /api/courses?category_id=abc-123`

---

### POST `/api/courses` (updated)

Create a new course with optional category.

| Field | Value |
|---|---|
| **Auth** | Bearer token (professor role) |
| **Content-Type** | `multipart/form-data` |

**Request Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Course title |
| `description` | string | No | Course description |
| `is_free` | boolean | No (default true) | Free or paid |
| `category_id` | string (UUID) | No | Category to assign |
| `thumbnail` | file | No | Thumbnail image |

**Error Response (400):**
```json
{ "detail": "Invalid category" }
```

---

## 8. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `backend/app/models/category.py` | **Created** | Category SQLModel table definition |
| `backend/app/models/courses.py` | **Modified** | Added `category_id` FK column |
| `backend/app/schemas/category.py` | **Created** | CategoryOut Pydantic schema |
| `backend/app/schemas/course.py` | **Modified** | Added `category_id`, `category_name` to CourseOut |
| `backend/app/controller/category_controller.py` | **Created** | Category CRUD + seed logic |
| `backend/app/controller/course_controller.py` | **Modified** | Category import, create with category, filter, build output |
| `backend/app/routes/category_routes.py` | **Created** | GET /categories endpoints |
| `backend/app/routes/course_routes.py` | **Modified** | category_id on create & list endpoints |
| `backend/app/main.py` | **Modified** | Import model, seed on startup, register router |
| `frontend/src/api/category.ts` | **Created** | Category API client |
| `frontend/src/api/course.ts` | **Modified** | CourseOut interface + listPublishedCourses param |
| `frontend/src/pages/HomePage.tsx` | **Modified** | Category showcase section |
| `frontend/src/pages/ProfessorDashboard.tsx` | **Modified** | Category dropdown + browse filter tabs |
| `frontend/src/pages/StudentDashboard.tsx` | **Modified** | Category browse filter tabs + badge |

---

## 9. Business Rules & Validation

| Rule | Where Enforced |
|---|---|
| Category name must be unique | Database UNIQUE constraint on `categories.name` |
| Category is required when creating a course | Frontend disables "Create" button until selected |
| Invalid category_id returns 400 | Backend `create_course()` validates FK exists |
| Existing courses without category still work | `category_id` is nullable — backward compatible |
| Categories are auto-seeded once | `seed_categories()` only inserts if table is empty |
| Category filter is server-side | Backend `WHERE` clause, not client-side filtering |
| Text search is client-side within filtered results | Frontend `.filter()` on title/professor_name |
| course_count reflects only published courses | `_build_category_out()` counts `is_published == True` |
| Categories sorted by order_index | Backend `ORDER BY order_index` |

---

## 10. Default Categories

The following 10 categories are auto-seeded on first startup:

| # | Icon | Name | Description |
|---|---|---|---|
| 0 | 🔬 | Science | Physics, Chemistry, Biology and Natural Sciences |
| 1 | 📐 | Mathematics | Algebra, Calculus, Statistics and Applied Mathematics |
| 2 | 💻 | Technology | Programming, Software Development and IT |
| 3 | ⚙️ | Engineering | Civil, Mechanical, Electrical and other Engineering fields |
| 4 | 🌍 | Languages | English, French, Arabic, Spanish and Linguistics |
| 5 | 📊 | Business | Management, Marketing, Finance and Entrepreneurship |
| 6 | 🎨 | Arts & Design | Visual Arts, Graphic Design, Music and Creative Fields |
| 7 | 🏥 | Health & Medicine | Medical Sciences, Nursing, Pharmacy and Public Health |
| 8 | 📖 | Social Sciences | Psychology, Sociology, History and Political Science |
| 9 | 📚 | Other | Courses that don't fit into the above categories |

---

*Document generated for PFE project Hub4Learners — March 2026*

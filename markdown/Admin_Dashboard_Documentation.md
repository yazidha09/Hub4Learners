# Hub4Learners — Admin Dashboard Documentation

## PFE Project — Admin Users, Courses & Categories Management Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Backend Implementation](#3-backend-implementation)
   - 3.1 [Admin Controller](#31-admin-controller)
   - 3.2 [Admin Routes](#32-admin-routes)
   - 3.3 [Category Controller Updates](#33-category-controller-updates)
   - 3.4 [Category Routes Updates](#34-category-routes-updates)
   - 3.5 [App Entry Point Changes](#35-app-entry-point-changes)
4. [Frontend Implementation](#4-frontend-implementation)
   - 4.1 [Admin API Service](#41-admin-api-service)
   - 4.2 [Category API Updates](#42-category-api-updates)
   - 4.3 [Admin Dashboard — Overview Panel](#43-admin-dashboard--overview-panel)
   - 4.4 [Admin Dashboard — Users Panel](#44-admin-dashboard--users-panel)
   - 4.5 [Admin Dashboard — Courses Panel](#45-admin-dashboard--courses-panel)
   - 4.6 [Admin Dashboard — Categories Panel](#46-admin-dashboard--categories-panel)
5. [Complete Flow Diagrams](#5-complete-flow-diagrams)
6. [API Reference](#6-api-reference)
7. [Files Created / Modified](#7-files-created--modified)
8. [Business Rules & Validation](#8-business-rules--validation)

---

## 1. Overview

This document describes the **Admin Dashboard** system for Hub4Learners. It replaces the previous mock/placeholder admin pages with fully functional, real-data panels for managing users, courses, and categories.

### What was built

| Feature | Description |
|---|---|
| **Overview Panel** | Real platform stats (total users, courses, enrollments), live user distribution chart, recent registrations, quick action links |
| **Users Panel** | List all users, search by name/email, filter by role, change any user's role via dropdown, delete users with confirmation |
| **Courses Panel** | List ALL courses (draft + published), filter by category, search, toggle publish/unpublish, delete with confirmation |
| **Categories Panel** | Full CRUD — create new categories with icon picker, edit existing, delete (un-assigns courses), live course count |
| **Upgrade Requests** | Already existed — preserved and integrated into the new nav structure |

### Technologies

| Layer | Technology |
|---|---|
| Backend | FastAPI — new `admin_controller.py` + `admin_routes.py`, updated `category_controller.py` + `category_routes.py` |
| Frontend | React 19 + TypeScript — new `admin.ts` API, updated `category.ts`, rewritten `AdminDashboard.tsx` |
| Auth | JWT + `require_role("admin")` on all admin endpoints |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│                                                             │
│  AdminDashboard.tsx                                         │
│  ├── OverviewPanel ─── getStats(), listUsers() (recent 6)   │
│  ├── UsersPanel ────── listUsers(), changeUserRole(),        │
│  │                     deleteUser()                         │
│  ├── CoursesPanel ──── listAllCourses(), adminTogglePublish()│
│  │                     adminDeleteCourse()                  │
│  ├── CategoriesPanel ─ listCategories(), createCategory(),   │
│  │                     updateCategory(), deleteCategory()   │
│  └── UpgradeRequestsPanel (existing)                        │
│                                                             │
│  api/admin.ts ──── admin API client (users, courses, stats) │
│  api/category.ts ─ updated with create/update/delete        │
└───────────────────┬─────────────────────────────────────────┘
                    │ HTTP (localhost:8000/api)
┌───────────────────▼─────────────────────────────────────────┐
│                      BACKEND                                │
│                                                             │
│  routes/admin_routes.py                                     │
│  ├── GET  /admin/stats                                      │
│  ├── GET  /admin/users(?role=&search=)                      │
│  ├── PUT  /admin/users/{id}/role                            │
│  ├── DELETE /admin/users/{id}                               │
│  ├── GET  /admin/courses(?category_id=)                     │
│  ├── PATCH /admin/courses/{id}/publish                      │
│  └── DELETE /admin/courses/{id}                             │
│                                                             │
│  routes/category_routes.py (updated)                        │
│  ├── POST /categories (admin)                               │
│  ├── PUT  /categories/{id} (admin)                          │
│  └── DELETE /categories/{id} (admin)                        │
│                                                             │
│  controller/admin_controller.py ── business logic           │
│  controller/category_controller.py ── CRUD added            │
└─────────────────────────────────────────────────────────────┘
```

### File Tree (new/modified)

```
backend/app/
├── controller/
│   ├── admin_controller.py       ← NEW
│   └── category_controller.py    ← MODIFIED (+ create, update, delete)
├── routes/
│   ├── admin_routes.py           ← NEW
│   └── category_routes.py        ← MODIFIED (+ POST, PUT, DELETE)
└── main.py                       ← MODIFIED (+ admin_router)

frontend/src/
├── api/
│   ├── admin.ts                  ← NEW
│   └── category.ts               ← MODIFIED (+ CRUD functions)
└── pages/
    └── AdminDashboard.tsx         ← REWRITTEN
```

---

## 3. Backend Implementation

### 3.1 Admin Controller

**File: `controller/admin_controller.py`**

| Function | Parameters | Description |
|---|---|---|
| `get_platform_stats(db)` | — | Returns counts: total users, students, professors, admins, courses, published courses, enrollments |
| `list_users(db, role?, search?)` | `role`: filter by role; `search`: name/email ILIKE | Returns all users sorted by newest first |
| `change_user_role(admin_id, user_id, new_role, db)` | — | Changes a user's role; prevents self-modification |
| `delete_user(admin_id, user_id, db)` | — | Deletes a user; prevents self-deletion |
| `list_all_courses(db, category_id?)` | — | Returns ALL courses (draft + published), optionally filtered by category |
| `admin_toggle_publish(course_id, db)` | — | Toggles any course's publish status (no ownership check) |
| `delete_course(course_id, db)` | — | Cascading delete: materials → sections → enrollments → course |

### 3.2 Admin Routes

**File: `routes/admin_routes.py`** — All require `admin` role.

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | List users (with `?role=` and `?search=` query params) |
| PUT | `/api/admin/users/{user_id}/role` | Change user role (JSON body: `{ "role": "professor" }`) |
| DELETE | `/api/admin/users/{user_id}` | Delete user |
| GET | `/api/admin/courses` | List all courses (with `?category_id=` filter) |
| PATCH | `/api/admin/courses/{course_id}/publish` | Toggle publish status |
| DELETE | `/api/admin/courses/{course_id}` | Delete course (cascade) |

### 3.3 Category Controller Updates

Three new functions added to `category_controller.py`:

| Function | Description |
|---|---|
| `create_category(name, description, icon, db)` | Creates a new category; checks name uniqueness; auto-assigns `order_index` |
| `update_category(cat_id, name, description, icon, db)` | Updates any fields; checks name uniqueness if changed |
| `delete_category(cat_id, db)` | Deletes category; sets `category_id = NULL` on all associated courses |

### 3.4 Category Routes Updates

Three new endpoints added (admin only):

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/categories` | Admin | Create category (JSON: `{ name, description?, icon }`) |
| PUT | `/api/categories/{id}` | Admin | Update category (JSON: `{ name?, description?, icon? }`) |
| DELETE | `/api/categories/{id}` | Admin | Delete category |

### 3.5 App Entry Point Changes

`main.py` — added `admin_router` import and registration at `/api`.

---

## 4. Frontend Implementation

### 4.1 Admin API Service

**New file: `api/admin.ts`**

```typescript
interface AdminUser {
  id: string; full_name: string; email: string
  role: string; is_active: boolean; created_at: string
}

interface PlatformStats {
  total_users: number; total_students: number; total_professors: number
  total_admins: number; total_courses: number; published_courses: number
  total_enrollments: number
}

getStats(token)                              → PlatformStats
listUsers(token, role?, search?)             → AdminUser[]
changeUserRole(token, userId, role)          → AdminUser
deleteUser(token, userId)                    → { detail }
listAllCourses(token, categoryId?)           → CourseOut[]
adminTogglePublish(token, courseId)           → CourseOut
adminDeleteCourse(token, courseId)            → { detail }
```

### 4.2 Category API Updates

**Updated file: `api/category.ts`** — three new functions:

```typescript
createCategory(token, { name, description?, icon })  → CategoryOut
updateCategory(token, categoryId, { name?, desc?, icon? }) → CategoryOut
deleteCategory(token, categoryId)                      → { detail }
```

### 4.3 Admin Dashboard — Overview Panel

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ADMINISTRATION                  [Review upgrades]      ││
│  │  Platform overview               [Manage users]         ││
│  │                                                         ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  ││
│  │  │Total     │ │Active    │ │Professors│ │Enrollments│  ││
│  │  │Users     │ │Courses   │ │          │ │           │  ││
│  │  │  1,234   │ │  45      │ │  12      │ │  892      │  ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─ Recent registrations ──────┐ ┌─ User distribution ────┐│
│  │ Name  │ Email │ Role │ Date │ │ ██████████████░░ 87%   ││
│  │ ────  │ ───── │ ──── │ ──── │ │ Students              ││
│  │ User1 │ @...  │ stud │ Mar 2│ │ ███░░░░░░░░░░░░ 11%   ││
│  │ User2 │ @...  │ prof │ Mar 1│ │ Professors             ││
│  │ ...   │       │      │      │ │ ░░░░░░░░░░░░░░░  2%   ││
│  └─────────────────────────────┘ │ Admins                 ││
│                                  ├────────────────────────┤│
│                                  │ Quick actions           ││
│                                  │ > Manage Users          ││
│                                  │ > Manage Courses        ││
│                                  │ > Manage Categories     ││
│                                  │ > Review Upgrades       ││
│                                  └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- All stats are real-time from `GET /admin/stats`
- Recent registrations table shows the latest 6 users
- User distribution bar computed from real percentages

### 4.4 Admin Dashboard — Users Panel

```
┌─────────────────────────────────────────────────────────────┐
│  Users                                                      │
│  Manage all platform users, change roles, or remove accounts│
│                                                             │
│  🔍 Search by name or email...    [All][student][prof][admin]│
│                                                             │
│  ┌─ Name ──── Email ──── Role ──── Joined ── Actions ──────┐│
│  │ [A] Amine  amine@...  [student▾]  Mar 30    🗑          ││
│  │ [F] Fatima fatima@... [professor▾] Mar 29    🗑          ││
│  │ [K] Karim  karim@...  [student▾]  Mar 28    🗑          ││
│  │ ...                                                      ││
│  └──────────────────────────────────────────── 42 users ────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Search** by name or email (server-side ILIKE)
- **Role filter tabs**: All / student / professor / admin
- **Role dropdown**: Change any user's role instantly (inline `<select>`)
- **Delete**: Trash icon → confirm/cancel inline buttons
- Cannot change own role or delete yourself (backend enforced)
- User count shown in footer

### 4.5 Admin Dashboard — Courses Panel

```
┌─────────────────────────────────────────────────────────────┐
│  Courses                                                    │
│  View all courses, toggle publish status, or remove them    │
│                                                             │
│  [All] [🔬Science] [📐Math] [💻Tech] [⚙️Eng] [...]        │
│  🔍 Search by title or professor...                         │
│                                                             │
│  ┌ [thumb] ML Intro — Prof Benali — [Science] 3sec 12enr  ┐│
│  │                                        [Published] 🗑   ││
│  ├ [thumb] React — S. Chen — [Technology] 5sec 8enr        ┤│
│  │                                        [Draft    ] 🗑   ││
│  ├ [thumb] DSA — Prof Hamidi — [Technology] 2sec 20enr     ┤│
│  │                                        [Published] 🗑   ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Shows ALL courses (published AND draft) — unlike student/professor browse which only shows published
- **Category filter tabs**: Server-side filtering via `?category_id=`
- **Search**: Client-side text filter within results
- **Publish toggle**: Click "Published" / "Draft" button to toggle (calls `PATCH /admin/courses/{id}/publish`)
- **Delete**: Trash icon with confirm/cancel — cascading delete (materials, sections, enrollments)
- Category badge, section count, enrollment count shown on each row

### 4.6 Admin Dashboard — Categories Panel

```
┌─────────────────────────────────────────────────────────────┐
│  Categories                                    [+ New category]│
│  Create and manage course categories                         │
│                                                             │
│  ┌ New category ────────────────────────────────────────────┐│
│  │ ICON                                                     ││
│  │ [📚][🔬][📐][💻][⚙️][🌍][📊][🎨][🏥][📖][🎯][🧪]... ││
│  │                                                          ││
│  │ NAME *                                                   ││
│  │ ┌─────────────────────────────────────────────────────┐  ││
│  │ │ e.g. Artificial Intelligence                        │  ││
│  │ └─────────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │ DESCRIPTION                                              ││
│  │ ┌─────────────────────────────────────────────────────┐  ││
│  │ │ Short description of this category...               │  ││
│  │ └─────────────────────────────────────────────────────┘  ││
│  │                                                          ││
│  │ [Cancel]  [Create]                                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  🔬 Science — Physics, Chemistry...        5 courses  ✏️ 🗑 │
│  📐 Mathematics — Algebra, Calculus...     3 courses  ✏️ 🗑 │
│  💻 Technology — Programming, IT...        8 courses  ✏️ 🗑 │
│  ⚙️ Engineering — Civil, Mech...           2 courses  ✏️ 🗑 │
│  🌍 Languages — English, French...         1 course   ✏️ 🗑 │
│  📊 Business — Management, Finance...      4 courses  ✏️ 🗑 │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Create**: "New category" button opens inline form with emoji icon picker, name, description
- **Edit**: Pencil icon opens the same form pre-filled with existing values
- **Delete**: Trash icon with confirm/cancel — un-assigns courses from that category (sets `category_id = NULL`)
- **Live course count**: Shows how many published courses are in each category
- **Icon picker**: Grid of 18 emoji options to choose from
- Name uniqueness enforced (backend returns 409 if duplicate)

---

## 5. Complete Flow Diagrams

### Admin: Managing Users

```
Admin navigates to "Users" tab
        │
        ▼
GET /admin/users → displays all users
        │
        ▼
Admin can:
├── Search by name/email → re-fetches with ?search=
├── Filter by role → re-fetches with ?role=
├── Change role → select dropdown → PUT /admin/users/{id}/role
│   Backend validates:
│   ├── Role is valid (student|professor|admin)
│   └── Cannot change own role → 400
└── Delete user → click trash → confirm → DELETE /admin/users/{id}
    Backend validates:
    └── Cannot delete yourself → 400
```

### Admin: Managing Courses

```
Admin navigates to "Courses" tab
        │
        ▼
GET /admin/courses → displays ALL courses (draft + published)
listCategories() → renders category filter tabs
        │
        ▼
Admin can:
├── Filter by category → re-fetches with ?category_id=
├── Search by title/professor → client-side filter
├── Toggle publish → click "Published"/"Draft" button
│   └── PATCH /admin/courses/{id}/publish → toggles is_published
└── Delete course → click trash → confirm → DELETE /admin/courses/{id}
    Backend cascade: materials → sections → enrollments → course
```

### Admin: Managing Categories

```
Admin navigates to "Categories" tab
        │
        ▼
listCategories() → displays all categories with course counts
        │
        ▼
Admin can:
├── Create → click "New category" → fill form → POST /categories
│   Backend validates: name uniqueness → 409 if duplicate
├── Edit → click pencil → form pre-filled → PUT /categories/{id}
│   Backend validates: new name uniqueness if changed
└── Delete → click trash → confirm → DELETE /categories/{id}
    Backend: sets category_id = NULL on all associated courses
```

---

## 6. API Reference

### GET `/api/admin/stats`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Response** | `PlatformStats` |

**Success (200):**
```json
{
  "total_users": 1234,
  "total_students": 1100,
  "total_professors": 120,
  "total_admins": 14,
  "total_courses": 45,
  "published_courses": 38,
  "total_enrollments": 892
}
```

---

### GET `/api/admin/users`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Query Params** | `role` (optional), `search` (optional) |
| **Response** | `AdminUser[]` |

**Example:** `GET /api/admin/users?role=professor&search=fatima`

---

### PUT `/api/admin/users/{user_id}/role`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Body** | `{ "role": "professor" }` |
| **Response** | `AdminUser` |

**Errors:** 400 (invalid role, self-modify), 404 (not found)

---

### DELETE `/api/admin/users/{user_id}`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Response** | `{ "detail": "User deleted" }` |

**Errors:** 400 (self-delete), 404 (not found)

---

### GET `/api/admin/courses`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Query Params** | `category_id` (optional) |
| **Response** | `CourseOut[]` (ALL courses, not just published) |

---

### PATCH `/api/admin/courses/{course_id}/publish`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Response** | `CourseOut` |

---

### DELETE `/api/admin/courses/{course_id}`

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Response** | `{ "detail": "Course deleted" }` |

Cascading delete: materials → sections → enrollments → course.

---

### POST `/api/categories` (new)

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Body** | `{ "name": "AI", "description": "...", "icon": "🧠" }` |
| **Response** | `CategoryOut` |

**Errors:** 409 (name already exists)

---

### PUT `/api/categories/{category_id}` (new)

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Body** | `{ "name?": "...", "description?": "...", "icon?": "..." }` |
| **Response** | `CategoryOut` |

**Errors:** 404 (not found), 409 (name duplicate)

---

### DELETE `/api/categories/{category_id}` (new)

| Field | Value |
|---|---|
| **Auth** | Bearer token (admin role) |
| **Response** | `{ "detail": "Category deleted" }` |

Un-assigns all courses from this category (`category_id → NULL`).

---

## 7. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `backend/app/controller/admin_controller.py` | **Created** | Admin business logic (users, courses, stats) |
| `backend/app/routes/admin_routes.py` | **Created** | Admin API endpoints |
| `backend/app/controller/category_controller.py` | **Modified** | Added create, update, delete functions |
| `backend/app/routes/category_routes.py` | **Modified** | Added POST, PUT, DELETE endpoints (admin) |
| `backend/app/main.py` | **Modified** | Import and register admin_router |
| `frontend/src/api/admin.ts` | **Created** | Admin API client (stats, users, courses) |
| `frontend/src/api/category.ts` | **Modified** | Added createCategory, updateCategory, deleteCategory |
| `frontend/src/pages/AdminDashboard.tsx` | **Rewritten** | Full admin dashboard with 5 panels |

---

## 8. Business Rules & Validation

| Rule | Where Enforced |
|---|---|
| All admin endpoints require `admin` role | `require_role("admin")` on every route |
| Admin cannot change their own role | Backend `change_user_role()` checks `admin_id != user_id` |
| Admin cannot delete themselves | Backend `delete_user()` checks `admin_id != user_id` |
| Valid roles: student, professor, admin | Backend validates against `VALID_ROLES` set |
| Course delete is cascading | Backend deletes materials → sections → enrollments → course |
| Category name must be unique | Database UNIQUE + backend check on create/update |
| Deleting a category un-assigns courses | Backend sets `category_id = NULL` on affected courses |
| Admin sees ALL courses (draft + published) | `list_all_courses()` has no `is_published` filter |
| Admin can publish/unpublish any course | No ownership check on `admin_toggle_publish()` |
| Category course_count reflects published only | `_build_category_out()` counts `is_published == True` |
| User search is server-side (ILIKE) | Backend SQL `WHERE name ILIKE %search% OR email ILIKE %search%` |
| Category icon picker has 18 emoji options | Frontend UI; backend accepts any string up to 50 chars |

---

*Document generated for PFE project Hub4Learners — March 2026*

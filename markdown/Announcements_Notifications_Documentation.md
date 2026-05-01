# University Announcements & Notification System
## Hub4Learners — Feature Documentation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Model](#3-database-model)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

### Problem
University admins had no way to communicate directly with the members of their university (students and professors). There was also no role boundary preventing university admins from controlling course publish status — a responsibility that belongs only to professors and super/regional admins.

### Solution
Three things were built and fixed in this iteration:

| # | What | Result |
|---|------|--------|
| 1 | Removed course control from university admins | University admins can no longer see or toggle courses |
| 2 | University Announcement system | Admins compose a notice → all university members receive it instantly as a notification |
| 3 | Member-facing Announcements page | Students and professors can browse all past announcements from their university |

Additionally, the notification panel UI was overhauled and moved to a React Portal so it renders above all page content instead of being trapped behind it.

### Technologies

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, SQLModel, SQLAlchemy, PostgreSQL (Neon) |
| Real-time | WebSocket (`websocket_manager.py`) |
| Frontend | React 19, TypeScript, Tailwind CSS |
| Auth | JWT via `python-jose` — `university_id` is embedded in the token payload |
| Portal rendering | `ReactDOM.createPortal` |

---

## 2. Architecture

### End-to-End Flow

```
University Admin (browser)
        │
        │  POST /api/announcements
        │  { title, body }
        ▼
┌─────────────────────────┐
│   announcement_routes   │  ← FastAPI router
│  require_role(univ_adm) │
└────────────┬────────────┘
             │  1. Save Announcement row
             │  2. Query all users WHERE university_id = actor.university_id
             │  3. For each user → notification_controller.push()
             ▼
┌─────────────────────────┐       ┌──────────────────────────┐
│  notifications table    │       │   WebSocket Manager      │
│  (one row per user)     │──────▶│  notify_user(user_id, …) │
└─────────────────────────┘       └──────────┬───────────────┘
                                             │
                              ┌──────────────▼───────────────┐
                              │  Connected browsers           │
                              │  (students / professors)      │
                              │  receive live push event      │
                              └──────────────────────────────┘

Student / Professor (browser)
        │
        │  GET /api/announcements/my
        ▼
┌─────────────────────────┐
│   announcement_routes   │  ← any authenticated user
│   get_current_user()    │
│   filter by university  │
└─────────────────────────┘
```

### File Tree (new / changed files only)

```
Hub4Learners/
├── backend/
│   └── app/
│       ├── models/
│       │   └── announcement.py          ← NEW
│       └── routes/
│           └── announcement_routes.py   ← NEW
│       └── main.py                      ← MODIFIED
│
└── frontend/
    └── src/
        ├── api/
        │   └── admin.ts                 ← MODIFIED
        ├── components/
        │   └── DashboardLayout.tsx      ← MODIFIED (notification panel)
        └── pages/
            ├── AdminDashboard.tsx       ← MODIFIED
            ├── StudentDashboard.tsx     ← MODIFIED
            └── ProfessorDashboard.tsx   ← MODIFIED
```

---

## 3. Database Model

### `announcements` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Unique announcement ID |
| `university_id` | UUID | NOT NULL, FK → universities(id) ON DELETE CASCADE, indexed | Which university this belongs to |
| `created_by` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | The university admin who posted it |
| `title` | VARCHAR(255) | NOT NULL | Announcement title |
| `body` | TEXT | NOT NULL | Full announcement content |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP | When it was published |

**Index:** `ix_announcements_university` on `(university_id)` — fast lookup of all announcements for a university.

The table is created by the startup migration in `main.py` (idempotent `CREATE TABLE IF NOT EXISTS`), so no manual SQL is needed on first deploy.

---

## 4. Backend Implementation

### 4.1 Model — `backend/app/models/announcement.py`

```python
class Announcement(SQLModel, table=True):
    __tablename__ = "announcements"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    university_id: UUID = Field(foreign_key="universities.id", index=True)
    created_by: UUID = Field(foreign_key="users.id")
    title: str = Field(max_length=255)
    body: str = Field(sa_column=Column(sa.Text, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

A plain SQLModel table class. No relationships are declared — all lookups use explicit `db.query()` calls.

---

### 4.2 Routes — `backend/app/routes/announcement_routes.py`

Three endpoints on the `/api/announcements` prefix:

#### `POST /` — create & broadcast (university_admin only)

```
1. Validate actor has university_id in JWT
2. INSERT into announcements
3. SELECT all users WHERE university_id = actor.university_id
4. For each user:
       notification_controller.push(user_id, type="announcement", title, body, meta={announcement_id})
   → saves a Notification row
   → tries to deliver over WebSocket (falls back silently if user is offline)
5. Return AnnouncementOut with recipient_count
```

#### `GET /` — admin list (university_admin only)

Returns all announcements for the admin's university, newest first. Each entry includes the current `recipient_count` (live count of university members).

#### `GET /my` — member view (any authenticated user)

Reads `university_id` from the JWT payload. Returns announcements for that university, newest first. Returns `[]` if the user has no university assigned. The `recipient_count` field is `0` here — members don't need to see how many people were notified.

---

### 4.3 Notification fan-out detail

The existing `notification_controller.push()` function handles everything:

```python
async def push(user_id, type, title, body, db, meta=None):
    # 1. Persist to DB (so offline users see it later)
    notif = Notification(user_id=..., type=type, ...)
    db.add(notif); db.commit()

    # 2. Real-time push via WebSocket (no-op if user not connected)
    await manager.notify_user(user_id, { id, type, title, body, meta, is_read, created_at })
```

For an announcement with 50 university members, this loop runs 50 times — one notification row + one WebSocket attempt per user. This is synchronous per iteration but `await`-ed properly inside an `async` route handler.

---

### 4.4 `main.py` changes

```python
# Import model so SQLModel.metadata knows the table
from app.models.announcement import Announcement  # noqa: F401

# Import router
from app.routes.announcement_routes import router as announcement_router

# Startup migration (idempotent)
"""
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""
"CREATE INDEX IF NOT EXISTS ix_announcements_university ON announcements(university_id)"

# Register router
app.include_router(announcement_router, prefix="/api")
```

---

## 5. Frontend Implementation

### 5.1 API service — `frontend/src/api/admin.ts`

Three functions added (all use the shared `request<T>()` helper with Bearer auth):

```typescript
// University admin — list their own announcements
listAnnouncements(token): Promise<AnnouncementOut[]>
  → GET /api/announcements

// University admin — publish a new announcement
createAnnouncement(token, title, body): Promise<AnnouncementOut>
  → POST /api/announcements  { title, body }

// Any logged-in user — read announcements from their university
getMyAnnouncements(token): Promise<AnnouncementOut[]>
  → GET /api/announcements/my
```

`AnnouncementOut` interface:

```typescript
interface AnnouncementOut {
  id: string
  university_id: string
  created_by: string
  title: string
  body: string
  recipient_count: number   // 0 for /my endpoint
  created_at: string        // ISO string
}
```

---

### 5.2 Admin Dashboard — `AnnouncementsPanel`

Added to `AdminDashboard.tsx`, visible only to `university_admin` role via `NAV_ALLOW`.

```
┌─────────────────────────────────────────┐
│  UNIVERSITY                             │
│  Announcements                          │
│  ─────────────────────────────────────  │
│  NEW ANNOUNCEMENT                       │
│  ┌───────────────────────────────────┐  │
│  │ Title                             │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Write your announcement here…     │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                           [ Publish ]   │
│                                         │
│  PAST ANNOUNCEMENTS                     │
│  ┌───────────────────────────────────┐  │
│  │ Event on 201        12/04/2026    │  │
│  │ Hello everyone                    │  │
│  │ 42 recipients                     │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Exam schedule update  09/04/2026  │  │
│  │ …                                 │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

- On **Publish**: calls `createAnnouncement()`, prepends the result to the list, shows "Sent to N members" confirmation, clears the form.
- On **load**: calls `listAnnouncements()` and renders the history.
- Button is disabled while submitting or when either field is empty.

---

### 5.3 University Admin — course access removed

```typescript
// Before
university_admin: ['home', 'org', 'users', 'courses'],

// After
university_admin: ['home', 'org', 'users', 'announcements'],
```

- Courses nav item removed from sidebar.
- "View Courses" quick action removed from the overview panel.
- The `activeNav === 'courses'` render is guarded with `&& role !== 'university_admin'` as a belt-and-suspenders check.

---

### 5.4 Student & Professor Dashboards — `AnnouncementsSection`

The same read-only component is added to both `StudentDashboard.tsx` and `ProfessorDashboard.tsx`.

```
┌─────────────────────────────────────────┐
│  UNIVERSITY                             │
│  Announcements                          │
│  From Iset Tozeur                       │
│  ─────────────────────────────────────  │
│  ┌──┬──────────────────────────────┐   │
│  │🟧│ Event on 201    12/04/2026   │   │
│  │  │ Hello everyone               │   │
│  └──┴──────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Conditional nav item:** The "Announcements" entry is injected into the nav array only when `user.university_id` is set. Users with no university see no announcements tab at all.

```typescript
const navItems = user?.university_id
  ? [...BASE_NAV.slice(0, -1), ANNOUNCEMENTS_NAV_ITEM, BASE_NAV[BASE_NAV.length - 1]]
  : BASE_NAV
```

The item is inserted second-to-last so "Grades" / "Analytics" stays at the bottom.

---

### 5.5 Notification Panel — UI overhaul & Portal fix

#### The stacking context bug

The panel was rendered as `position: absolute` inside the dark sidebar (`position: sticky`). Because `sticky` elements create their own stacking context, the panel's `z-index: 50` had no effect relative to the main content — it always appeared behind course cards and other page elements.

**Fix:** The panel is now rendered via `ReactDOM.createPortal` directly into `document.body`:

```tsx
return createPortal(
  <div
    data-notif-panel
    className="fixed z-[9999] w-[340px] ..."
    style={{ left, bottom }}   // computed from bell button's getBoundingClientRect()
  >
    ...
  </div>,
  document.body
)
```

The position is calculated fresh every time the panel opens:

```typescript
onClick={() => {
  setNotifOpen(o => {
    if (!o) setBellRect(bellRef.current?.getBoundingClientRect() ?? null)
    return !o
  })
}}

// Inside panel:
const left   = anchorRect ? Math.max(8, anchorRect.left - PANEL_WIDTH + anchorRect.width) : 8
const bottom = anchorRect ? window.innerHeight - anchorRect.top + 8 : 80
```

The outside-click handler was also updated — since the panel is no longer inside `notifRef`, clicks inside the portal are now detected using `element.closest('[data-notif-panel]')`:

```typescript
function handler(e: MouseEvent) {
  const insideBell  = notifRef.current?.contains(e.target as Node)
  const insidePanel = (e.target as Element)?.closest?.('[data-notif-panel]')
  if (!insideBell && !insidePanel) setNotifOpen(false)
}
```

#### Visual improvements

| Before | After |
|--------|-------|
| Grey fallback icon for announcements | Orange megaphone icon (`bg-orange-100 text-orange-500`) |
| Blue tint on unread items | Warm orange tint matching app accent |
| Small dot for unread indicator | Left-edge accent bar on unread rows |
| Plain "Notifications" header | Header with live unread count badge |
| `Clear all` hard to click | `Clear all` has hover background |
| Body text can overflow | `line-clamp-2` prevents overflow |
| Read/unread same weight | Unread = `font-semibold`, read = `font-medium` |
| Generic empty state | "You're all caught up" + subtitle |

**Announcement type** added to icon/color maps:

```typescript
NOTIF_ICONS.announcement = <svg>/* megaphone */</svg>
NOTIF_COLORS.announcement = 'bg-orange-100 text-orange-500'
```

---

## 6. Complete Flow Diagrams

### Flow 1 — Admin publishes an announcement

```
[University Admin]
      │
      │  Navigates to Announcements nav item
      │
      ▼
[AnnouncementsPanel]
      │
      │  Fills in title + body, clicks Publish
      │
      ▼
createAnnouncement(token, title, body)
      │
      │  POST /api/announcements
      │  Authorization: Bearer <jwt>
      ▼
[announcement_routes — create_announcement]
      │
      ├─ Reads university_id from JWT
      ├─ Inserts Announcement row into DB
      │
      ├─ SELECT all users WHERE university_id = actor.university_id
      │    (returns N users)
      │
      └─ FOR each user in recipients:
             notification_controller.push(user_id, "announcement", title, body)
                   │
                   ├─ INSERT Notification row (so offline users see it later)
                   └─ manager.notify_user(user_id, payload)
                          │
                          └─ IF user has open WebSocket connection:
                                 send JSON payload over WebSocket
                             ELSE:
                                 silently skip (DB row already saved)
      │
      ▼
Returns AnnouncementOut { ..., recipient_count: N }
      │
      ▼
[Frontend]
  - Prepends new item to past-announcements list
  - Shows "Sent to N members" success message
  - Clears the form
```

---

### Flow 2 — User receives a real-time notification

```
[User's browser]
      │
      │  On dashboard load: opens WebSocket
      │  ws://localhost:8000/ws/notifications/{user_id}?token=<jwt>
      ▼
[ws_routes — websocket_endpoint]
      │  Validates JWT, registers connection in manager.user_rooms[user_id]
      │  Keeps socket alive (ping loop)
      ▼
      … (announcement is published by admin — see Flow 1) …
      │
      ▼
[manager.notify_user(user_id, payload)]
      │  Finds all WebSocket connections for this user_id
      │  Sends JSON over each socket
      ▼
[DashboardLayout — useNotifications hook]
      │  Receives WebSocket message
      │  Prepends new notification to local state
      │  unreadCount increments → badge appears on bell icon
      ▼
[User clicks bell icon]
      │
      ▼
[NotificationPanel — via ReactDOM.createPortal]
      │  Renders at document.body level (z-index: 9999)
      │  Positioned above bell button using getBoundingClientRect()
      ▼
      Announcement shown with orange megaphone icon
```

---

### Flow 3 — User browses past announcements

```
[Student or Professor]
      │
      │  Has university_id set on their account
      │  → "Announcements" nav item is visible in sidebar
      │
      ▼
Clicks "Announcements"
      │
      ▼
[AnnouncementsSection mounts]
      │
      │  getMyAnnouncements(token)
      │  GET /api/announcements/my
      │  Authorization: Bearer <jwt>
      ▼
[announcement_routes — get_my_announcements]
      │  Reads university_id from JWT
      │  SELECT * FROM announcements WHERE university_id = ? ORDER BY created_at DESC
      ▼
Returns list of AnnouncementOut[]
      │
      ▼
[AnnouncementsSection renders list]
  - University name shown as subtitle
  - Each card: orange icon + title + body + date
  - Empty state if no announcements yet
```

---

## 7. API Reference

### POST `/api/announcements`

| Property | Value |
|----------|-------|
| Auth | `university_admin` only |
| Content-Type | `application/json` |

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Announcement title |
| `body` | string | yes | Full content |

**Success response `200`:**

```json
{
  "id": "uuid",
  "university_id": "uuid",
  "created_by": "uuid",
  "title": "Event on 201",
  "body": "Hello everyone",
  "recipient_count": 42,
  "created_at": "2026-04-24T14:30:00"
}
```

**Error responses:**

| Code | Condition |
|------|-----------|
| 400 | Admin has no `university_id` in their JWT |
| 403 | Caller is not a `university_admin` |
| 401 | Invalid or missing token |

---

### GET `/api/announcements`

| Property | Value |
|----------|-------|
| Auth | `university_admin` only |

Returns all announcements for the admin's university, newest first. Same shape as POST response, `recipient_count` = live member count.

---

### GET `/api/announcements/my`

| Property | Value |
|----------|-------|
| Auth | Any authenticated user |

Returns announcements for the user's university (from JWT `university_id`). Returns `[]` if no university is assigned. `recipient_count` is always `0` in this response.

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/announcement.py` | **Created** | SQLModel table definition for announcements |
| `backend/app/routes/announcement_routes.py` | **Created** | POST, GET, GET /my endpoints |
| `backend/app/main.py` | **Modified** | Import model + router, add startup migration |
| `frontend/src/api/admin.ts` | **Modified** | `AnnouncementOut` type, `listAnnouncements`, `createAnnouncement`, `getMyAnnouncements` |
| `frontend/src/pages/AdminDashboard.tsx` | **Modified** | Remove course access for univ. admin, add megaphone nav item + `AnnouncementsPanel` |
| `frontend/src/pages/StudentDashboard.tsx` | **Modified** | Import, conditional nav item, `AnnouncementsSection` component |
| `frontend/src/pages/ProfessorDashboard.tsx` | **Modified** | Same as StudentDashboard |
| `frontend/src/components/DashboardLayout.tsx` | **Modified** | Portal-based notification panel, announcement icon/color, full panel redesign |

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|------|---------------|
| Only `university_admin` can create announcements | `require_role("university_admin")` in route dependency |
| Admin must be assigned to a university to post | `if not actor.get("university_id"): raise HTTPException(400)` in route handler |
| Fan-out targets only users in the same university | `WHERE university_id = actor.university_id` query |
| Students/professors only see their own university's announcements | JWT `university_id` used as filter in `/my` endpoint |
| "Announcements" nav item hidden if user has no university | `user?.university_id` check in component before building nav array |
| University admins cannot see or control any courses | `university_admin` removed from `NAV_ALLOW['courses']`, route guarded with `role !== 'university_admin'` |
| Notification panel always renders above page content | `createPortal(…, document.body)` with `z-index: 9999` and `position: fixed` |
| Closing panel on outside click works with portal | `element.closest('[data-notif-panel]')` check in `mousedown` handler |

---

*Document generated for PFE project Hub4Learners — April 2026*

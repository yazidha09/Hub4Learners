# Notification System — Full Rework
### Persistent, real-time, per-user notifications with DB storage, WebSocket delivery, and full CRUD management

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Model](#3-database-model)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Schema](#41-schema)
   - 4.2 [Controller](#42-controller)
   - 4.3 [Routes](#43-routes)
   - 4.4 [main.py Changes](#44-mainpy-changes)
   - 4.5 [Trigger Points in Existing Routes](#45-trigger-points-in-existing-routes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [API Client](#51-api-client)
   - 5.2 [useNotifications Hook](#52-usenotifications-hook)
   - 5.3 [DashboardLayout — Notification Panel](#53-dashboardlayout--notification-panel)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)
10. [Notification Types Reference](#10-notification-types-reference)

---

## 1. Overview

### Problem with the old system

The previous notification system was **stateless and ephemeral**:

- Notifications were pushed directly via WebSocket and never stored in the database.
- Any notification sent while the user was offline was **permanently lost**.
- Closing the browser tab wiped the entire notification history.
- Read/unread state existed only in React component memory — a page refresh reset it.
- No way to dismiss individual notifications persistently.
- Only 5 notification types, covering friend and chat events only.

### What the rework delivers

| Capability | Before | After |
|---|---|---|
| **Persistence** | None — memory only | PostgreSQL `notifications` table |
| **Offline delivery** | Lost permanently | Fetched from DB on next login |
| **Read state** | Resets on refresh | Persisted in DB (`is_read` column) |
| **Mark individual as read** | Not possible | Click notification row |
| **Mark all as read** | Memory only | Synced to DB |
| **Dismiss notification** | Memory only | Deleted from DB |
| **Clear all** | Not available | `DELETE /notifications/clear-all` |
| **Notification types** | 5 | 7 |
| **Enrollment events** | Not covered | Professor notified on student enroll |
| **Role change events** | Not covered | User notified when admin changes role |

### Technologies involved

| Layer | Technology | Purpose |
|---|---|---|
| Database | PostgreSQL (Neon cloud) | Persistent notification storage |
| ORM | SQLModel + SQLAlchemy | Model definition and queries |
| Real-time | FastAPI WebSocket | Instant push to online users |
| Backend | FastAPI | REST endpoints for CRUD |
| Frontend state | React `useState` + `useRef` | Local notification list |
| Frontend API | `fetch` | Load from DB, mark read, delete |
| Frontend WS | Browser WebSocket API | Receive live notifications |

---

## 2. Architecture

### End-to-end flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         TRIGGER EVENT                                │
│  (friend request, message, enrollment, role change, chat request)    │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    FastAPI Route Handler                             │
│  friend_routes / chat_routes / course_routes / admin_routes          │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│              notification_controller.push()                          │
│                                                                      │
│  1. INSERT INTO notifications (user_id, type, title, body, meta)     │
│  2. db.commit() + db.refresh()                                       │
│  3. await manager.notify_user(user_id, payload)  ← best-effort WS   │
└──────────┬──────────────────────────────────────────┬───────────────┘
           │                                          │
           ▼                                          ▼
  ┌─────────────────┐                     ┌───────────────────────────┐
  │   PostgreSQL    │                     │  WebSocket (if connected) │
  │  notifications  │                     │  ws.onmessage → prepend   │
  │     table       │                     │  to React state           │
  └─────────────────┘                     └───────────────────────────┘
           │
           │  On page load / login
           ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  GET /api/notifications  →  fetch last 100 notifications        │
  │  setNotifications(data.map(fromData))                           │
  │  Full history including what was missed while offline           │
  └─────────────────────────────────────────────────────────────────┘
```

### File tree — new and changed files

```
Hub4Learners/
├── backend/
│   └── app/
│       ├── models/
│       │   └── notification.py          ← NEW
│       ├── schemas/
│       │   └── notification.py          ← NEW
│       ├── controller/
│       │   └── notification_controller.py  ← NEW
│       ├── routes/
│       │   ├── notification_routes.py   ← NEW
│       │   ├── friend_routes.py         ← MODIFIED
│       │   ├── chat_routes.py           ← MODIFIED
│       │   ├── course_routes.py         ← MODIFIED
│       │   └── admin_routes.py          ← MODIFIED
│       └── main.py                      ← MODIFIED
│
└── frontend/
    └── src/
        ├── api/
        │   └── notifications.ts         ← NEW
        ├── hooks/
        │   └── useNotifications.ts      ← REWRITTEN
        └── components/
            └── DashboardLayout.tsx      ← MODIFIED
```

---

## 3. Database Model

### `notifications` table

```python
# backend/app/models/notification.py

class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id:         UUID          # PK, auto-generated uuid4
    user_id:    UUID          # FK → users.id ON DELETE CASCADE, indexed
    type:       str           # VARCHAR(50) — see notification types
    title:      str           # VARCHAR(255) — short heading
    body:       str           # TEXT — full message
    meta:       Optional[Any] # JSONB — contextual data (IDs, action, etc.)
    is_read:    bool          # BOOLEAN DEFAULT false
    created_at: datetime      # TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Full field reference

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | No | `uuid4()` | Primary key |
| `user_id` | UUID | No | — | FK to `users(id)`, indexed |
| `type` | VARCHAR(50) | No | — | Notification type string |
| `title` | VARCHAR(255) | No | — | Short display heading |
| `body` | TEXT | No | — | Full notification message |
| `meta` | JSONB | Yes | NULL | Contextual payload (e.g. `friendship_id`) |
| `is_read` | BOOLEAN | No | `false` | Updated via REST endpoints |
| `created_at` | TIMESTAMP | No | `CURRENT_TIMESTAMP` | Set by DB server |

### Indexes

```sql
CREATE INDEX ix_notifications_user_id   ON notifications(user_id);
CREATE INDEX ix_notifications_user_read ON notifications(user_id, is_read);
```

The composite index on `(user_id, is_read)` makes the `mark_all_read` update and unread-count queries efficient.

---

## 4. Backend Implementation

### 4.1 Schema

**`backend/app/schemas/notification.py`**

```python
class NotificationOut(BaseModel):
    id:         UUID
    type:       str
    title:      str
    body:       str
    meta:       Optional[Any] = None
    is_read:    bool
    created_at: datetime

    class Config:
        from_attributes = True
```

This schema is used as the response model for `GET /api/notifications`. The `meta` field passes through the JSONB dict directly — no manual JSON parsing needed because SQLAlchemy's `JSON` column type returns a Python `dict`.

---

### 4.2 Controller

**`backend/app/controller/notification_controller.py`**

The controller is the single entry point for all notification creation. Every route that wants to notify a user calls `notification_controller.push()` — no route touches `manager.notify_user()` directly anymore.

#### `push()` — create + deliver

```python
async def push(
    user_id: str,
    type: str,
    title: str,
    body: str,
    db: Session,
    meta: Optional[dict] = None,
) -> Notification:
```

Steps:
1. Create a `Notification` ORM object.
2. `db.add()` → `db.commit()` → `db.refresh()` to get the DB-generated `id` and `created_at`.
3. Call `await manager.notify_user(user_id, payload)` — pushes a JSON payload over the WebSocket if the user has an active connection. If they're offline this silently no-ops; they'll receive the notification on next login via the REST fetch.

The WS payload mirrors `NotificationOut`:
```json
{
  "id": "uuid",
  "type": "friend_request",
  "title": "Friend Request",
  "body": "Ahmed sent you a friend request",
  "meta": { "friendship_id": "uuid" },
  "is_read": false,
  "created_at": "2026-04-21T10:00:00"
}
```

#### `get_notifications()` — list

```python
def get_notifications(user_id: str, db: Session) -> list[Notification]:
```

Returns the 100 most recent notifications for a user, ordered `created_at DESC`. This is called on page load to restore full notification history including missed offline notifications.

#### `mark_one_read()` — mark single

```python
def mark_one_read(user_id: str, notif_id: str, db: Session) -> bool:
```

Finds the notification by `id` AND `user_id` (prevents users reading others' notifications), flips `is_read = True`, commits. Returns `False` if not found.

#### `mark_all_read()` — bulk update

```python
def mark_all_read(user_id: str, db: Session) -> int:
```

Bulk-updates all unread notifications for the user in a single SQL `UPDATE`. Returns the number of rows updated.

#### `delete_notification()` — remove single

```python
def delete_notification(user_id: str, notif_id: str, db: Session) -> bool:
```

Deletes by `id` AND `user_id`. Returns `False` if not found.

#### `delete_all_notifications()` — clear all

```python
def delete_all_notifications(user_id: str, db: Session) -> int:
```

Removes all notifications for a user. Used by the "Clear all" button.

---

### 4.3 Routes

**`backend/app/routes/notification_routes.py`**

All endpoints require a valid JWT (`get_current_user` dependency). The `user_id` is always taken from the token — users can only manage their own notifications.

```
GET    /api/notifications              → list last 100 notifications
PUT    /api/notifications/read-all     → mark all as read
PUT    /api/notifications/{id}/read    → mark one as read
DELETE /api/notifications/clear-all   → delete all
DELETE /api/notifications/{id}        → delete one
```

> **Route ordering note:** `/read-all` and `/clear-all` are declared **before** `/{id}` in the router file. This is required so FastAPI doesn't try to match the literal string `"read-all"` or `"clear-all"` as a UUID parameter.

---

### 4.4 main.py Changes

Three additions to `backend/app/main.py`:

**1. Model import** (forces SQLModel to register the table in metadata):
```python
from app.models.notification import Notification  # noqa: F401
```

**2. Router import and registration:**
```python
from app.routes.notification_routes import router as notification_router
# ...
app.include_router(notification_router, prefix="/api")
```

**3. Migration SQL** (idempotent, runs on every startup):
```sql
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(50) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    body       TEXT NOT NULL,
    meta       JSONB,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_read ON notifications(user_id, is_read);
```

---

### 4.5 Trigger Points in Existing Routes

All existing routes that generate notifications were updated to call `notification_controller.push()` instead of calling `manager.notify_user()` directly. Routes that were previously synchronous (`def`) were promoted to `async def` to support the `await` call.

#### `friend_routes.py`

| Event | Recipient | Type | Body example |
|-------|-----------|------|-------------|
| POST `/api/friends/request` | Requestee | `friend_request` | "Ahmed sent you a friend request" |
| PUT `/api/friends/requests/{id}/review` (accept) | Requester | `friend_request_reviewed` | "Sara accepted your friend request" |
| PUT `/api/friends/requests/{id}/review` (decline) | Requester | `friend_request_reviewed` | "Sara declined your friend request" |
| POST `/api/friends/{id}/messages` (text) | Other party | `friend_message` | "Ahmed: hey how are you doing" |
| POST `/api/friends/{id}/messages/media` | Other party | `friend_message` | "Ahmed sent you a photo" |

#### `chat_routes.py`

| Event | Recipient | Type | Body example |
|-------|-----------|------|-------------|
| POST `/api/chat/request` | Professor | `chat_request` | "Sara wants to chat with you" |
| PUT `/api/chat/requests/{id}/review` (accept) | Student | `chat_request_reviewed` | "Dr. Ahmed accepted your chat request" |
| PUT `/api/chat/requests/{id}/review` (refuse) | Student | `chat_request_reviewed` | "Dr. Ahmed refused your chat request" |

#### `course_routes.py` *(new trigger)*

The `enroll` handler was promoted from `def` to `async def`. After `enroll_student()` returns, it queries the `Course` and `User` models to retrieve the course title and student name, then notifies the professor.

| Event | Recipient | Type | Body example |
|-------|-----------|------|-------------|
| POST `/api/courses/{id}/enroll` | Professor (course owner) | `enrollment` | "Sara enrolled in your course "Python Basics"" |

#### `admin_routes.py` *(new trigger)*

The `change_role` handler was promoted from `def` to `async def`. After `change_user_role()` returns, the target user is notified with a human-readable role label.

| Event | Recipient | Type | Body example |
|-------|-----------|------|-------------|
| PUT `/api/admin/users/{id}/role` | Affected user | `role_changed` | "Your account role has been updated to Professor" |

Role label mapping:
```python
{
    "student":          "Student",
    "professor":        "Professor",
    "university_admin": "University Admin",
    "regional_admin":   "Regional Admin",
    "super_admin":      "Super Admin",
}
```

---

## 5. Frontend Implementation

### 5.1 API Client

**`frontend/src/api/notifications.ts`**

Typed wrapper around the five REST endpoints. Every function takes a JWT `token` string and passes it as `Authorization: Bearer <token>`.

```typescript
export interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  meta?: Record<string, string> | null
  is_read: boolean
  created_at: string  // ISO-8601
}

getNotifications(token)          → NotificationData[]
markAllRead(token)               → void
markOneRead(token, id)           → void
deleteNotification(token, id)    → void
clearAllNotifications(token)     → void
```

All calls are fire-and-forget from the hook's perspective — the local state is updated **optimistically** before the network call resolves, so the UI never waits for the server to update the badge or panel.

---

### 5.2 useNotifications Hook

**`frontend/src/hooks/useNotifications.ts`**

#### Type definitions

```typescript
export type NotificationType =
  | 'friend_request'
  | 'friend_request_reviewed'
  | 'friend_message'
  | 'chat_request'
  | 'chat_request_reviewed'
  | 'enrollment'        // NEW
  | 'role_changed'      // NEW

export interface AppNotification {
  id: string            // DB UUID — stable across refreshes
  type: NotificationType
  title: string
  body: string
  timestamp: string     // ISO-8601, maps from created_at
  read: boolean         // maps from is_read
  meta?: Record<string, string> | null
}
```

#### `fromData()` converter

Maps a `NotificationData` (API shape) to an `AppNotification` (UI shape):

```typescript
function fromData(d: NotificationData): AppNotification {
  return {
    id:        d.id,
    type:      d.type as NotificationType,
    title:     d.title,
    body:      d.body,
    timestamp: d.created_at,
    read:      d.is_read,
    meta:      d.meta ?? undefined,
  }
}
```

#### Initial DB fetch (Effect 1)

Runs once when `userId` and `token` are available (i.e., right after login / page load):

```typescript
useEffect(() => {
  if (!userId || !token) return
  getNotifications(token)
    .then(data => setNotifications(data.map(fromData)))
    .catch(() => {})
}, [userId, token])
```

This restores the full notification history — including any notifications received while offline.

#### WebSocket listener (Effect 2)

Connects to `ws://localhost:8000/ws/notifications/{userId}?token={token}` with auto-reconnect (3 s delay on close):

```
ws.onmessage → parse JSON → fromData() → prepend to state (max 100)
              → dedup check: skip if id already exists in list
```

The dedup guard (`prev.some(n => n.id === notif.id)`) prevents a notification from appearing twice if a user opens the app while already connected.

#### Returned API

```typescript
{
  notifications: AppNotification[]  // ordered newest first
  unreadCount:   number             // derived, re-computed on every render
  markAllRead:   () => Promise<void>
  markOneRead:   (id: string) => Promise<void>
  dismiss:       (id: string) => Promise<void>
  clearAll:      () => Promise<void>
}
```

All four mutation functions follow the same optimistic pattern:

1. **Update local state immediately** (no flicker, no spinner).
2. **Fire the API call** in the background.
3. On error: the call silently fails — the state and DB may temporarily diverge, but on the next page load the DB is truth.

---

### 5.3 DashboardLayout — Notification Panel

**`frontend/src/components/DashboardLayout.tsx`**

#### New notification type icons and colors

| Type | Icon | Color class |
|------|------|-------------|
| `friend_request` | Person + plus | `bg-blue-100 text-blue-600` |
| `friend_request_reviewed` | Person + checkmark | `bg-emerald-100 text-emerald-600` |
| `friend_message` | Chat bubble | `bg-violet-100 text-violet-600` |
| `chat_request` | Chat bubble | `bg-amber-100 text-amber-600` |
| `chat_request_reviewed` | Chat bubble | `bg-sky-100 text-sky-600` |
| `enrollment` | Graduation cap | `bg-teal-100 text-teal-600` |
| `role_changed` | Person + checkmark | `bg-purple-100 text-purple-600` |

Unknown types fall back to a generic info-circle icon with `bg-slate-100 text-slate-500`.

#### NotificationPanel — updated props

```typescript
<NotificationPanel
  notifications={notifications}
  onDismiss={dismiss}           // deletes from DB + removes from state
  onMarkOneRead={markOneRead}   // marks read in DB + updates state
  onClearAll={() => { clearAll(); setNotifOpen(false) }}
  onClose={() => setNotifOpen(false)}
/>
```

#### UI mockup

```
┌──────────────────────────────────────┐
│ Notifications          [Clear all] × │  ← header
├──────────────────────────────────────┤
│ ┌──┐  Friend Request            ●   │  ← unread (blue tint bg)
│ │👤+│  Ahmed sent you a friend…      │     ● = orange dot = unread
│ └──┘  just now               [×]   │     [×] = dismiss (hover only)
├──────────────────────────────────────┤
│ ┌──┐  New Enrollment               │  ← read (white bg)
│ │🎓│  Sara enrolled in "Python…"    │
│ └──┘  2h ago                 [×]   │
├──────────────────────────────────────┤
│ ┌──┐  Role Updated                 │
│ │👤✓│  Your account role has been… │
│ └──┘  1d ago                 [×]   │
└──────────────────────────────────────┘
        max-height: 360px, scrollable
```

#### Behavior details

- **Clicking a notification row** calls `onMarkOneRead(n.id)` if `!n.read` — the blue tint and orange dot disappear immediately.
- **Dismiss button (×)** is hidden by default and revealed on `group-hover`. It calls `onDismiss(n.id)` with `e.stopPropagation()` to prevent the row click from also firing mark-as-read.
- **"Clear all" button** only renders when `notifications.length > 0`. It deletes everything from DB and closes the panel.
- **Opening the bell** still calls `markAllRead()` — this syncs the DB even if the user doesn't click individual notifications.
- **Bell badge** shows the unread count (red pill, `9+` for ≥ 10).

---

## 6. Complete Flow Diagrams

### Flow A — Friend request notification (online recipient)

```
Student A (browser)          FastAPI                    Student B (browser)
     │                          │                              │
     │  POST /api/friends/request                              │
     │─────────────────────────►│                              │
     │                          │ send_friend_request()         │
     │                          │ notification_controller.push()│
     │                          │  ├─ INSERT notifications      │
     │                          │  └─ manager.notify_user(B_id)│
     │                          │──────────────────────────────►│ ws.onmessage
     │  201 FriendRequestOut    │                               │ prepend to state
     │◄─────────────────────────│                               │ badge = 1
```

### Flow B — Friend request notification (offline recipient)

```
Student A (browser)          FastAPI                PostgreSQL
     │                          │                       │
     │  POST /api/friends/request                       │
     │─────────────────────────►│                       │
     │                          │ notification_controller.push()
     │                          │  ├─ INSERT notifications ──►│
     │                          │  └─ notify_user(B) → no WS connection, silent
     │  201 FriendRequestOut    │
     │◄─────────────────────────│

     [later — Student B opens the app]

Student B (browser)          FastAPI                PostgreSQL
     │                          │                       │
     │  GET /api/notifications  │                       │
     │─────────────────────────►│  SELECT * WHERE user_id=B  ORDER BY created_at DESC
     │                          │────────────────────────────────────────────────►│
     │  [notification list]     │◄───────────────────────────────────────────────│
     │◄─────────────────────────│
     │ setNotifications(data)   │
     │ badge = 1                │
```

### Flow C — Mark as read (single notification)

```
User (browser)               Frontend hook              FastAPI / DB
     │                           │                           │
     │  clicks notification row  │                           │
     │──────────────────────────►│ setNotifications(         │
     │  badge drops              │   prev.map(n =>           │
     │  blue tint removed        │     n.id===id             │
     │                           │     ? {...n, read:true}   │
     │                           │     : n)                  │
     │                           │ )                         │
     │                           │  PUT /api/notifications/{id}/read
     │                           │──────────────────────────►│
     │                           │                           │ UPDATE is_read=true
     │                           │  { ok: true }             │
     │                           │◄──────────────────────────│
```

### Flow D — Course enrollment notification

```
Student (browser)        FastAPI course_routes          FastAPI / DB       Professor (browser)
     │                          │                            │                    │
     │ POST /api/courses/{id}/enroll                         │                    │
     │─────────────────────────►│                            │                    │
     │                          │ enroll_student()           │                    │
     │                          │ query Course, query User   │                    │
     │                          │ notification_controller.push(professor_id, ...) │
     │                          │  ├─ INSERT notifications ─►│                    │
     │                          │  └─ notify_user ──────────────────────────────►│
     │  201 EnrollmentOut       │                            │             ws.onmessage
     │◄─────────────────────────│                            │             badge = 1
```

### Flow E — Role change notification

```
Admin (browser)          FastAPI admin_routes           FastAPI / DB       Target User (browser)
     │                          │                            │                    │
     │ PUT /api/admin/users/{id}/role                        │                    │
     │─────────────────────────►│                            │                    │
     │                          │ change_user_role()         │                    │
     │                          │ notification_controller.push(user_id, ...) ─────│
     │                          │  ├─ INSERT notifications ─►│                    │
     │                          │  └─ notify_user ──────────────────────────────►│
     │  updated user object     │                            │             ws.onmessage
     │◄─────────────────────────│                            │             "Your role was updated"
```

### Flow F — Clear all

```
User (browser)               Frontend hook              FastAPI / DB
     │                           │                           │
     │  clicks "Clear all"       │                           │
     │──────────────────────────►│ setNotifications([])      │
     │  panel closes             │ badge = 0                 │
     │                           │  DELETE /api/notifications/clear-all
     │                           │──────────────────────────►│
     │                           │                           │ DELETE WHERE user_id = ?
     │                           │  { deleted: N }           │
     │                           │◄──────────────────────────│
```

---

## 7. API Reference

### GET `/api/notifications`

Returns the authenticated user's 100 most recent notifications, ordered newest first.

**Auth:** Bearer token required.

**Response `200`:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "type": "friend_request",
    "title": "Friend Request",
    "body": "Ahmed sent you a friend request",
    "meta": { "friendship_id": "uuid" },
    "is_read": false,
    "created_at": "2026-04-21T10:05:00"
  }
]
```

---

### PUT `/api/notifications/read-all`

Marks all of the user's unread notifications as read in a single bulk update.

**Auth:** Bearer token required.

**Response `200`:**
```json
{ "updated": 4 }
```

---

### PUT `/api/notifications/{notif_id}/read`

Marks a single notification as read. Only works on notifications belonging to the authenticated user.

**Auth:** Bearer token required.

| Path param | Type | Description |
|---|---|---|
| `notif_id` | UUID string | The notification's `id` |

**Response `200`:**
```json
{ "ok": true }
```

**Response `404`:**
```json
{ "detail": "Notification not found" }
```

---

### DELETE `/api/notifications/clear-all`

Permanently deletes all notifications for the authenticated user.

**Auth:** Bearer token required.

**Response `200`:**
```json
{ "deleted": 12 }
```

---

### DELETE `/api/notifications/{notif_id}`

Permanently deletes a single notification. Only works on notifications belonging to the authenticated user.

**Auth:** Bearer token required.

| Path param | Type | Description |
|---|---|---|
| `notif_id` | UUID string | The notification's `id` |

**Response `200`:**
```json
{ "ok": true }
```

**Response `404`:**
```json
{ "detail": "Notification not found" }
```

---

### WebSocket `/ws/notifications/{user_id}?token=<JWT>`

Persistent connection for real-time delivery. A message is pushed whenever `notification_controller.push()` is called for this `user_id`.

**Auth:** JWT passed as query param `token`. Connection is closed with code `1008` on invalid token or if `payload.sub ≠ user_id`.

**Message format (server → client):**
```json
{
  "id": "uuid",
  "type": "enrollment",
  "title": "New Enrollment",
  "body": "Sara enrolled in your course \"Python Basics\"",
  "meta": { "course_id": "uuid", "student_id": "uuid" },
  "is_read": false,
  "created_at": "2026-04-21T10:00:00"
}
```

The `id` field is the DB primary key, so if the client already has this notification from the initial REST fetch (race condition), it can deduplicate by `id`.

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/notification.py` | **Created** | SQLModel table class for `notifications` |
| `backend/app/schemas/notification.py` | **Created** | `NotificationOut` Pydantic response model |
| `backend/app/controller/notification_controller.py` | **Created** | Central `push()` + all DB operations |
| `backend/app/routes/notification_routes.py` | **Created** | REST CRUD endpoints for notifications |
| `backend/app/main.py` | **Modified** | Import model + router, migration SQL |
| `backend/app/routes/friend_routes.py` | **Modified** | Use `notification_controller.push()` |
| `backend/app/routes/chat_routes.py` | **Modified** | Use `notification_controller.push()` |
| `backend/app/routes/course_routes.py` | **Modified** | `enroll` → async, notify professor |
| `backend/app/routes/admin_routes.py` | **Modified** | `change_role` → async, notify user |
| `frontend/src/api/notifications.ts` | **Created** | Typed fetch wrappers for all 5 REST endpoints |
| `frontend/src/hooks/useNotifications.ts` | **Rewritten** | DB fetch on mount + WS + full CRUD exposed |
| `frontend/src/components/DashboardLayout.tsx` | **Modified** | New types, mark-one-read, clear-all, panel UI improvements |

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|------|---------------|
| A user can only read/delete their own notifications | `notification_controller`: queries filter by both `notif_id` AND `user_id` |
| Routes return `404` if notification not found or belongs to another user | `notification_routes.py`: checks `bool` return from controller |
| WS connection is rejected if token is invalid or `sub ≠ user_id` | `ws_routes.py`: JWT decode + sub check before `manager.user_rooms` append |
| Offline notifications are not lost | Controller saves to DB before pushing WS; REST fetch restores them |
| Max 100 notifications loaded per request | Controller: `.limit(100)` on SELECT |
| Max 100 notifications kept in React state | Hook: `.slice(0, 100)` on WS prepend |
| Duplicate WS notifications are ignored | Hook: `prev.some(n => n.id === notif.id)` guard |
| `clear-all` route is declared before `/{id}` route | `notification_routes.py`: route ordering prevents "clear-all" being matched as a UUID |
| Role labels are human-readable | `admin_routes.py`: `role_labels` dict maps internal role strings to display names |
| Professor's own enrollment in own course cannot trigger notification | `course_controller.enroll_student()` already raises `400` before the route's notification code runs |

---

## 10. Notification Types Reference

| Type | Trigger endpoint | Sender role | Recipient | `meta` keys |
|------|-----------------|-------------|-----------|-------------|
| `friend_request` | `POST /api/friends/request` | Any | Requestee | `friendship_id` |
| `friend_request_reviewed` | `PUT /api/friends/requests/{id}/review` | Any | Requester | `friendship_id`, `action` |
| `friend_message` | `POST /api/friends/{id}/messages` | Any | Other party | `friendship_id` |
| `friend_message` | `POST /api/friends/{id}/messages/media` | Any | Other party | `friendship_id` |
| `chat_request` | `POST /api/chat/request` | Student | Professor | `request_id` |
| `chat_request_reviewed` | `PUT /api/chat/requests/{id}/review` | Professor | Student | `request_id`, `action` |
| `enrollment` | `POST /api/courses/{id}/enroll` | Student | Professor (course owner) | `course_id`, `student_id` |
| `role_changed` | `PUT /api/admin/users/{id}/role` | Admin | Target user | `new_role` |

---

*Document generated for PFE project Hub4Learners — April 2026*

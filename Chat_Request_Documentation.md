# Hub4Learners — Chat Documentation

## PFE Project — Student–Professor Chat Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Models](#3-database-models)
   - 3.1 [ChatRequest Table](#31-chatrequest-table)
   - 3.2 [Message Table](#32-message-table)
   - 3.3 [User Table — auto_refuse_chat field](#33-user-table--auto_refuse_chat-field)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Schemas (Pydantic Models)](#41-schemas-pydantic-models)
   - 4.2 [Controller (Business Logic)](#42-controller-business-logic)
   - 4.3 [Routes (API Endpoints)](#43-routes-api-endpoints)
   - 4.4 [App Entry Point Changes](#44-app-entry-point-changes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [API Service](#51-api-service)
   - 5.2 [Student Dashboard — Chat Request Button](#52-student-dashboard--chat-request-button)
   - 5.3 [Student Dashboard — Chat Requests Tab](#53-student-dashboard--chat-requests-tab)
   - 5.4 [Professor Dashboard — Incoming Requests Tab](#54-professor-dashboard--incoming-requests-tab)
   - 5.5 [ChatRoom Component](#55-chatroom-component)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

This document describes the full **Chat** system for the Hub4Learners platform — from initial request through real-time back-and-forth messaging to professor-controlled room closure.

### The Problem

Students who have questions need a way to reach their professor directly through the platform. Professors need control over who can contact them, and the ability to close a conversation when it is finished.

### The Solution

A two-phase workflow:

**Phase 1 — Request**
1. A student clicks **"Chat with Professor"** on any course detail page and optionally writes an intro message.
2. The request appears in the professor's **"Chat Requests"** tab.
3. The professor **Accepts** or **Refuses** individually.
4. Professors can also enable **Auto-refuse**, which immediately refuses all new requests without manual review.

**Phase 2 — Messaging**
5. Once accepted, both sides see an **"Open Chat"** button that opens a full messenger view.
6. Messages are sent back and forth in real time (3-second polling).
7. Messages from the current user appear on the right (dark), the other person on the left (light).
8. The professor can **Close the room** at any time, making the conversation read-only for both sides.
9. Both sides can still **view the history** of a closed chat via "View Chat".

### Technologies Used

| Layer    | Technology                                          |
|----------|-----------------------------------------------------|
| Backend  | FastAPI (Python)                                    |
| Database | PostgreSQL (Neon cloud) — 2 new tables, 1 new column|
| ORM      | SQLModel + SQLAlchemy                               |
| Auth     | JWT — `get_current_user` / `require_role()`         |
| Frontend | React 19 + TypeScript                               |
| Realtime | HTTP polling every 3 seconds (setInterval)          |
| Styling  | Tailwind CSS                                        |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                           │
│                                                                      │
│  StudentDashboard                                                    │
│    Course detail → RequestChatInline                                 │
│      → POST /api/chat/request                                        │
│    "Chat Requests" tab → ChatRequestsSection                         │
│      → GET  /api/chat/my-requests                                    │
│      → [accepted/closed] → ChatRoom component                        │
│           → GET  /api/chat/requests/{id}/messages  (polls 3s)        │
│           → POST /api/chat/requests/{id}/messages                    │
│                                                                      │
│  ProfessorDashboard                                                  │
│    "Chat Requests" tab → IncomingChatRequestsSection                 │
│      → GET  /api/chat/incoming                                       │
│      → PUT  /api/chat/requests/{id}/review                           │
│      → GET/PUT /api/chat/auto-refuse                                 │
│      → [accepted/closed] → ChatRoom component                        │
│           → GET  /api/chat/requests/{id}/messages  (polls 3s)        │
│           → POST /api/chat/requests/{id}/messages                    │
│           → PUT  /api/chat/requests/{id}/close  (professor only)     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP (JSON + Bearer Token)
┌──────────────────────────────▼───────────────────────────────────────┐
│                           BACKEND (FastAPI)                          │
│                                                                      │
│  chat_routes.py  →  chat_controller.py                               │
│    ├── chat_requests table  (request lifecycle)                      │
│    └── messages table       (conversation history)                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Backend Layer Structure

```
backend/app/
├── main.py                          # MODIFIED — imports Message, migration
├── models/
│   ├── user.py                      # MODIFIED — auto_refuse_chat field
│   ├── chat_request.py              # NEW — ChatRequest table
│   └── message.py                   # NEW — Message table
├── schemas/
│   └── chat.py                      # NEW — all chat schemas
├── controller/
│   └── chat_controller.py           # NEW — all business logic
└── routes/
    └── chat_routes.py               # NEW — 9 API endpoints
```

### Frontend Layer Structure

```
frontend/src/
├── api/
│   └── chat.ts                      # NEW — typed API client
├── components/
│   └── ChatRoom.tsx                 # NEW — full messenger component
├── pages/
│   ├── StudentDashboard.tsx         # MODIFIED
│   └── ProfessorDashboard.tsx       # MODIFIED
```

---

## 3. Database Models

### 3.1 ChatRequest Table

**File:** `backend/app/models/chat_request.py` *(new)*

```python
class ChatRequest(SQLModel, table=True):
    __tablename__ = "chat_requests"

    id: UUID                          # Primary key
    student_id: UUID                  # FK → users
    professor_id: UUID                # FK → users
    message: Optional[str]            # Optional intro message from student
    status: str                       # "pending" | "accepted" | "refused" | "closed"
    created_at: datetime
    reviewed_at: Optional[datetime]   # Set when professor acts on the request
```

**Full status lifecycle:**

```
[student sends]
      │
      ▼
  professor.auto_refuse_chat?
      ├── YES → "refused"  (reviewed_at = now)
      └── NO  → "pending"
                    │
                    ├── Professor refuses → "refused"
                    │
                    └── Professor accepts → "accepted"
                                               │
                                    Both sides can send messages
                                               │
                                    Professor closes → "closed"
                                    (read-only history for both)
```

---

### 3.2 Message Table

**File:** `backend/app/models/message.py` *(new)*

```python
class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: UUID                          # Primary key
    chat_request_id: UUID             # FK → chat_requests (indexed)
    sender_id: UUID                   # FK → users (indexed)
    content: str                      # Message text (TEXT column)
    created_at: datetime              # Auto-set by server_default
```

Messages are ordered by `created_at` ascending when fetched, giving a chronological conversation view.

---

### 3.3 User Table — auto_refuse_chat field

**File:** `backend/app/models/user.py` *(modified)*

```python
auto_refuse_chat: bool = Field(
    sa_column=Column(Boolean, nullable=False, server_default='false'),
    default=False
)
```

Added via startup migration: `ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_refuse_chat BOOLEAN NOT NULL DEFAULT FALSE`

---

## 4. Backend Implementation

### 4.1 Schemas (Pydantic Models)

**File:** `backend/app/schemas/chat.py` *(new)*

```python
class ChatRequestOut(BaseModel):
    id, student_id, student_full_name, professor_id, professor_full_name,
    message, status, created_at, reviewed_at

class SendChatRequest(BaseModel):
    professor_id: UUID
    message: Optional[str]

class ReviewChatRequest(BaseModel):
    action: str           # "accept" | "refuse"

class AutoRefuseUpdate(BaseModel):
    auto_refuse: bool

class MessageOut(BaseModel):
    id, chat_request_id, sender_id, sender_full_name, content, created_at

class SendMessage(BaseModel):
    content: str
```

---

### 4.2 Controller (Business Logic)

**File:** `backend/app/controller/chat_controller.py` *(new)*

#### Phase 1 — Request functions

| Function | Description |
|---|---|
| `send_chat_request(student_id, body, db)` | Validates student+professor, checks no pending duplicate, sets status based on `auto_refuse_chat`, inserts row |
| `get_my_requests_as_student(student_id, db)` | Returns all requests for student, newest first |
| `get_incoming_requests(professor_id, db)` | Returns all requests for professor, newest first |
| `review_chat_request(professor_id, request_id, action, db)` | Sets status "accepted"/"refused", sets `reviewed_at`, enforces ownership + pending-only constraint |
| `get_auto_refuse / set_auto_refuse` | Read/write `auto_refuse_chat` on the professor's User row |

#### Phase 2 — Messaging functions

**`send_message(user_id, request_id, content, db)`**
```
1. Load ChatRequest by request_id
2. Verify user is either student_id or professor_id of that request
3. Verify status == "accepted"  ← raises 400 if pending/refused/closed
4. Insert Message row
5. Return MessageOut (with sender_full_name resolved from users)
```

**`get_messages(user_id, request_id, db)`**
```
1. Load ChatRequest
2. Verify participation (same ownership check as send)
3. Return all Message rows ordered by created_at ASC
```

**`close_chat_room(professor_id, request_id, db)`**
```
1. Load ChatRequest
2. Verify req.professor_id == professor_id
3. Verify status == "accepted"
4. Set status = "closed"
5. Commit and return updated ChatRequestOut
```

> **Note:** All `datetime` stamps use `datetime.now(timezone.utc)` (timezone-aware) instead of the deprecated `datetime.utcnow()`.

---

### 4.3 Routes (API Endpoints)

**File:** `backend/app/routes/chat_routes.py` *(new)*

```python
router = APIRouter(prefix="/chat", tags=["Chat Requests"])
```

**Phase 1 — Request endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat/request` | student | Send a chat request |
| GET | `/chat/my-requests` | student | List all sent requests |
| GET | `/chat/incoming` | professor | List all received requests |
| PUT | `/chat/requests/{id}/review` | professor | Accept or refuse a pending request |
| GET | `/chat/auto-refuse` | professor | Get auto-refuse setting |
| PUT | `/chat/auto-refuse` | professor | Update auto-refuse setting |

**Phase 2 — Messaging endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/chat/requests/{id}/messages` | any (participant) | Send a message |
| GET | `/chat/requests/{id}/messages` | any (participant) | Get all messages |
| PUT | `/chat/requests/{id}/close` | professor | Close the chat room |

Message endpoints use `get_current_user` (not `require_role`) so both student and professor can call them. Participation is verified inside the controller.

---

### 4.4 App Entry Point Changes

**File:** `backend/app/main.py` *(modified)*

```python
from app.models.chat_request import ChatRequest  # noqa: F401
from app.models.message import Message           # noqa: F401  ← new
```

Migration (runs at startup, idempotent):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_refuse_chat BOOLEAN NOT NULL DEFAULT FALSE
```

The `messages` table is created automatically by `SQLModel.metadata.create_all(engine)` since `Message` is now imported.

---

## 5. Frontend Implementation

### 5.1 API Service

**File:** `frontend/src/api/chat.ts` *(new)*

```typescript
// Types
export interface ChatRequestOut {
  id, student_id, student_full_name, professor_id, professor_full_name,
  message, status: 'pending'|'accepted'|'refused'|'closed',
  created_at, reviewed_at
}

export interface MessageOut {
  id, chat_request_id, sender_id, sender_full_name, content, created_at
}

// Phase 1 — Request
sendChatRequest(token, professor_id, message?)   → POST /api/chat/request
getMyChatRequests(token)                         → GET  /api/chat/my-requests
getIncomingChatRequests(token)                   → GET  /api/chat/incoming
reviewChatRequest(token, id, action)             → PUT  /api/chat/requests/{id}/review
getAutoRefuse(token)                             → GET  /api/chat/auto-refuse
setAutoRefuse(token, value)                      → PUT  /api/chat/auto-refuse

// Phase 2 — Messaging
sendMessage(token, requestId, content)           → POST /api/chat/requests/{id}/messages
getMessages(token, requestId)                    → GET  /api/chat/requests/{id}/messages
closeChatRoom(token, requestId)                  → PUT  /api/chat/requests/{id}/close
```

---

### 5.2 Student Dashboard — Chat Request Button

**File:** `frontend/src/pages/StudentDashboard.tsx` *(modified)*

`RequestChatInline` is a self-contained component rendered in both **Browse Courses** and **My Courses** detail views. It uses `CourseOut.professor_id` directly.

```
┌─────────────────────────────────────────────────┐
│  Course: Introduction to Machine Learning        │
│  By: Dr. Benali                [Enroll for free] │
│ ─────────────────────────────────────────────── │
│  [💬 Chat with Professor]      ← idle state      │
└─────────────────────────────────────────────────┘

After clicking:
┌─────────────────────────────────────────────────┐
│  💬 Request chat with Dr. Benali                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Add a message (optional)...               │  │
│  └───────────────────────────────────────────┘  │
│  [  Cancel  ]  [  Send Request  ]               │
└─────────────────────────────────────────────────┘

After sending:
┌─────────────────────────────────────────────────┐
│  ✓  Chat request sent to Dr. Benali             │
└─────────────────────────────────────────────────┘
```

---

### 5.3 Student Dashboard — Chat Requests Tab

**File:** `frontend/src/pages/StudentDashboard.tsx` *(modified)*

`ChatRequestsSection` now receives `currentUserId` (from `useAuth().user.id`) and shows an **"Open Chat"** button on accepted/closed requests.

```
┌──────────────────────────────────────────────────────────────────┐
│  Chat Requests                                                   │
│  Track your chat requests to professors                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [D]  Dr. Benali            ● Pending                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [S]  Sarah Chen            ✓ Active    [💬 Open Chat]    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [K]  Prof. Karim           ● Closed    [💬 View Chat]    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

Clicking "Open Chat" / "View Chat" replaces the section with the `ChatRoom` component. The "← back" button in `ChatRoom` returns to the list and refreshes it.

---

### 5.4 Professor Dashboard — Incoming Requests Tab

**File:** `frontend/src/pages/ProfessorDashboard.tsx` *(modified)*

`IncomingChatRequestsSection` now receives `currentUserId` and shows "Open Chat" / "View Chat" on accepted/closed requests in the reviewed section.

```
┌──────────────────────────────────────────────────────────────────┐
│  Chat Requests              ┌──────────────────────────────────┐ │
│  1 pending · 2 reviewed     │ Auto-refuse requests        ● ── │ │
│                             └──────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  PENDING — 1                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [A]  Amine Benali          [  Refuse  ] [  Accept  ]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  REVIEWED — 2                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [Y]  Yasmine Khelif        ✓ Active    [💬 Open Chat]    │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [K]  Karim Mekki           ● Closed    [💬 View Chat]    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

### 5.5 ChatRoom Component

**File:** `frontend/src/components/ChatRoom.tsx` *(new)*

A shared messenger component used by both dashboards.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `token` | string | JWT for API calls |
| `requestId` | string | The chat_request id |
| `currentUserId` | string | The calling user's id (for message alignment) |
| `otherName` | string | Display name of the other party |
| `initialClosed` | boolean | Whether the room is already closed on mount |
| `isProfessor` | boolean | Shows "Close room" button when true |
| `onRoomClosed` | () => void | Callback when professor closes the room |
| `onBack` | () => void | Back button callback |

**Messenger UI layout:**

```
┌──────────────────────────────────────────────────────┐
│ ←  [D] Dr. Benali                  [✕ Close room]   │  ← header
│    🟢 Active                                          │
├──────────────────────────────────────────────────────┤
│                                                      │
│         ────────── Today ──────────                  │
│                                                      │
│  Dr. Benali                                          │
│  ┌──────────────────────────────┐                   │
│  │ Hello! How can I help you?   │  10:30 AM          │
│  └──────────────────────────────┘                   │
│                                                      │
│                                         You          │
│             ┌────────────────────────────────────┐   │
│  10:31 AM   │ I had a question about lecture 3   │   │
│             └────────────────────────────────────┘   │
│                                                      │
├──────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐  [→]  │  ← input
│  │ Type a message…  (Enter to send)         │       │
│  └──────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```

When the room is closed:
```
┌──────────────────────────────────────────────────────┐
│ ←  [D] Dr. Benali                                    │
│    🔴 Chat closed                                     │
├──────────────────────────────────────────────────────┤
│  ⚠  The professor has closed this chat room.         │  ← red banner
├──────────────────────────────────────────────────────┤
│  [message history, read-only]                        │
├──────────────────────────────────────────────────────┤
│  This chat room is closed                            │  ← greyed input
└──────────────────────────────────────────────────────┘
```

**Key implementation details:**

- **Polling:** `setInterval(fetchMessages, 3000)` — cleared on unmount with the `useEffect` cleanup return.
- **Auto-scroll:** `bottomRef.current.scrollIntoView({ behavior: 'smooth' })` runs on every `messages` state update.
- **Message grouping:** Messages are grouped by date (Today / Yesterday / full date) with a visual separator line between groups. Consecutive messages from the same sender skip the name header to reduce clutter.
- **Message alignment:** `sender_id === currentUserId` → right-aligned dark bubble. Otherwise → left-aligned white bubble with border.
- **Send on Enter:** `onKeyDown` intercepts `Enter` (without Shift) to submit. `Shift+Enter` inserts a newline normally.
- **Close confirmation:** Professor sees "Close this chat room?" inline confirm before the actual API call.

---

## 6. Complete Flow Diagrams

### Flow 1: Student Sends a Request (Normal)

```
Student → clicks "Chat with Professor" on course
        → optional message → "Send Request"
        → POST /api/chat/request { professor_id, message }
Backend → professor.auto_refuse_chat == false
        → INSERT chat_requests status="pending"
Student ← sees "✓ Request sent"
Professor ← sees new pending card in "Chat Requests" tab
```

### Flow 2: Auto-Refuse Active

```
Student → POST /api/chat/request
Backend → professor.auto_refuse_chat == true
        → INSERT chat_requests status="refused" reviewed_at=now
Student ← sees "✓ Request sent"  (status in tab shows "Refused")
Professor ← no card appears (was never pending)
```

### Flow 3: Professor Accepts and Both Chat

```
Professor → clicks "Accept" on pending card
          → PUT /api/chat/requests/{id}/review { action: "accept" }
Backend   → status = "accepted", reviewed_at = now

Both sides → see "Open Chat" button appear

Student   → clicks "Open Chat"
          → ChatRoom mounts, GET /api/chat/requests/{id}/messages
          → 3-second poll loop starts

Professor → types message → Enter
          → POST /api/chat/requests/{id}/messages { content: "Hello!" }
Backend   → INSERT into messages

Student   → next poll (≤3s later)
          → GET /api/chat/requests/{id}/messages
          → new message appears on left side

Student   → replies → Enter
          → POST message
Professor → sees it on next poll
```

### Flow 4: Professor Closes the Room

```
Professor → inside ChatRoom, clicks "Close room"
          → inline confirm appears
Professor → clicks "Yes, close"
          → PUT /api/chat/requests/{id}/close
Backend   → status = "closed"
          → returns updated ChatRequestOut

Professor ← ChatRoom shows red "Chat closed" banner
           ← input replaced by "This chat room is closed"
           ← Close button disappears

Student   ← next time they open/refresh Chat Requests
           ← status badge shows "Closed"
           ← "View Chat" button → read-only ChatRoom
```

---

## 7. API Reference

### POST `/api/chat/request`
**Auth:** student · **Body:** `{ professor_id, message? }` · **Returns:** `ChatRequestOut`

| Code | Condition |
|------|-----------|
| 409 | Pending request to this professor already exists |
| 404 | Professor not found |
| 403 | Caller is not a student |

> If `auto_refuse_chat == true` the record is created with `status="refused"` — API still returns 200.

---

### GET `/api/chat/my-requests`
**Auth:** student · **Returns:** `ChatRequestOut[]` (newest first)

---

### GET `/api/chat/incoming`
**Auth:** professor · **Returns:** `ChatRequestOut[]` (newest first)

---

### PUT `/api/chat/requests/{id}/review`
**Auth:** professor · **Body:** `{ action: "accept"|"refuse" }` · **Returns:** updated `ChatRequestOut`

| Code | Condition |
|------|-----------|
| 400 | Already reviewed / invalid action |
| 403 | Not this professor's request |
| 404 | Request not found |

---

### GET `/api/chat/auto-refuse`
**Auth:** professor · **Returns:** `{ auto_refuse: boolean }`

---

### PUT `/api/chat/auto-refuse`
**Auth:** professor · **Body:** `{ auto_refuse: boolean }` · **Returns:** `{ auto_refuse: boolean }`

---

### POST `/api/chat/requests/{id}/messages`
**Auth:** any (participant) · **Body:** `{ content: string }` · **Returns:** `MessageOut`

| Code | Condition |
|------|-----------|
| 400 | Room is not active (pending / refused / closed) |
| 403 | User is not a participant (neither student nor professor of this chat) |
| 404 | Chat room not found |

---

### GET `/api/chat/requests/{id}/messages`
**Auth:** any (participant) · **Returns:** `MessageOut[]` (oldest first)

| Code | Condition |
|------|-----------|
| 403 | User is not a participant |
| 404 | Chat room not found |

---

### PUT `/api/chat/requests/{id}/close`
**Auth:** professor · **Returns:** updated `ChatRequestOut` with `status="closed"`

| Code | Condition |
|------|-----------|
| 400 | Room is not active |
| 403 | Not this professor's room |
| 404 | Chat room not found |

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/chat_request.py` | Created | `ChatRequest` table (request lifecycle) |
| `backend/app/models/message.py` | Created | `Message` table (conversation messages) |
| `backend/app/models/user.py` | Modified | Added `auto_refuse_chat: bool` |
| `backend/app/schemas/chat.py` | Created | All Pydantic schemas: `ChatRequestOut`, `SendChatRequest`, `ReviewChatRequest`, `AutoRefuseUpdate`, `MessageOut`, `SendMessage` |
| `backend/app/controller/chat_controller.py` | Created | All business logic: send request, list, review, auto-refuse, send/get messages, close room |
| `backend/app/routes/chat_routes.py` | Created | 9 API endpoints |
| `backend/app/main.py` | Modified | Import `ChatRequest` + `Message`, register `chat_router`, startup migration |
| `frontend/src/api/chat.ts` | Created | Typed API client (9 functions, 2 interfaces) |
| `frontend/src/components/ChatRoom.tsx` | Created | Full messenger UI: header, message list, date separators, polling, send input, close room |
| `frontend/src/pages/StudentDashboard.tsx` | Modified | Added `ChatIcon`, `chat` nav item, `RequestChatInline`, updated `ChatRequestsSection` with Open Chat |
| `frontend/src/pages/ProfessorDashboard.tsx` | Modified | Added `ChatIcon`, `chat` nav item, updated `IncomingChatRequestsSection` with Open Chat + Close Room |

---

## 9. Business Rules & Validation

| Rule | Where Enforced |
|------|----------------|
| Only students can send chat requests | `chat_controller.py` → role check |
| Only professors can be targeted | `chat_controller.py` → professor filter on DB query |
| Max one pending request per student per professor | `chat_controller.py` → 409 on duplicate pending |
| `auto_refuse_chat` immediately refuses new requests at creation | `chat_controller.py` → initial_status logic |
| `auto_refuse_chat` does NOT affect existing pending requests | By design — only applies at creation time |
| Messages can only be sent when status == "accepted" | `chat_controller.py` → 400 otherwise |
| Only participants (student or professor of the request) can send/read messages | `chat_controller.py` → `_get_chat_request_for_participant()` |
| Only the professor can close a chat room | `chat_routes.py` → `require_role("professor")` + ownership check |
| A room can only be closed if currently "accepted" | `chat_controller.py` → 400 otherwise |
| Once closed, the room is permanently read-only (no re-open) | By design — no "reopen" endpoint exists |
| Both sides can read message history of closed rooms | `get_messages` does not check status, only participation |
| Datetime stamps are timezone-aware UTC | `datetime.now(timezone.utc)` throughout controller |

---

*Document generated for PFE project Hub4Learners — April 2026*

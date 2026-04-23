# Real-Time Loading & Instant Navigation
## Hub4Learners — Performance & UX Upgrade

---

## Table of Contents
1. [Overview](#1-overview)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Architecture](#3-architecture)
4. [Change 1 — WebSocket Chat (Backend)](#4-change-1--websocket-chat-backend)
5. [Change 2 — WebSocket Chat (Frontend)](#5-change-2--websocket-chat-frontend)
6. [Change 3 — Lazy-Mount Dashboard Sections](#6-change-3--lazy-mount-dashboard-sections)
7. [Change 4 — useRefreshOnFocus Hook](#7-change-4--userefreshonfocus-hook)
8. [Complete Flow Diagrams](#8-complete-flow-diagrams)
9. [Files Created / Modified](#9-files-created--modified)
10. [Trade-offs & Limitations](#10-trade-offs--limitations)

---

## 1. Overview

### Problem
Every part of the application "felt slow" to the user:
- **Chat messages** appeared with up to **3-second delay** (HTTP polling every 3 s).
- **Switching dashboard tabs** (e.g., Home → My Courses → Chat) always showed a **loading spinner** even when data was just loaded moments ago, because each tab unmounted and remounted its component.

### Solution
Two independent fixes applied together:

| Symptom | Root cause | Fix |
|---|---|---|
| Chat messages slow to appear | `setInterval(fetch, 3000)` polling | WebSocket push — instant delivery |
| Tab switching shows spinner | Components unmount/remount on nav change | Lazy-mount-with-stay pattern |
| Stale data after coming back to browser tab | No refresh on visibility change | `useRefreshOnFocus` hook |

### Technologies used

| Layer | Technology |
|---|---|
| Backend real-time | FastAPI `WebSocket`, `asyncio.create_task` |
| WS connection tracking | In-memory `ConnectionManager` class |
| Frontend WS | Native browser `WebSocket` API |
| Frontend keep-alive | React `useState<Set>` + CSS `hidden` class |
| Data freshness | Custom `useRefreshOnFocus` hook |

---

## 2. Root Cause Analysis

### Chat latency

```
Before:
  User A sends message
        │
        ▼  HTTP POST /api/chat/requests/{id}/messages  (fast, ~50ms)
        │
  User B's browser polls every 3000ms
        │
  ⏳  User B waits 0–3000ms before seeing the message
        │
  User B's browser: GET /api/chat/requests/{id}/messages
        │
  Message appears

Worst case: 3 seconds gap.
Average case: 1.5 seconds gap.
```

### Dashboard tab switching

```
Before:
  User is on "Chat" tab
        │
  User clicks "My Courses"
        │
  React: nav state = 'my-courses'
        │
  React unmounts <ChatRequestsSection>  ← data lost
  React renders:
    if (nav === 'my-courses') return <DashboardLayout><MyCoursesSection /></DashboardLayout>
        │
  MyCoursesSection mounts fresh → useEffect fires → setLoading(true) → fetch → show spinner
        │
  User sees spinner for 200–500ms even though data was loaded 5 seconds ago

  User clicks back to "Chat"
        │
  React unmounts <MyCoursesSection>  ← data lost again
  React renders: if (nav === 'chat') ...
        │
  ChatRequestsSection mounts fresh → useEffect → spinner again
```

---

## 3. Architecture

### Backend WebSocket Flow

```
Frontend Client A          FastAPI                 Frontend Client B
     │                        │                         │
     │── POST /messages ──────►│                         │
     │                        │── save to DB ───────────►│
     │                        │                         │
     │                        │── ConnectionManager ────►│
     │                        │   .broadcast_chat()      │
     │                        │                         │── ws.onmessage fires instantly
     │◄─── HTTP 200 ──────────│                         │
     │    (msg returned)      │                         │
     │                        │                         │
  Sender sees msg immediately       Receiver sees msg immediately
  (optimistic local append)         (WebSocket push, 0ms delay)
```

### Frontend Lazy-Mount Architecture

```
Before (per-tab unmounting):
  DashboardLayout
  └── if nav==='chat'    → <ChatSection />  (mounts & fetches every visit)
  └── if nav==='courses' → <CoursesSection /> (mounts & fetches every visit)

After (all sections always mounted):
  DashboardLayout
  ├── <div hidden={nav!=='chat'}>
  │   └── {visited.has('chat') && <ChatSection />}    ← mounts once, stays
  ├── <div hidden={nav!=='courses'}>
  │   └── {visited.has('courses') && <CoursesSection />} ← mounts once, stays
  └── <div hidden={nav!=='home'}>
      └── Home content  ← always mounted
```

### File tree of changed files

```
backend/app/
├── websocket_manager.py          ← NEW
├── main.py                       ← MODIFIED (added ws_router)
└── routes/
    ├── ws_routes.py              ← NEW
    ├── chat_routes.py            ← MODIFIED (broadcast on send)
    └── friend_routes.py          ← MODIFIED (broadcast on send)

frontend/src/
├── hooks/
│   └── useRefreshOnFocus.ts      ← NEW
├── components/
│   ├── ChatRoom.tsx              ← MODIFIED (WebSocket)
│   └── FriendChat.tsx            ← MODIFIED (WebSocket)
└── pages/
    ├── StudentDashboard.tsx      ← MODIFIED (lazy-mount)
    └── ProfessorDashboard.tsx    ← MODIFIED (lazy-mount)
```

---

## 4. Change 1 — WebSocket Chat (Backend)

### 4.1 `websocket_manager.py` (new)

A singleton `ConnectionManager` holds two dictionaries:

```python
class ConnectionManager:
    chat_rooms:   dict[str, list[WebSocket]]   # keyed by chat request ID
    friend_rooms: dict[str, list[WebSocket]]   # keyed by friendship ID
```

**Key methods:**

| Method | Description |
|---|---|
| `connect_chat(room_id, ws)` | Accepts WS handshake, appends to room list |
| `disconnect_chat(room_id, ws)` | Removes from list on disconnect |
| `broadcast_chat(room_id, payload)` | Sends JSON to every client in the room; auto-removes dead sockets |
| Same `*_friend` variants | For the friend-chat channel |

The `manager` instance is a module-level singleton — imported wherever broadcast is needed.

### 4.2 `ws_routes.py` (new)

Two WebSocket endpoints:

```
GET /ws/chat/{request_id}?token=<JWT>
GET /ws/friends/{friendship_id}?token=<JWT>
```

**Authentication:** WebSocket connections cannot send an `Authorization` header via the browser's native API, so the JWT is passed as a query parameter `?token=...`. The endpoint decodes and verifies it before accepting the connection. Invalid tokens get `close(code=1008)` (Policy Violation).

**Connection lifecycle:**
```
Client opens WS connection
       │
Validate JWT (reject if invalid)
       │
manager.connect_*(room_id, websocket)
       │
Loop: await websocket.receive_text()   ← keeps socket alive, we never use the data
       │
On disconnect: manager.disconnect_*(room_id, websocket)
```

### 4.3 `chat_routes.py` — broadcast on message send

The `post_message` handler was changed from `def` to `async def`:

```python
@router.post("/requests/{request_id}/messages")
async def post_message(...):
    msg = send_message(...)          # sync DB operation, fine in async context
    asyncio.create_task(             # fire-and-forget broadcast
        manager.broadcast_chat(request_id, {
            "id": str(msg.id),
            "sender_id": str(msg.sender_id),
            "sender_full_name": msg.sender_full_name,
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            ...
        })
    )
    return msg                       # HTTP response returned immediately
```

`asyncio.create_task` schedules the broadcast as a background task. The HTTP response returns to the sender **before** the broadcast completes, so there is zero extra latency for the sender.

### 4.4 `friend_routes.py` — same pattern

Both `post_message` (text) and `post_media` (file upload) were made async and broadcast after saving. The media message includes `media_url`, `media_type`, and `media_name` fields in the broadcast payload so the receiver's UI renders the correct bubble type.

### 4.5 `main.py` — register WS router

```python
from app.routes.ws_routes import router as ws_router
app.include_router(ws_router)   # No /api prefix — WebSocket paths start with /ws
```

The WS router uses no prefix so paths are exactly `/ws/chat/{id}` and `/ws/friends/{id}`.

---

## 5. Change 2 — WebSocket Chat (Frontend)

### `ChatRoom.tsx`

**Before:**
```typescript
useEffect(() => {
  fetchMessages()
  const interval = setInterval(fetchMessages, 3000)   // ← polls every 3s
  return () => clearInterval(interval)
}, [requestId])
```

**After:**
```typescript
useEffect(() => {
  fetchMessages()   // load message history once on mount

  const ws = new WebSocket(
    `ws://localhost:8000/ws/chat/${requestId}?token=${encodeURIComponent(token)}`
  )

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data) as MessageOut
    // Deduplicate: the sender already appended the message optimistically
    setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
  }

  // Graceful fallback: if WS is unavailable, fall back to 3s polling
  let fallbackInterval: ReturnType<typeof setInterval> | null = null
  ws.onerror = () => {
    fallbackInterval = setInterval(fetchMessages, 3000)
  }

  return () => {
    ws.close()
    if (fallbackInterval) clearInterval(fallbackInterval)
  }
}, [requestId])
```

**Deduplication logic:** When the sender sends a message, `handleSend` optimistically appends it to `messages`. The backend then broadcasts the same message over WS, which arrives at the sender too. The `prev.some(m => m.id === msg.id)` check prevents the duplicate from showing.

### `FriendChat.tsx`

Identical pattern, connecting to `/ws/friends/{friendshipId}?token=...` instead.

The `FriendMessageOut` type includes `media_url`, `media_type`, and `media_name` so the WS-received message renders correctly as either an image bubble or a file download link.

---

## 6. Change 3 — Lazy-Mount Dashboard Sections

### The Problem

Each nav tab was a separate early-return branch:
```typescript
if (nav === 'courses') return <DashboardLayout><CoursesSection /></DashboardLayout>
if (nav === 'my-courses') return <DashboardLayout><MyCoursesSection /></DashboardLayout>
// ...
```

React's reconciliation treats each branch as a completely new tree. When `nav` changes, the **previous section is unmounted** (state and data lost), and the **new section is freshly mounted** (fires `useEffect`, shows spinner).

### The Fix — Lazy-Mount With Stay

All sections are rendered inside a **single DashboardLayout** and a **single `return`**. Each section is wrapped in a `<div>` that uses Tailwind's `hidden` class to hide it when inactive.

To avoid fetching all data upfront (which would create 7+ API calls on page load), a `mounted` Set tracks which sections the user has actually visited:

```typescript
const [mounted, setMounted] = useState<Set<string>>(() => new Set(['home']))

useEffect(() => {
  setMounted(prev => {
    if (prev.has(nav)) return prev   // already mounted, no state change
    const next = new Set(prev)
    next.add(nav)
    return next
  })
}, [nav])
```

Each section is gated by `mounted.has(sectionId)`:
```tsx
<div className={nav !== 'my-courses' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
  {mounted.has('my-courses') && <MyCoursesSection token={token!} />}
</div>
```

**Result:**
- **First visit** to a section: mounts the component → API call → spinner (normal)
- **All subsequent visits**: no unmount/remount → no spinner → instant display
- **Initial page load**: only "home" section is mounted → no wasted API calls

### Applied to both dashboards

| Dashboard | Sections with lazy-mount |
|---|---|
| StudentDashboard | courses, my-courses, chat, messages, find-friends |
| ProfessorDashboard | courses, my-learning, my-courses, students, chat, messages, find-friends |

---

## 7. Change 4 — useRefreshOnFocus Hook

### File: `frontend/src/hooks/useRefreshOnFocus.ts`

```typescript
export function useRefreshOnFocus(fn: () => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn   // always points to latest fn, avoids stale closure

  useEffect(() => {
    const handle = () => {
      if (!document.hidden) fnRef.current()
    }
    document.addEventListener('visibilitychange', handle)
    window.addEventListener('focus', handle)
    return () => {
      document.removeEventListener('visibilitychange', handle)
      window.removeEventListener('focus', handle)
    }
  }, [])   // runs once, no deps needed thanks to the ref
}
```

**Use case:** Call this inside any section that needs to stay fresh when the user switches browser tabs or alt-tabs away:

```typescript
function MyCoursesSection({ token }) {
  const load = useCallback(() => { ... }, [token])
  useRefreshOnFocus(load)   // refetch when browser window regains focus
}
```

This handles the scenario where the user leaves the page (to check email, etc.), some data changes on the server, and they return — the data refreshes automatically.

---

## 8. Complete Flow Diagrams

### Chat Message — Before vs After

```
BEFORE (3s polling):
  [Prof types + sends]
        │
        ├── HTTP POST → DB save → 200 OK  (50ms)
        │
  [Student's browser]
        │
  polling timer: ████████████████████  3000ms wait  ████████████████████
        │
  GET /messages → 200  (message appears after 0–3s delay)

─────────────────────────────────────────────────────

AFTER (WebSocket):
  [Prof types + sends]
        │
        ├── HTTP POST → DB save → asyncio.create_task(broadcast)  (50ms)
        │                                    │
        │                              WS broadcast runs
        │                                    │
  [Student's WS socket]               ws.onmessage fires
        │                                    │
  Message appended to state    ←─────────────┘  (< 10ms latency)
  Scrolls to bottom
```

### Dashboard Navigation — Before vs After

```
BEFORE:
  User on "Chat" tab
        │ clicks "My Courses"
        ▼
  React renders: if (nav==='my-courses') return <Layout><MyCoursesSection/></Layout>
        │
  ChatRequestsSection UNMOUNTS ← data lost
  MyCoursesSection MOUNTS FRESH
        │
  useEffect fires → setLoading(true) → fetch() → [spinner 200ms–500ms]
        │
  Data appears

AFTER:
  User on "Chat" tab (ChatSection mounted, data loaded)
        │ clicks "My Courses"
        ▼
  nav state = 'my-courses'
  mounted Set adds 'my-courses' (if not already present)
        │
  CSS: ChatSection's div gets class "hidden"  ← ChatSection STAYS MOUNTED
  CSS: MyCoursesSection's div becomes visible
        │
  If first visit:  MyCoursesSection mounts → fetch → spinner (one-time cost)
  If return visit: Already mounted → data already in state → INSTANT display
```

---

## 9. Files Created / Modified

| File | Action | Purpose |
|---|---|---|
| `backend/app/websocket_manager.py` | Created | Singleton ConnectionManager for WS rooms |
| `backend/app/routes/ws_routes.py` | Created | `/ws/chat/{id}` and `/ws/friends/{id}` endpoints |
| `backend/app/routes/chat_routes.py` | Modified | `post_message` → async + broadcast |
| `backend/app/routes/friend_routes.py` | Modified | `post_message` + `post_media` → async + broadcast |
| `backend/app/main.py` | Modified | Added `ws_router` (no prefix) |
| `frontend/src/hooks/useRefreshOnFocus.ts` | Created | Hook for refetch on window focus/visibility |
| `frontend/src/components/ChatRoom.tsx` | Modified | Replaced `setInterval` polling with WebSocket |
| `frontend/src/components/FriendChat.tsx` | Modified | Replaced `setInterval` polling with WebSocket |
| `frontend/src/pages/StudentDashboard.tsx` | Modified | Lazy-mount-with-stay pattern |
| `frontend/src/pages/ProfessorDashboard.tsx` | Modified | Lazy-mount-with-stay pattern |

---

## 10. Trade-offs & Limitations

### What improved

| Feature | Before | After |
|---|---|---|
| Chat message latency | 0–3000ms (avg 1500ms) | < 50ms (WS push) |
| Dashboard tab switch (2nd+ visit) | 200–500ms spinner every time | Instant (0ms) |
| Memory usage | Lower (sections unmounted) | Slightly higher (sections stay in RAM) |
| API calls on page load | 1 (home only) | 1 on load, +1 per section first-visit |

### Fallback behavior

If the WebSocket server is unreachable (backend down, proxy issue), `ws.onerror` fires and a 3-second polling interval starts automatically. The user experience degrades gracefully rather than breaking.

### Limitation: WebSocket disconnects

The current WebSocket implementation does not implement automatic reconnection. If the connection drops mid-session (e.g., network hiccup), the user would need to navigate away and back to the chat to re-establish the WS connection. For a production app, an exponential backoff reconnect loop should be added.

### Limitation: Horizontal scaling

The `ConnectionManager` is in-memory and not shared across multiple server processes. If the backend is deployed with multiple workers or instances, a message sent to worker A will only broadcast to clients connected to worker A. For multi-instance deployments, replace the in-memory manager with a Redis Pub/Sub-backed solution.

### Limitation: Mounted sections and stale data

Sections that stay mounted do not automatically refetch their data. If a professor publishes a new course while you're on the "My Courses" tab and then switch back, the course list won't update until you refresh. The `useRefreshOnFocus` hook partially mitigates this for browser-tab-switch scenarios. A full solution would require either polling, server-sent events, or a data-fetching library like TanStack Query with automatic background refetch.

---

*Document generated for PFE project Hub4Learners — April 2026*

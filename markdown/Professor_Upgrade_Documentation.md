# Hub4Learners — Professor Upgrade Request Documentation

## PFE Project — Role Upgrade Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Default Role Enforcement](#3-default-role-enforcement)
4. [Backend Implementation](#4-backend-implementation)
   - 4.1 [Database Model](#41-database-model)
   - 4.2 [Schemas (Pydantic Models)](#42-schemas-pydantic-models)
   - 4.3 [Role Guard Utility](#43-role-guard-utility)
   - 4.4 [Controller (Business Logic)](#44-controller-business-logic)
   - 4.5 [Routes (API Endpoints)](#45-routes-api-endpoints)
   - 4.6 [File Storage & Static Serving](#46-file-storage--static-serving)
   - 4.7 [App Entry Point Changes](#47-app-entry-point-changes)
5. [Frontend Implementation](#5-frontend-implementation)
   - 5.1 [API Service](#51-api-service)
   - 5.2 [Student Dashboard — Upgrade Section](#52-student-dashboard--upgrade-section)
   - 5.3 [Admin Dashboard — Upgrade Requests Panel](#53-admin-dashboard--upgrade-requests-panel)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

This document describes the **Professor Upgrade Request** system for the Hub4Learners platform.

### The Problem

All new accounts are created as `role: "student"` by default. A real professor who signs up can't immediately access the professor dashboard — they need to prove their identity first.

### The Solution

A document-based upgrade workflow:

1. Any student can submit an **upgrade request** from their dashboard, attaching their **CIN card** (identity document) and optionally a **diploma**.
2. The documents are stored on the server.
3. An **admin** reviews the request from their dashboard and **approves** or **rejects** it (with optional notes).
4. On approval, the user's role is automatically changed to `"professor"` in the database.
5. The next time the user logs in (or refreshes), they land on the **Professor Dashboard** instead.

### Technologies Used

| Layer    | Technology                                |
|----------|------------------------------------------|
| Backend  | FastAPI (Python)                         |
| Database | PostgreSQL (Neon cloud) — new table added|
| ORM      | SQLModel + SQLAlchemy                    |
| Files    | `python-multipart` + `fastapi.StaticFiles`|
| Frontend | React 19 + TypeScript                    |
| Styling  | Tailwind CSS                             |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│                                                                 │
│  StudentDashboard                                               │
│    "Become Professor" nav → UpgradeSection component           │
│    → POST /api/upgrade/request  (multipart: cin + diploma)     │
│    → GET  /api/upgrade/my-request  (check current status)      │
│                                                                 │
│  AdminDashboard                                                 │
│    "Upgrade Requests" nav → UpgradeRequestsPanel component     │
│    → GET  /api/upgrade/requests       (list all)               │
│    → PUT  /api/upgrade/requests/{id}/review  (approve/reject)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (JSON + Bearer Token)
┌──────────────────────────▼──────────────────────────────────────┐
│                         BACKEND (FastAPI)                        │
│                                                                 │
│  upgrade_routes.py                                              │
│    └─→ upgrade_controller.py                                    │
│           ├── saves files to backend/uploads/upgrade_docs/      │
│           └── reads/writes upgrade_requests table (PostgreSQL)  │
│                                                                 │
│  On approve → also updates users table: role = "professor"     │
└─────────────────────────────────────────────────────────────────┘
```

### Backend Layer Structure

```
backend/app/
├── main.py                           # Registers upgrade router, mounts /uploads
├── models/
│   ├── user.py                       # Existing User table
│   └── upgrade_request.py            # NEW — UpgradeRequest table
├── schemas/
│   ├── auth.py                       # Existing auth schemas
│   └── upgrade.py                    # NEW — UpgradeRequestOut, ReviewRequest
├── controller/
│   ├── auth_controller.py            # Existing
│   └── upgrade_controller.py         # NEW — all upgrade business logic
├── routes/
│   ├── auth_routes.py                # Existing
│   └── upgrade_routes.py             # NEW — 4 API endpoints
└── utils/
    └── security.py                   # MODIFIED — added require_role() dependency

backend/uploads/
└── upgrade_docs/                     # NEW — uploaded documents stored here
    └── {user_id}_{type}_{uuid}.{ext}
```

---

## 3. Default Role Enforcement

Before this feature, the `RegisterRequest` schema had an optional `role` field that defaulted to `"student"`. This was a **security gap** — anyone could have sent `role: "admin"` in the request body.

### Fix Applied

**`backend/app/schemas/auth.py`** — The `role` field was removed entirely from the registration schema:

```python
# BEFORE (insecure)
class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str = "student"   # ← could be overridden by client!

# AFTER (secure)
class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    # role is no longer accepted from the client
```

**`backend/app/controller/auth_controller.py`** — The role is now hardcoded server-side:

```python
user = User(
    full_name=f"{data.first_name} {data.last_name}",
    email=data.email,
    password_hash=hash_password(data.password),
    role="student",    # ← always "student", no matter what the client sends
)
```

**Result:** It is now impossible to register with any role other than `"student"`.

---

## 4. Backend Implementation

### 4.1 Database Model

**File:** `backend/app/models/upgrade_request.py` *(new)*

A new PostgreSQL table `upgrade_requests` stores all upgrade requests.

```python
class UpgradeRequest(SQLModel, table=True):
    __tablename__ = "upgrade_requests"

    id: UUID                          # Primary key, auto-generated
    user_id: UUID                     # References the student who submitted
    status: str                       # "pending" | "approved" | "rejected"
    cin_path: Optional[str]           # Relative path to saved CIN file
    diploma_path: Optional[str]       # Relative path to saved diploma file
    message: Optional[str]            # Optional note from the student
    reviewer_notes: Optional[str]     # Admin's note on approval/rejection
    created_at: datetime              # Auto-set on creation
    reviewed_at: Optional[datetime]   # Set when admin makes a decision
```

**Status lifecycle:**

```
[submitted] → status = "pending"
                 │
                 ├── Admin approves → status = "approved" + user.role = "professor"
                 │
                 └── Admin rejects  → status = "rejected" + reviewer_notes set
                                            │
                                            └── Student can resubmit a NEW request
```

---

### 4.2 Schemas (Pydantic Models)

**File:** `backend/app/schemas/upgrade.py` *(new)*

```python
class UpgradeRequestOut(BaseModel):
    id: UUID
    user_id: UUID
    user_full_name: str       # Joined from users table for convenience
    user_email: str           # Joined from users table for convenience
    status: str
    cin_path: Optional[str]
    diploma_path: Optional[str]
    message: Optional[str]
    reviewer_notes: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

class ReviewRequest(BaseModel):
    action: str               # "approve" or "reject"
    reviewer_notes: Optional[str] = None
```

`UpgradeRequestOut` is used in responses from all 4 endpoints. It includes the user's name and email (joined from the `users` table) so the admin doesn't need to make a separate API call to know who submitted the request.

---

### 4.3 Role Guard Utility

**File:** `backend/app/utils/security.py` *(modified)*

A `require_role()` factory function was added. It creates a **FastAPI dependency** that blocks access unless the authenticated user has a specific role.

```python
def require_role(required: str):
    """Returns a FastAPI dependency that enforces a specific role."""
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") != required:
            raise HTTPException(
                status_code=403,
                detail=f"Access restricted to {required}s",
            )
        return current_user
    return dependency
```

**Usage in routes:**

```python
# Only admins can access this endpoint
@router.get("/requests")
def all_requests(current_user: dict = Depends(require_role("admin")), ...):
    ...
```

If a student tries to call an admin-only endpoint, they get:
```json
{ "detail": "Access restricted to admins" }
```

---

### 4.4 Controller (Business Logic)

**File:** `backend/app/controller/upgrade_controller.py` *(new)*

#### a) Submit Upgrade Request

```python
def submit_upgrade_request(user_id, cin_file, diploma_file, message, db):
```

Steps:
1. Verify user exists and is currently a `"student"` (professors can't re-apply)
2. Check CIN file is provided (required)
3. Check for an existing `"pending"` request — **prevents duplicate submissions**
4. Save CIN file to disk via `_save_file()`
5. Save diploma file if provided
6. Create `UpgradeRequest` record with `status="pending"`
7. Return the new request as `UpgradeRequestOut`

**File saving logic (`_save_file`):**

```python
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}

def _save_file(file: UploadFile, user_id: str, doc_type: str) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    # Validate extension
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"{doc_type} must be JPG, PNG, or PDF")
    # Generate collision-proof filename
    filename = f"{user_id}_{doc_type}_{uuid4().hex}{ext}"
    # Save file to disk
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        shutil.copyfileobj(file.file, f)
    # Return relative path (stored in DB)
    return f"upgrade_docs/{filename}"
```

Filenames follow the pattern: `{user_id}_{cin|diploma}_{random_uuid}.{ext}`
Example: `550e8400-..._cin_a3f9b2c1....jpg`

#### b) Get My Upgrade Request

```python
def get_my_upgrade_request(user_id, db) -> Optional[UpgradeRequestOut]:
```

Returns the **most recent** upgrade request for the logged-in user, or `null` if none exist. Used by the student dashboard to display the current status.

#### c) List All Upgrade Requests (Admin)

```python
def list_upgrade_requests(db) -> list[UpgradeRequestOut]:
```

Returns all requests ordered by `created_at` descending (newest first). Joins each request with the corresponding user to include name and email.

#### d) Review Upgrade Request (Admin)

```python
def review_upgrade_request(request_id, review: ReviewRequest, db):
```

Steps:
1. Validate `action` is `"approve"` or `"reject"`
2. Fetch the request — raise 404 if not found
3. Check it's still `"pending"` — raise 400 if already reviewed
4. Update `status`, `reviewer_notes`, and `reviewed_at`
5. **If approved:** find the user and set `user.role = "professor"`
6. Commit and return the updated request

---

### 4.5 Routes (API Endpoints)

**File:** `backend/app/routes/upgrade_routes.py` *(new)*

```python
router = APIRouter(prefix="/upgrade", tags=["Upgrade Requests"])
```

| Method | Full Path | Auth Required | Description |
|--------|-----------|--------------|-------------|
| `POST` | `/api/upgrade/request` | Any valid token | Submit upgrade request with documents |
| `GET` | `/api/upgrade/my-request` | Any valid token | Get your own latest request status |
| `GET` | `/api/upgrade/requests` | Admin only | List all upgrade requests |
| `PUT` | `/api/upgrade/requests/{id}/review` | Admin only | Approve or reject a request |

**File upload endpoint signature:**

```python
@router.post("/request", response_model=UpgradeRequestOut)
def request_upgrade(
    cin: UploadFile = File(...),                    # Required file
    diploma: Optional[UploadFile] = File(None),     # Optional file
    message: Optional[str] = Form(default=None),    # Optional text
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
```

This endpoint uses **`multipart/form-data`** (not JSON) because it receives files. The frontend must use `FormData` to send to this endpoint.

---

### 4.6 File Storage & Static Serving

Uploaded files are saved to `backend/uploads/upgrade_docs/` on the server's filesystem.

To make these files accessible via HTTP (so the admin can view/download them), FastAPI serves the directory as static files:

**`backend/app/main.py`:**

```python
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
```

**Resulting URL structure:**

```
File stored at:  backend/uploads/upgrade_docs/abc123_cin_xyz.jpg
Accessible at:   http://localhost:8000/uploads/upgrade_docs/abc123_cin_xyz.jpg
```

The `cin_path` and `diploma_path` stored in the database are relative paths like `upgrade_docs/filename.jpg`. The admin dashboard's "View CIN / View Diploma" links prepend `http://localhost:8000/uploads/` to get the full URL.

---

### 4.7 App Entry Point Changes

**File:** `backend/app/main.py` *(modified)*

Three additions were made:

```python
# 1. Import the new model so its table gets created on startup
from app.models.upgrade_request import UpgradeRequest  # noqa: F401

# 2. Mount uploads directory as static files
from fastapi.staticfiles import StaticFiles
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# 3. Register the upgrade router
from app.routes.upgrade_routes import router as upgrade_router
app.include_router(upgrade_router, prefix="/api")
```

When the backend starts, `SQLModel.metadata.create_all(engine)` now also creates the `upgrade_requests` table automatically.

---

## 5. Frontend Implementation

### 5.1 API Service

**File:** `frontend/src/api/upgrade.ts` *(new)*

Centralized API functions for all 4 upgrade endpoints.

```typescript
export interface UpgradeRequestOut {
  id: string
  user_id: string
  user_full_name: string
  user_email: string
  status: 'pending' | 'approved' | 'rejected'
  cin_path: string | null
  diploma_path: string | null
  message: string | null
  reviewer_notes: string | null
  created_at: string
  reviewed_at: string | null
}

// Student: submit a request with files
submitUpgradeRequest(token, formData: FormData) → POST /api/upgrade/request

// Student: check own request status
getMyUpgradeRequest(token)  → GET  /api/upgrade/my-request

// Admin: list all requests
listUpgradeRequests(token)  → GET  /api/upgrade/requests

// Admin: approve or reject
reviewUpgradeRequest(token, id, action, notes) → PUT /api/upgrade/requests/{id}/review
```

**How file upload is sent from the frontend:**

```typescript
const fd = new FormData()
fd.append('cin', cinFile)             // File object
if (diplomaFile) fd.append('diploma', diplomaFile)
if (message) fd.append('message', message)

await fetch('/api/upgrade/request', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  // No Content-Type header — browser sets it automatically with multipart boundary
  body: fd,
})
```

> **Important:** Do NOT set `Content-Type: application/json` when sending `FormData`. The browser sets the correct `multipart/form-data; boundary=...` header automatically.

---

### 5.2 Student Dashboard — Upgrade Section

**File:** `frontend/src/pages/StudentDashboard.tsx` *(modified)*

A new nav item **"Become Professor"** was added to the sidebar. Clicking it shows the `UpgradeSection` component.

#### States the upgrade section can display

| Condition | What the student sees |
|-----------|----------------------|
| No previous request | Upload form with CIN, diploma, and message fields |
| Status = `"pending"` | "Your request is under review" card — no form |
| Status = `"rejected"` | Rejection banner with admin's notes + fresh form to resubmit |
| Status = `"approved"` | Not shown — role changed to `professor`, they land on ProfessorDashboard |

#### `UpgradeSection` component logic

```
On mount:
  → GET /api/upgrade/my-request
  → If null → show form (first time)
  → If pending → show waiting state
  → If rejected → show rejection note + new form
  → If approved → (shouldn't happen, role has changed)

On form submit:
  → Build FormData with cin, diploma (optional), message (optional)
  → POST /api/upgrade/request
  → On success → update UI to show pending state
  → On error → display error message
```

#### `FileUploadField` component

A reusable component for styled file inputs. Clicking anywhere on the field opens the system file picker. Selected filename appears inline. An "✕" button deselects the file without clicking the input again.

```
┌─────────────────────────────────────────────┐
│  Click to select file                  [✕]  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Accepted: JPG, PNG, PDF                    │
└─────────────────────────────────────────────┘
```

---

### 5.3 Admin Dashboard — Upgrade Requests Panel

**File:** `frontend/src/pages/AdminDashboard.tsx` *(modified)*

A new nav item **"Upgrade Requests"** was added. Clicking it shows `UpgradeRequestsPanel`.

#### What the admin sees per request

Each request is displayed as a card containing:
- Student's full name and email
- Status badge (amber = pending, green = approved, red = rejected)
- "View CIN" and "View Diploma" links (open in new tab)
- Submission date
- Student's optional message (if provided), in italic
- Previous reviewer notes (if any)
- **Approve** and **Reject** buttons (only shown for `pending` requests)

#### Rejection flow (two-step)

Clicking **Reject** does NOT immediately reject. Instead it expands an inline text area:

```
┌─────────────────────────────────────────┐
│ Reason for rejection (optional)…        │
│                                         │
└─────────────────────────────────────────┘
  [Confirm rejection]  [Cancel]
```

This prevents accidental rejections. The admin can add a note that the student will see.

#### State management

```typescript
const [requests, setRequests] = useState<UpgradeRequestOut[]>([])
const [rejectingId, setRejectingId] = useState<string | null>(null) // which card is in reject mode
const [rejectNotes, setRejectNotes]   = useState('')
const [actionLoading, setActionLoading] = useState<string | null>(null) // which request is processing
```

After an approve or reject API call, the local state is updated **optimistically** — the card's status badge changes immediately without a page refresh.

---

## 6. Complete Flow Diagrams

### Student submits an upgrade request

```
Student logs in → lands on StudentDashboard (role: "student")
       │
       ▼
Clicks "Become Professor" in sidebar
       │
       ▼
GET /api/upgrade/my-request
       │
       ├── null → Show upload form
       │
       └── pending/rejected → Show status (or rejection + form)

Student fills form:
  - Selects CIN file (required)
  - Selects diploma (optional)
  - Types message (optional)
  → clicks "Submit request"
       │
       ▼
POST /api/upgrade/request  (multipart/form-data)
       │
       ├── 400 → CIN missing, wrong file type, or not a student
       ├── 409 → Already has a pending request
       └── 200 → UpgradeRequest created (status: "pending")
                  → UI switches to "Under review" state
```

### Admin reviews a request

```
Admin logs in → lands on AdminDashboard (role: "admin")
       │
       ▼
Clicks "Upgrade Requests" in sidebar
       │
       ▼
GET /api/upgrade/requests → list of all requests ordered by newest
       │
       ▼
Admin sees pending request card:
  - Clicks "View CIN" link → opens file in new tab
  - Clicks "View Diploma" link (if provided)
  - Reads student's message

       │
       ├── Clicks "Approve"
       │       │
       │       ▼
       │   PUT /api/upgrade/requests/{id}/review  { action: "approve" }
       │       │
       │       ▼
       │   Backend: req.status = "approved"
       │            user.role  = "professor"
       │            req.reviewed_at = now
       │
       └── Clicks "Reject" → text area appears
               │
               ▼
           Types reason → Clicks "Confirm rejection"
               │
               ▼
           PUT /api/upgrade/requests/{id}/review
               { action: "reject", reviewer_notes: "..." }
               │
               ▼
           Backend: req.status = "rejected"
                    req.reviewer_notes = notes
                    req.reviewed_at = now
                    (user.role stays "student")
```

### Student's role takes effect

```
After approval:
  Student stays on "Under review" page until next login/refresh
       │
       ▼
  Student logs out → logs back in
       │
       ▼
  POST /api/auth/login → new token contains role: "professor"
       │
       ▼
  AuthContext calls GET /api/auth/me → user.role = "professor"
       │
       ▼
  DashboardPage renders ProfessorDashboard ✓
```

---

## 7. API Reference

### POST `/api/upgrade/request`

Submit an upgrade request with supporting documents.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data  (set automatically by browser)
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cin` | File | Yes | Identity card — JPG, PNG, or PDF |
| `diploma` | File | No | Diploma or certificate |
| `message` | string | No | Optional note to admin |

**Success (200):**
```json
{
  "id": "a1b2c3d4-...",
  "user_id": "550e8400-...",
  "user_full_name": "John Doe",
  "user_email": "john@example.com",
  "status": "pending",
  "cin_path": "upgrade_docs/550e8400_cin_abc123.jpg",
  "diploma_path": null,
  "message": "I have 5 years of teaching experience.",
  "reviewer_notes": null,
  "created_at": "2026-03-13T10:00:00",
  "reviewed_at": null
}
```

**Errors:**
| Code | Reason |
|------|--------|
| 400 | CIN missing, invalid file type, or user is not a student |
| 409 | Already has a pending request |

---

### GET `/api/upgrade/my-request`

Get the most recent upgrade request for the logged-in user.

**Headers:** `Authorization: Bearer <token>`

**Success (200):** Returns `UpgradeRequestOut` object, or `null` if no request exists.

---

### GET `/api/upgrade/requests`

List all upgrade requests. **Admin only.**

**Headers:** `Authorization: Bearer <token>` (must be admin)

**Success (200):** Returns array of `UpgradeRequestOut`, newest first.

**Error:**
| Code | Reason |
|------|--------|
| 403 | Token belongs to a student or professor |

---

### PUT `/api/upgrade/requests/{id}/review`

Approve or reject a request. **Admin only.**

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**URL Parameter:** `id` — the UUID of the upgrade request

**Request Body:**
```json
{
  "action": "approve",
  "reviewer_notes": "Documents verified successfully."
}
```
or
```json
{
  "action": "reject",
  "reviewer_notes": "Diploma image is unreadable. Please resubmit a clearer photo."
}
```

**Success (200):** Returns the updated `UpgradeRequestOut`.

**Errors:**
| Code | Reason |
|------|--------|
| 400 | Invalid action value, or request already reviewed |
| 403 | Not an admin |
| 404 | Request ID not found |

---

## 8. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/models/upgrade_request.py` | Created | `upgrade_requests` DB table |
| `backend/app/schemas/upgrade.py` | Created | `UpgradeRequestOut` + `ReviewRequest` Pydantic models |
| `backend/app/controller/upgrade_controller.py` | Created | All upgrade business logic + file saving |
| `backend/app/routes/upgrade_routes.py` | Created | 4 API endpoints |
| `backend/app/utils/security.py` | Modified | Added `require_role()` dependency |
| `backend/app/main.py` | Modified | Import model, mount `/uploads`, register router |
| `backend/app/schemas/auth.py` | Modified | Removed `role` field from `RegisterRequest` |
| `backend/app/controller/auth_controller.py` | Modified | Hardcoded `role="student"` on registration |
| `frontend/src/api/upgrade.ts` | Created | API client for all 4 upgrade endpoints |
| `frontend/src/pages/StudentDashboard.tsx` | Modified | Added "Become Professor" nav + upgrade form |
| `frontend/src/pages/AdminDashboard.tsx` | Modified | Added "Upgrade Requests" nav + review panel |

---

## 9. Business Rules & Validation

| Rule | Where enforced |
|------|---------------|
| New accounts always get `role="student"` | `auth_controller.py` — hardcoded |
| `role` field is NOT accepted from the client at registration | `schemas/auth.py` — field removed |
| Only students can submit upgrade requests (not professors or admins) | `upgrade_controller.py` — checks `user.role != "student"` |
| CIN card is required; diploma is optional | `upgrade_routes.py` — `File(...)` vs `File(None)` |
| Accepted file types: JPG, PNG, PDF only | `upgrade_controller.py` — `_save_file()` extension check |
| A student can only have ONE pending request at a time | `upgrade_controller.py` — queries for existing pending before inserting |
| A rejected student CAN resubmit a new request | Implicit — only `pending` requests are blocked, not `rejected` |
| Only admins can list all requests | `upgrade_routes.py` — `require_role("admin")` |
| Only admins can approve/reject | `upgrade_routes.py` — `require_role("admin")` |
| A request can only be reviewed once (once approved/rejected, it cannot be changed) | `upgrade_controller.py` — checks `req.status != "pending"` |
| On approval, user's role is immediately changed | `upgrade_controller.py` — `user.role = "professor"` in same transaction |

---

*Document generated for PFE project Hub4Learners — March 2026*

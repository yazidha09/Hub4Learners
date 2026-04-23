# Hub4Learners — JWT Authentication Documentation

## PFE Project — Authentication Module

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Backend Implementation](#3-backend-implementation)
   - 3.1 [Schemas (Pydantic Models)](#31-schemas-pydantic-models)
   - 3.2 [Security Utilities](#32-security-utilities)
   - 3.3 [Controller (Business Logic)](#33-controller-business-logic)
   - 3.4 [Routes (API Endpoints)](#34-routes-api-endpoints)
   - 3.5 [App Entry Point](#35-app-entry-point)
   - 3.6 [Database Fix](#36-database-fix)
   - 3.7 [Bcrypt Fix](#37-bcrypt-fix)
4. [Frontend Implementation](#4-frontend-implementation)
   - 4.1 [API Service](#41-api-service)
   - 4.2 [Auth Context (State Management)](#42-auth-context-state-management)
   - 4.3 [Login Page](#43-login-page)
   - 4.4 [Register Page](#44-register-page)
   - 4.5 [Dashboard Page](#45-dashboard-page)
   - 4.6 [Routing & Route Protection](#46-routing--route-protection)
5. [Authentication Flow Diagrams](#5-authentication-flow-diagrams)
6. [API Reference](#6-api-reference)
7. [Files Created / Modified](#7-files-created--modified)
8. [Issues Encountered & Fixes](#8-issues-encountered--fixes)

---

## 1. Overview

This document describes the implementation of a **JWT (JSON Web Token)** based authentication system for the Hub4Learners platform. The system supports:

- **User Registration** (Sign Up) — creating a new account
- **User Login** (Sign In) — authenticating with email & password
- **Protected Routes** — pages accessible only to authenticated users
- **Token Persistence** — staying logged in across browser refreshes
- **Auto-redirect** — logged-in users skip the login page; guests can't access protected pages

### Technologies Used

| Layer    | Technology                      |
|----------|--------------------------------|
| Backend  | FastAPI (Python)               |
| Database | PostgreSQL (Neon cloud)        |
| ORM      | SQLModel + SQLAlchemy          |
| Auth     | python-jose (JWT), passlib (bcrypt) |
| Frontend | React 19 + TypeScript          |
| Routing  | React Router DOM v7            |
| Styling  | Tailwind CSS                   |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                     │
│                                                             │
│  LoginPage ──→ POST /api/auth/login ──→ receives JWT token  │
│  RegisterPage → POST /api/auth/register → receives JWT token│
│  AuthContext ──→ GET /api/auth/me ──→ validates token        │
│                                                             │
│  Token stored in localStorage("h4l_token")                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (JSON + Bearer Token)
┌──────────────────────────▼──────────────────────────────────┐
│                        BACKEND (FastAPI)                     │
│                                                             │
│  Routes ──→ Controller ──→ Database (PostgreSQL)            │
│                                                             │
│  Security: bcrypt hashing + JWT encode/decode               │
└─────────────────────────────────────────────────────────────┘
```

### Backend Layer Structure (MVC Pattern)

```
backend/app/
├── main.py                      # FastAPI app, startup, router registration
├── database.py                  # DB engine, session factory
├── models/
│   └── user.py                  # SQLModel table: User
├── schemas/
│   └── auth.py                  # Pydantic request/response models
├── controller/
│   └── auth_controller.py       # Business logic (register, login, get user)
├── routes/
│   └── auth_routes.py           # API endpoint definitions
└── utils/
    └── security.py              # Password hashing, JWT creation, token decoding
```

---

## 3. Backend Implementation

### 3.1 Schemas (Pydantic Models)

**File:** `backend/app/schemas/auth.py` *(created)*

These are the **data validation models** that FastAPI uses to validate incoming requests and format outgoing responses.

```python
class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr          # Validates email format automatically
    password: str
    role: str = "student"    # Default role

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
```

**Why Pydantic?**
- Automatic request body validation
- Type checking at runtime
- Auto-generated OpenAPI/Swagger documentation
- `EmailStr` ensures only valid email formats are accepted

---

### 3.2 Security Utilities

**File:** `backend/app/utils/security.py` *(modified)*

This file handles three critical security functions:

#### a) Password Hashing (bcrypt)

```python
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)
```

- **We never store plain-text passwords.** Passwords are hashed using the **bcrypt** algorithm before saving to the database.
- `bcrypt` is a one-way hash — you can verify a password against a hash, but you cannot reverse the hash back into the password.
- `CryptContext` from `passlib` handles salt generation automatically.

#### b) JWT Token Creation

```python
SECRET_KEY = "super-secret-key-change-this"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

- Creates a JWT containing the user's ID (`sub`) and role
- Token expires after **60 minutes**
- Signed using **HMAC-SHA256** (`HS256`) with a secret key
- The `exp` claim is a standard JWT field for expiration

#### c) Token Verification (added)

```python
bearer_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

- `HTTPBearer()` extracts the token from the `Authorization: Bearer <token>` header
- `jwt.decode()` verifies the signature and expiration
- Returns the decoded payload (containing `sub` and `role`) to the route handler
- Used as a **FastAPI dependency** via `Depends(get_current_user)`

---

### 3.3 Controller (Business Logic)

**File:** `backend/app/controller/auth_controller.py` *(created)*

#### a) Registration

```python
def register_user(data: RegisterRequest, db: Session) -> TokenResponse:
    # 1. Check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # 2. Create the user with hashed password
    user = User(
        full_name=f"{data.first_name} {data.last_name}",
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 3. Generate and return JWT
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)
```

**Flow:** Validate uniqueness → Hash password → Save to DB → Return JWT

#### b) Login

```python
def login_user(data: LoginRequest, db: Session) -> TokenResponse:
    # 1. Find user by email
    user = db.query(User).filter(User.email == data.email).first()

    # 2. Verify password
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # 3. Generate and return JWT
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)
```

**Flow:** Find user → Verify password hash → Return JWT

**Security note:** The error message is intentionally vague ("Invalid email or password") to prevent **user enumeration attacks** — an attacker can't determine whether an email exists in the system.

#### c) Get Current User Profile

```python
def get_user_by_id(user_id: str, db: Session) -> UserOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(id=str(user.id), full_name=user.full_name,
                   email=user.email, role=user.role)
```

---

### 3.4 Routes (API Endpoints)

**File:** `backend/app/routes/auth_routes.py` *(created)*

```python
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(data, db)

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return login_user(data, db)

@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user),
       db: Session = Depends(get_db)):
    return get_user_by_id(current_user["sub"], db)
```

| Endpoint              | Method | Auth Required | Description                |
|-----------------------|--------|--------------|----------------------------|
| `/api/auth/register`  | POST   | No           | Create account, get token  |
| `/api/auth/login`     | POST   | No           | Login, get token           |
| `/api/auth/me`        | GET    | Yes (Bearer) | Get current user's profile |

- The `/me` endpoint uses `Depends(get_current_user)` — FastAPI automatically rejects requests without a valid JWT.
- `Depends(get_db)` injects a database session and auto-closes it after the request.

---

### 3.5 App Entry Point

**File:** `backend/app/main.py` *(modified)*

Changes made:
1. **Import the User model** — ensures SQLModel registers the `users` table
2. **Create tables on startup** — `SQLModel.metadata.create_all(engine)` creates any missing tables
3. **Register the auth router** — `app.include_router(auth_router, prefix="/api")`

```python
from app.database import engine
from app.models.user import User
from app.routes.auth_routes import router as auth_router

# Create tables on startup
@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

# Register routers
app.include_router(auth_router, prefix="/api")
```

The final URL structure is: `/api` (from main.py) + `/auth` (from router) + `/login` = `/api/auth/login`

---

### 3.6 Database Fix

**File:** `backend/app/database.py` *(modified)*

**Problem:** The connection string used `postgresql://` as the scheme. Since `asyncpg` was installed as a dependency, SQLAlchemy auto-selected the **async** `asyncpg` driver, but the app uses **sync** endpoints, causing a `MissingGreenlet` error.

**Fix:** Changed the scheme to explicitly use the sync driver:

```
Before: postgresql://neondb_owner:...
After:  postgresql+psycopg2://neondb_owner:...
```

Also removed `channel_binding=require` which `psycopg2` doesn't support.

---

### 3.7 Bcrypt Fix

**File:** `backend/pyproject.toml` *(modified)*

**Problem:** `passlib 1.7.4` is incompatible with `bcrypt >= 4.1`. The newer bcrypt versions changed their API, causing a `ValueError: password cannot be longer than 72 bytes` crash when hashing any password.

**Fix:** Pinned bcrypt to a compatible version:

```toml
"passlib[bcrypt]==1.7.4",
"bcrypt==4.0.1",
```

---

## 4. Frontend Implementation

### 4.1 API Service

**File:** `frontend/src/api/auth.ts` *(created)*

A centralized HTTP client for all auth-related API calls:

```typescript
const API_BASE = "http://localhost:8000/api";

// Generic request helper with error handling
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// Three exported functions:
export function registerUser(data) { ... }  // POST /auth/register
export function loginUser(data) { ... }     // POST /auth/login
export function getMe(token) { ... }        // GET /auth/me (with Bearer token)
```

**Key design decisions:**
- Centralized base URL — easy to change for production
- Generic error handling — extracts FastAPI's `detail` field from error responses
- Type-safe with TypeScript interfaces (`TokenResponse`, `UserOut`)

---

### 4.2 Auth Context (State Management)

**File:** `frontend/src/context/AuthContext.tsx` *(created)*

Uses React Context API to provide authentication state globally across the app.

```
AuthProvider
├── token (string | null) — the JWT, synced with localStorage
├── user (UserOut | null) — decoded user profile from /auth/me
├── loading (boolean) — true while verifying token on page load
├── login(token) — saves token, triggers user fetch
└── logout() — clears token and user
```

**How it works:**

1. On initial load, reads token from `localStorage("h4l_token")`
2. If a token exists, calls `GET /api/auth/me` to validate it and fetch user info
3. If the token is expired/invalid, automatically clears it
4. `login()` saves the new token and triggers a re-fetch of user data
5. `logout()` clears everything

**Why Context instead of prop drilling?**
- Auth state is needed in many components (pages, navbar, route guards)
- Context provides it globally without passing props through every level

---

### 4.3 Login Page

**File:** `frontend/src/pages/LoginPage.tsx` *(modified)*

Changes:
- Added `useNavigate()` and `useAuth()` hooks
- `handleSubmit` now calls `loginUser()` API function
- On success: stores token via `login()`, navigates to `/dashboard`
- On error: displays the error message from the backend
- Added loading state to disable the button during API call

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError('')
  setLoading(true)
  try {
    const res = await loginUser({ email: form.email, password: form.password })
    login(res.access_token)      // Store token
    navigate('/dashboard')        // Redirect
  } catch (err) {
    setError(err.message)         // Show error
  } finally {
    setLoading(false)
  }
}
```

---

### 4.4 Register Page

**File:** `frontend/src/pages/RegisterPage.tsx` *(modified)*

Same pattern as login, but sends all registration fields:

```typescript
const res = await registerUser({
  first_name: form.firstName,
  last_name: form.lastName,
  email: form.email,
  password: form.password,
})
login(res.access_token)
navigate('/dashboard')
```

The page already had password confirmation logic — the API call only fires if passwords match.

---

### 4.5 Dashboard Page

**File:** `frontend/src/pages/DashboardPage.tsx` *(created)*

A simple protected page that:
- Displays the user's name from `useAuth().user`
- Has a "Sign out" button that calls `logout()` and redirects to `/login`

This serves as proof that authentication works — only accessible with a valid JWT.

---

### 4.6 Routing & Route Protection

**File:** `frontend/src/App.tsx` *(modified)*

Two route guard components were added:

```typescript
// Redirects to /login if NOT authenticated
function PrivateRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return <div>Loading…</div>
  return token ? children : <Navigate to="/login" />
}

// Redirects to /dashboard if ALREADY authenticated
function PublicRoute({ children }) {
  const { token, loading } = useAuth()
  if (loading) return <div>Loading…</div>
  return token ? <Navigate to="/dashboard" /> : children
}
```

**Route configuration:**

| Path          | Guard        | Component      |
|---------------|-------------|----------------|
| `/login`      | PublicRoute  | LoginPage      |
| `/register`   | PublicRoute  | RegisterPage   |
| `/dashboard`  | PrivateRoute | DashboardPage  |
| `*` (other)   | —           | Redirect → /login |

---

## 5. Authentication Flow Diagrams

### Registration Flow

```
User fills form → clicks "Create account"
       │
       ▼
POST /api/auth/register  { first_name, last_name, email, password }
       │
       ▼
Backend checks: does email exist?
       │
       ├── YES → 409 Conflict "Email already registered"
       │          → Frontend shows error message
       │
       └── NO  → Hash password with bcrypt
                → Save User to PostgreSQL
                → Generate JWT { sub: user_id, role, exp }
                → Return { access_token, token_type: "bearer" }
                         │
                         ▼
                Frontend stores token in localStorage
                AuthContext fetches user via GET /auth/me
                Navigate to /dashboard
```

### Login Flow

```
User fills form → clicks "Sign in"
       │
       ▼
POST /api/auth/login  { email, password }
       │
       ▼
Backend finds user by email
       │
       ├── NOT FOUND or WRONG PASSWORD → 401 "Invalid email or password"
       │                                   → Frontend shows error
       │
       └── MATCH → Generate JWT { sub: user_id, role, exp }
                 → Return { access_token, token_type: "bearer" }
                          │
                          ▼
                 Frontend stores token in localStorage
                 Navigate to /dashboard
```

### Token Verification Flow (on page load)

```
App loads → AuthContext reads token from localStorage
       │
       ├── No token → user = null, show login page
       │
       └── Token exists → GET /api/auth/me (Authorization: Bearer <token>)
                │
                ├── 401 (expired/invalid) → clear token, redirect to login
                │
                └── 200 OK → set user data, allow access to protected routes
```

---

## 6. API Reference

### POST `/api/auth/register`

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "mypassword123",
  "role": "student"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Response (409):**
```json
{ "detail": "Email already registered" }
```

---

### POST `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "mypassword123"
}
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Response (401):**
```json
{ "detail": "Invalid email or password" }
```

---

### GET `/api/auth/me`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "full_name": "John Doe",
  "email": "john@example.com",
  "role": "student"
}
```

**Error Response (401):**
```json
{ "detail": "Invalid or expired token" }
```

---

## 7. Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/schemas/__init__.py` | Created | Makes schemas a Python package |
| `backend/app/schemas/auth.py` | Created | Request/response Pydantic models |
| `backend/app/controller/auth_controller.py` | Created | Registration, login, user retrieval logic |
| `backend/app/routes/auth_routes.py` | Created | 3 API endpoints |
| `backend/app/utils/security.py` | Modified | Added `get_current_user` JWT dependency |
| `backend/app/main.py` | Modified | Router registration, table creation on startup |
| `backend/app/database.py` | Modified | Fixed DB driver (`postgresql+psycopg2://`) |
| `backend/pyproject.toml` | Modified | Pinned `bcrypt==4.0.1` |
| `frontend/src/api/auth.ts` | Created | API client functions |
| `frontend/src/context/AuthContext.tsx` | Created | Global auth state management |
| `frontend/src/pages/DashboardPage.tsx` | Created | Protected dashboard page |
| `frontend/src/pages/LoginPage.tsx` | Modified | Connected to backend API |
| `frontend/src/pages/RegisterPage.tsx` | Modified | Connected to backend API |
| `frontend/src/App.tsx` | Modified | Route guards, AuthProvider wrapper |

---

## 8. Issues Encountered & Fixes

### Issue 1: `MissingGreenlet` Error on Startup

- **Cause:** SQLAlchemy detected `asyncpg` in the environment and auto-selected it as the PostgreSQL driver. Since the app uses synchronous endpoints, this caused a crash.
- **Fix:** Explicitly set `postgresql+psycopg2://` in the DATABASE_URL to force the synchronous driver.

### Issue 2: `ValueError: password cannot be longer than 72 bytes`

- **Cause:** `passlib 1.7.4` is incompatible with `bcrypt >= 4.1`. The newer bcrypt versions changed their internal API, and passlib's bug-detection code triggers this error.
- **Fix:** Pinned `bcrypt==4.0.1` in `pyproject.toml`, which is the last version compatible with passlib 1.7.4.

---

## JWT Token Structure

A JWT consists of three Base64-encoded parts separated by dots:

```
header.payload.signature
```

**Header:**
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload (our token):**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",   // User ID
  "role": "student",                                  // User role
  "exp": 1741139200                                   // Expiration timestamp
}
```

**Signature:**
```
HMACSHA256(base64(header) + "." + base64(payload), SECRET_KEY)
```

The signature ensures the token hasn't been tampered with. Only the server (which knows the SECRET_KEY) can create valid tokens.

---

*Document generated for PFE project Hub4Learners — March 2026*

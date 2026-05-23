# Sprint 1 — Authentication

**Weeks 1–2**

## Introduction

The first sprint focuses on the foundation of Hub4Learners: a secure way for users to create an account, log in, and stay authenticated across the platform. It establishes the JWT-based session model and the role field on the user record that every later sprint relies on for access control.

## Sprint Goal

> Deliver a working sign-up and sign-in flow with role-aware JWT sessions that the rest of the platform can build on.

---

## User Stories

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-1.1 | High | As a visitor, I can register an account with first name, last name, email and password | T-1.1.1: Build register form · T-1.1.2: Validate inputs · T-1.1.3: Reject duplicate emails |
| US-1.2 | High | As a visitor, I can choose my role at registration (student or professor) | T-1.2.1: Role selector in form · T-1.2.2: Default to student |
| US-1.3 | High | As the system, I hash every password with bcrypt before storing it | T-1.3.1: Integrate passlib · T-1.3.2: Never persist plaintext |
| US-1.4 | High | As a registered user, I can log in with my email and password | T-1.4.1: Build login form · T-1.4.2: Verify credentials |
| US-1.5 | High | As the system, I issue a signed JWT on successful login containing the user's id and role | T-1.5.1: Create token util · T-1.5.2: 60-minute expiry |
| US-1.6 | High | As a logged-in user, I can fetch my own profile through a `/me` endpoint | T-1.6.1: JWT decoding · T-1.6.2: Return user payload |
| US-1.7 | Medium | As a logged-in user, I can log out and have my session cleared | T-1.7.1: Clear token · T-1.7.2: Redirect to login |
| US-1.8 | Medium | As the system, I reject invalid or expired tokens with a clear error | T-1.8.1: Auth middleware · T-1.8.2: 401 response |

---

## Related Diagrams

### C4 Component View — Authentication Domain

```mermaid
graph TD
    A["React Frontend<br/>(Login & Register pages)"] -->|REST| B["auth_routes.py<br/>Register · Login · Me"]
    B --> C["auth_controller.py<br/>Validation · token issuance"]
    C --> D["utils/security.py<br/>JWT (HS256) · bcrypt"]
    C --> E["SQLAlchemy ORM"]
    E -->|SQL| F[(Neon PostgreSQL)]
    A -. AuthContext .- A
```

### Class Diagram — User Identity

```mermaid
classDiagram
    class User {
        UUID id
        string full_name
        string email
        string password_hash
        string role
        bool is_active
        bool is_verified
        datetime created_at
    }

    class TokenResponse {
        string access_token
        string token_type
    }

    User ..> TokenResponse : issued on login
```

### Use Case Diagram — Authentication

```mermaid
graph LR
    V((Visitor))
    U((User))

    UC1([Register])
    UC2([Choose Role])
    UC3([Login])
    UC4([View My Profile])
    UC5([Logout])

    V --> UC1
    V --> UC2
    V --> UC3
    U --> UC4
    U --> UC5
```

### Sequence Diagram — Registration

```mermaid
sequenceDiagram
    actor Visitor
    participant Frontend
    participant API as FastAPI
    participant Sec as utils/security
    participant DB as Neon PostgreSQL

    Visitor->>Frontend: Fill register form
    Frontend->>Frontend: Client-side validation
    Frontend->>+API: POST /auth/register
    API->>API: Validate schema (Pydantic)
    API->>+DB: SELECT user WHERE email = ?
    DB-->>-API: result
    alt Email already exists
        API-->>Frontend: 409 Conflict
        Frontend-->>Visitor: Show "email taken" error
    else Email is free
        API->>+Sec: hash_password(password)
        Sec-->>-API: bcrypt hash
        API->>+DB: INSERT user (role, password_hash, ...)
        DB-->>-API: user row
        API->>+Sec: create_access_token({sub, role})
        Sec-->>-API: JWT (HS256, exp=60min)
        API-->>-Frontend: 201 { access_token }
        Frontend->>Frontend: localStorage.setItem("h4l_token")
        Frontend-->>Visitor: Redirect to /dashboard
    end
```

### Sequence Diagram — Login & Token Validation

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as FastAPI
    participant Sec as utils/security
    participant DB as Neon PostgreSQL

    User->>Frontend: Submit credentials
    Frontend->>+API: POST /auth/login
    API->>+DB: SELECT user WHERE email = ?
    DB-->>-API: user row (or null)
    alt User not found OR password mismatch
        API->>+Sec: verify_password(plain, hash)
        Sec-->>-API: false
        API-->>Frontend: 401 Invalid credentials
    else Credentials valid
        API->>+Sec: create_access_token({sub, role, university_id})
        Sec-->>-API: JWT
        API-->>-Frontend: 200 { access_token, token_type }
        Frontend->>Frontend: Save token & set AuthContext
    end

    Note over Frontend,API: Subsequent authenticated request

    User->>Frontend: Open protected page
    Frontend->>+API: GET /auth/me (Bearer token)
    API->>+Sec: get_current_user(token)
    Sec->>Sec: Decode JWT + verify signature
    alt Token invalid or expired
        Sec-->>API: raise 401
        API-->>Frontend: 401 Unauthorized
        Frontend->>Frontend: Clear token + redirect to /login
    else Token valid
        Sec-->>-API: payload {sub, role}
        API->>+DB: SELECT user by sub
        DB-->>-API: user row
        API-->>-Frontend: UserOut
    end
```

---

## Conclusion

Sprint 1 delivers a minimal but solid authentication layer. With JWT-based sessions and a clear role field carried inside every token, every later sprint can rely on a consistent way to identify the caller and enforce role-based access.

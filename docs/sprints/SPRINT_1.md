# Sprint 1 — Authentication & User Management

**Weeks 1–2**

## Introduction

The first sprint of Hub4Learners focuses on establishing the platform's identity layer. It delivers user registration, login, profile management, and the four-tier role model (student, professor, university admin, super admin) that every subsequent feature relies on. The sprint also lays down the organisational hierarchy — Regions, Universities, and the professor-to-university join request flow.

## Sprint Goal

> Provide a secure, role-aware authentication system that lets users register, log in, manage their profile, and be properly scoped to their university.

---

## User Stories

### Visitor & Registered User

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-1.1 | High | As a visitor, I can register with my name, email, password and chosen role (student or professor) | T-1.1.1: Build register form · T-1.1.2: Hash password with bcrypt · T-1.1.3: Issue JWT on success |
| US-1.2 | High | As a registered user, I can log in with my email and password to receive a session token | T-1.2.1: Login form · T-1.2.2: Verify credentials · T-1.2.3: Store token in localStorage |
| US-1.3 | High | As a logged-in user, I can fetch my own profile through a `/me` endpoint | T-1.3.1: JWT decode middleware · T-1.3.2: Return user data |
| US-1.4 | Medium | As a user, I can update my profile (name, bio, speciality, profile image, password) | T-1.4.1: Profile edit form · T-1.4.2: Profile image upload |
| US-1.5 | Medium | As a user, I can configure my preferences (theme, notifications, privacy) in a settings modal | T-1.5.1: Settings modal UI · T-1.5.2: Persist preferences locally |
| US-1.6 | Medium | As a user, I can log out and have my session cleared | T-1.6.1: Clear token · T-1.6.2: Redirect to login |

### Organisation & Roles

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-1.7 | High | As a super admin, I can manage Regions and Universities | T-1.7.1: CRUD endpoints · T-1.7.2: Admin panel UI |
| US-1.8 | High | As a super admin, I can promote a user to university admin | T-1.8.1: Role change endpoint · T-1.8.2: User management table |
| US-1.9 | Medium | As a professor, I can request to join a university | T-1.9.1: Join request form · T-1.9.2: Persist request |
| US-1.10 | Medium | As a university admin, I can approve or reject professor join requests | T-1.10.1: Review endpoint · T-1.10.2: Pending requests UI |

---

## Related Diagrams

### C4 Component View — Authentication Domain

```mermaid
graph TD
    A["React Frontend<br/>(Auth pages + AuthContext)"] -->|REST| B["auth_routes.py<br/>Register · Login · Profile"]
    A -->|REST| C["org_routes.py<br/>Regions · Universities · Join Requests"]
    B --> D["auth_controller.py<br/>Validation · password hashing"]
    C --> E["org_controller.py<br/>Hierarchy management"]
    D --> F["utils/security.py<br/>JWT · bcrypt · role guards"]
    D --> G["SQLAlchemy ORM"]
    E --> G
    G -->|SQL| H[(Neon PostgreSQL)]
```

### Class Diagram — Identity & Organisation

```mermaid
classDiagram
    class User {
        UUID id
        string full_name
        string email
        string password_hash
        string role
        string bio
        string speciality
        string profile_image
        UUID university_id
        UUID region_id
    }

    class Region {
        UUID id
        string name
        string code
    }

    class University {
        UUID id
        string name
        UUID region_id
    }

    class UniversityJoinRequest {
        UUID id
        UUID professor_id
        UUID university_id
        string status
        datetime reviewed_at
    }

    User "*" --> "0..1" University
    User "*" --> "0..1" Region
    University "*" --> "1" Region
    UniversityJoinRequest "*" --> "1" User
    UniversityJoinRequest "*" --> "1" University
```

### Use Case Diagram — Authentication & Organisation

```mermaid
graph LR
    V((Visitor))
    U((User))
    P((Professor))
    UA((University Admin))
    SA((Super Admin))

    UC1([Register])
    UC2([Login])
    UC3([View Profile])
    UC4([Update Profile])
    UC5([Configure Settings])
    UC6([Logout])
    UC7([Submit Join Request])
    UC8([Review Join Requests])
    UC9([Manage Regions & Universities])
    UC10([Change User Role])

    V --> UC1
    V --> UC2
    U --> UC3
    U --> UC4
    U --> UC5
    U --> UC6
    P --> UC7
    UA --> UC8
    SA --> UC9
    SA --> UC10
```

### Sequence Diagram — Registration & Login

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as FastAPI
    participant DB as Neon PostgreSQL

    User->>Frontend: Fill register form
    Frontend->>API: POST /auth/register
    API->>API: Hash password (bcrypt)
    API->>DB: Insert user
    API-->>Frontend: JWT token
    Frontend->>Frontend: Save token in localStorage

    User->>Frontend: Login
    Frontend->>API: POST /auth/login
    API->>DB: Verify credentials
    API-->>Frontend: JWT token + user payload
```

### Sequence Diagram — Professor Join Request Flow

```mermaid
sequenceDiagram
    actor Professor
    actor UniAdmin as University Admin
    participant API as FastAPI
    participant DB as Neon PostgreSQL

    Professor->>API: POST /org/join-requests
    API->>DB: Insert request (status=pending)
    API-->>Professor: Request submitted

    UniAdmin->>API: GET /org/join-requests
    API-->>UniAdmin: Pending requests
    UniAdmin->>API: PUT /org/join-requests/{id}/review (approve)
    API->>DB: Update request + set user.university_id
    API-->>UniAdmin: Approved
```

---

## Conclusion

Sprint 1 establishes the platform's identity foundation. With a role-aware JWT system, profile management, and a clean Region → University → User hierarchy in place, every later feature can rely on a stable authentication context and proper institutional scoping.

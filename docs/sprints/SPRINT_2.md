# Sprint 2 — Course Architecture

**Weeks 3–4**

## Introduction

Sprint 2 introduces the content layer of Hub4Learners. Professors gain a full authoring experience — courses divided into sections and subsections, with rich lesson blocks (text, image, video) and supporting materials. Students get the discovery side: browsing the public catalog, enrolling in free courses, marking subsections complete, and rating courses after completion.

## Sprint Goal

> Deliver the full course lifecycle so professors can build structured courses and students can enroll, learn, and provide feedback.

---

## User Stories

### Professor

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-2.1 | High | As a professor, I can create a course with title, description, category, thumbnail and pricing | T-2.1.1: Course creation modal · T-2.1.2: Thumbnail upload |
| US-2.2 | High | As a professor, I can organise my course into ordered sections and subsections | T-2.2.1: Section/subsection endpoints · T-2.2.2: Drag-friendly UI |
| US-2.3 | High | As a professor, I can add text, image, and video blocks inside a subsection | T-2.3.1: Block editor (TipTap) · T-2.3.2: Media uploads |
| US-2.4 | High | As a professor, I can publish or unpublish a course | T-2.4.1: Publish toggle · T-2.4.2: Status badge |
| US-2.5 | Medium | As a professor, I can edit or delete courses, sections, and blocks | T-2.5.1: Edit forms · T-2.5.2: Delete confirmations |
| US-2.6 | Medium | As a professor, I can upload PDF materials per section | T-2.6.1: Material upload · T-2.6.2: Material list UI |

### Student

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-2.7 | High | As a student, I can browse the public catalog and filter by category | T-2.7.1: Course grid · T-2.7.2: Category sidebar |
| US-2.8 | High | As a student, I can enroll in a free course in one click | T-2.8.1: Enroll endpoint · T-2.8.2: Enrollment state on card |
| US-2.9 | High | As a student, I can mark subsections complete and see my progress percentage | T-2.9.1: Mark-done button · T-2.9.2: Progress bar |
| US-2.10 | Medium | As a student, I can view all my enrolled courses in a "My Learning" library | T-2.10.1: My Learning page · T-2.10.2: Filter tabs (in progress, completed, not started) |
| US-2.11 | Medium | As a student, I can leave a single rating and comment per course | T-2.11.1: Feedback modal · T-2.11.2: Persist rating |

---

## Related Diagrams

### C4 Component View — Course Management Domain

```mermaid
graph TD
    A["React Frontend<br/>(Professor + Student dashboards)"] -->|REST| B["course_routes.py<br/>Course · Section · Block · Enroll · Progress"]
    B --> C["course_controller.py<br/>Authoring · enrollment · progress"]
    C --> D["File Storage<br/>(uploads / thumbnails, blocks, materials)"]
    C --> E["SQLAlchemy ORM"]
    E -->|SQL| F[(Neon PostgreSQL)]
```

### Class Diagram — Course Hierarchy

```mermaid
classDiagram
    class Course {
        UUID id
        string title
        string description
        string thumbnail
        decimal price
        bool is_free
        bool is_published
        UUID professor_id
        UUID category_id
    }

    class CourseSection {
        UUID id
        UUID course_id
        string title
        int order_index
    }

    class CourseSubsection {
        UUID id
        UUID section_id
        string title
        int order_index
    }

    class LessonBlock {
        UUID id
        UUID subsection_id
        string block_type
        string content
        string file_url
        int order_index
    }

    class Enrollment {
        UUID id
        UUID student_id
        UUID course_id
        string status
        datetime enrolled_at
    }

    class CourseProgress {
        UUID id
        UUID student_id
        UUID course_id
        UUID subsection_id
        datetime completed_at
    }

    class CourseFeedback {
        UUID id
        UUID course_id
        UUID user_id
        int rating
        string comment
    }

    Course "1" --> "*" CourseSection
    CourseSection "1" --> "*" CourseSubsection
    CourseSubsection "1" --> "*" LessonBlock
    Course "1" --> "*" Enrollment
    Enrollment "1" --> "*" CourseProgress
    Course "1" --> "*" CourseFeedback
```

### Use Case Diagram — Course Management

```mermaid
graph LR
    P((Professor))
    S((Student))

    UC1([Create Course])
    UC2([Add Sections & Subsections])
    UC3([Add Lesson Blocks])
    UC4([Upload Materials])
    UC5([Publish / Unpublish])
    UC6([Delete Course])
    UC7([Browse Catalog])
    UC8([Enroll in Course])
    UC9([Mark Subsection Done])
    UC10([View My Learning])
    UC11([Rate & Review Course])

    P --> UC1
    P --> UC2
    P --> UC3
    P --> UC4
    P --> UC5
    P --> UC6
    S --> UC7
    S --> UC8
    S --> UC9
    S --> UC10
    S --> UC11
```

### Sequence Diagram — Course Creation & Publishing

```mermaid
sequenceDiagram
    actor Professor
    participant Frontend
    participant API as FastAPI
    participant Sec as utils/security
    participant FS as File Storage
    participant DB as Neon PostgreSQL

    Professor->>Frontend: Fill course form + pick thumbnail
    Frontend->>+API: POST /courses (multipart)
    API->>+Sec: require_role("professor")
    alt Not a professor
        Sec-->>API: raise 403
        API-->>Frontend: 403 Forbidden
    else Authorised
        Sec-->>-API: ok
        opt Thumbnail uploaded
            API->>+FS: Save file to /uploads/thumbnails
            FS-->>-API: stored filename
        end
        API->>+DB: INSERT Course (is_published=false)
        DB-->>-API: course row
        API-->>-Frontend: 201 CourseOut
    end

    loop For each section, subsection, block
        Professor->>Frontend: Add content
        Frontend->>+API: POST /sections | /subsections | /blocks
        API->>API: Verify ownership (course.professor_id == user)
        API->>+DB: INSERT row(s)
        DB-->>-API: rows
        API-->>-Frontend: created resource
    end

    Professor->>Frontend: Click Publish
    Frontend->>+API: PATCH /courses/{id}/publish
    API->>+DB: UPDATE is_published = NOT is_published
    DB-->>-API: updated row
    API->>API: Self: trigger background re-index for RAG
    API-->>-Frontend: CourseOut(is_published=true)
```

### Sequence Diagram — Enrollment & Progress Tracking

```mermaid
sequenceDiagram
    actor Student
    participant Frontend
    participant API as FastAPI
    participant Sec as utils/security
    participant Notif as notification_controller
    participant DB as Neon PostgreSQL

    Student->>Frontend: Click Enroll on a course
    Frontend->>+API: POST /courses/{id}/enroll (Bearer token)
    API->>+Sec: get_current_user(token)
    Sec-->>-API: payload {sub}
    API->>+DB: SELECT existing Enrollment(student, course)
    DB-->>-API: result
    alt Already enrolled
        API-->>Frontend: 409 Conflict
    else Course not free
        API-->>Frontend: 402 Use Stripe checkout
    else Otherwise
        API->>+DB: INSERT Enrollment(status='active')
        DB-->>-API: enrollment row
        API->>+Notif: push("New Enrollment", to=professor)
        Notif-->>-API: ok
        API-->>-Frontend: 201 EnrollmentOut
    end

    Note over Student,API: Later — learning the course

    Student->>Frontend: Mark subsection as done
    Frontend->>+API: POST /courses/{id}/progress
    API->>+DB: Was this item already completed?
    DB-->>-API: result
    alt First completion
        API->>+DB: INSERT CourseProgress
        DB-->>-API: row
        API->>API: Self: recompute progress_pct
        opt progress_pct reached 100%
            API->>API: Self: mark course completed
            API->>+Notif: push("Course completed", to=student)
            Notif-->>-API: ok
        end
    else Already completed
        API->>API: Skip insert (idempotent)
    end
    API-->>-Frontend: CourseProgressOut
```

---

## Conclusion

Sprint 2 delivers the end-to-end course lifecycle. The hierarchical Course → Section → Subsection → Block model gives professors flexibility to build rich lessons, while students get a smooth path from discovery to enrollment to completion. This content backbone is what every later sprint — AI, gamification, communication — builds on.

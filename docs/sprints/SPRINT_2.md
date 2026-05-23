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

This diagram shows the course management subsystem: the frontend talks to `course_routes`, which delegates to a single course controller responsible for authoring, enrollment, and progress, with thumbnails and lesson media saved to the local file storage.

```mermaid
graph TD
    A["React Frontend<br/>(Professor + Student dashboards)"] -->|REST| B["course_routes.py<br/>Course · Section · Block · Enroll · Progress"]
    B --> C["course_controller.py<br/>Authoring · enrollment · progress"]
    C --> D["File Storage<br/>(uploads / thumbnails, blocks, materials)"]
    C --> E["SQLAlchemy ORM"]
    E -->|SQL| F[(Neon PostgreSQL)]
```

### Class Diagram — Course Hierarchy

The class diagram models the four-level content hierarchy (Course → Section → Subsection → LessonBlock), the engagement side (Enrollment + CourseProgress), and the feedback entity that captures one rating per student per course.

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

The use case diagram separates professor responsibilities (authoring and publishing) from student actions (discovering, enrolling, learning, and rating), showing the clear split in capabilities introduced by this sprint.

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

This sequence follows a professor from the initial course creation, through iteratively adding sections, subsections and blocks, to the final publish action that flips the visibility flag and triggers a background re-index for the AI tutor.

```mermaid
sequenceDiagram
    actor Professor
    participant Frontend
    participant Backend
    participant DB as Database

    Professor->>Frontend: Fill course form + pick thumbnail
    Frontend->>+Backend: POST /courses (multipart, Bearer token)
    Backend->>Backend: Authenticate + require_role("professor")
    alt Not a professor
        Backend-->>Frontend: 403 Forbidden
    else Authorised
        opt Thumbnail uploaded
            Backend->>Backend: Save file to /uploads/thumbnails
        end
        Backend->>+DB: INSERT Course (is_published=false)
        DB-->>-Backend: course row
        Backend-->>-Frontend: 201 CourseOut
    end

    loop For each section, subsection, block
        Professor->>Frontend: Add content
        Frontend->>+Backend: POST /sections | /subsections | /blocks
        Backend->>Backend: Verify ownership
        Backend->>+DB: INSERT row(s)
        DB-->>-Backend: rows
        Backend-->>-Frontend: created resource
    end

    Professor->>Frontend: Click Publish
    Frontend->>+Backend: PATCH /courses/{id}/publish
    Backend->>+DB: UPDATE is_published = true
    DB-->>-Backend: updated row
    Backend->>Backend: Trigger background re-index for RAG
    Backend-->>-Frontend: CourseOut(is_published=true)
```

### Sequence Diagram — Enrollment & Progress Tracking

This diagram traces a student from enrolling in a course to marking individual subsections complete, with explicit handling of duplicate enrollments, idempotent progress updates, and the 100% completion event that closes the learning loop.

```mermaid
sequenceDiagram
    actor Student
    participant Frontend
    participant Backend
    participant DB as Database

    Student->>Frontend: Click Enroll on a course
    Frontend->>+Backend: POST /courses/{id}/enroll (Bearer token)
    Backend->>Backend: Authenticate (JWT decode)
    Backend->>+DB: SELECT existing Enrollment
    DB-->>-Backend: result
    alt Already enrolled
        Backend-->>Frontend: 409 Conflict
    else Course not free
        Backend-->>Frontend: 402 Use Stripe checkout
    else Otherwise
        Backend->>+DB: INSERT Enrollment(status='active')
        DB-->>-Backend: enrollment row
        Backend->>Backend: Push notification to professor
        Backend-->>-Frontend: 201 EnrollmentOut
    end

    Note over Student,Backend: Later — learning the course

    Student->>Frontend: Mark subsection as done
    Frontend->>+Backend: POST /courses/{id}/progress
    Backend->>+DB: Was this item already completed?
    DB-->>-Backend: result
    alt First completion
        Backend->>+DB: INSERT CourseProgress
        DB-->>-Backend: row
        Backend->>Backend: Recompute progress %
        opt Progress reached 100%
            Backend->>Backend: Mark course completed
            Backend->>Backend: Push "Course completed" notification
        end
    else Already completed
        Backend->>Backend: Skip insert (idempotent)
    end
    Backend-->>-Frontend: CourseProgressOut
```

---

## Sprint Review

| Topic | Outcome |
|---|---|
| Review | Demonstrated the end-to-end course lifecycle: professor authoring (sections, subsections, blocks, materials, publish) and student journey (browse, enroll, progress tracking, feedback). All user stories met their Definition of Done. |
| Went well | The four-level content hierarchy (Course → Section → Subsection → LessonBlock) proved flexible enough to host text, image and video uniformly, and the file-storage layout under `/uploads` kept thumbnail and lesson media handling consistent. |
| To improve | Drag-and-drop reordering of sections and subsections was de-scoped to keep the sprint on schedule. Reorder endpoints and the matching UI should be added in a follow-up. |

---

## Conclusion

Sprint 2 delivers the end-to-end course lifecycle. The hierarchical Course → Section → Subsection → Block model gives professors flexibility to build rich lessons, while students get a smooth path from discovery to enrollment to completion. This content backbone is what every later sprint — AI, gamification, communication — builds on.

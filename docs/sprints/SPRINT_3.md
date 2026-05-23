# Sprint 3 — AI Learning Features

**Weeks 5–6**

## Introduction

Sprint 3 brings AI capabilities into the platform. Students gain a course-scoped AI tutor that answers questions grounded in the course content, plus auto-generated multiple-choice quizzes and on-demand course summaries. Professors get a PDF-to-course generator that turns an uploaded PDF into a draft course structure they can review, edit, and import.

## Sprint Goal

> Integrate AI features that help students learn (tutor, quizzes, summaries) and help professors author courses faster from existing PDF material.

---

## User Stories

### Student

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-3.1 | High | As a student, I can chat with an AI tutor that answers only from the course content | T-3.1.1: AI Tutor panel · T-3.1.2: RAG retrieval from Pinecone · T-3.1.3: Gemini answer |
| US-3.2 | High | As a student, I can use suggested prompts (summarize, key concepts, quiz me) | T-3.2.1: Prompt chips · T-3.2.2: Pre-fill chat input |
| US-3.3 | High | As a student, I can generate a multiple-choice quiz at chosen difficulty | T-3.3.1: QCM modal · T-3.3.2: Gemini quiz generation |
| US-3.4 | High | As a student, I can submit my quiz answers and get a score with pass/fail | T-3.4.1: Score endpoint · T-3.4.2: Save attempt |
| US-3.5 | Medium | As a student, I can view my quiz attempt history per course | T-3.5.1: History endpoint · T-3.5.2: History UI |
| US-3.6 | Medium | As a student, I can request an AI-generated summary of an entire course | T-3.6.1: Summary endpoint · T-3.6.2: Markdown viewer |

### Professor

| ID | Priority | Story | Subtasks |
|---|---|---|---|
| US-3.7 | High | As a professor, I can upload a PDF and have the AI propose a course structure | T-3.7.1: PDF upload · T-3.7.2: Background generation job |
| US-3.8 | High | As a professor, I can review and edit the generated draft before saving | T-3.8.1: Draft preview UI · T-3.8.2: Inline edit |
| US-3.9 | Medium | As a professor, I can import the generated draft into a real course | T-3.9.1: Import endpoint · T-3.9.2: Auto re-index for RAG |
| US-3.10 | Medium | As a professor, I can regenerate a single subsection at a different difficulty | T-3.10.1: Regenerate endpoint |

---

## Related Diagrams

### C4 Component View — AI Domain

```mermaid
graph TD
    A["React Frontend<br/>(AI Tutor · QCM · PDF Wizard)"] -->|REST| B["ai_routes.py<br/>chat · qcm · summary"]
    A -->|REST| C["course_generation_routes.py<br/>upload · poll · import"]
    B --> D["utils/rag.py<br/>Chunk · embed · query"]
    B --> E["utils/gemini.py<br/>LLM calls + TTL cache"]
    C --> F["utils/pdf_parser.py + course_generator.py"]
    D -->|vectors| G[(Pinecone)]
    E -.->|LLM| H[[Google Gemini]]
    F -.->|LLM| H
    B --> I["SQLAlchemy ORM"]
    C --> I
    I -->|SQL| J[(Neon PostgreSQL)]
```

### Class Diagram — AI-Related Entities

```mermaid
classDiagram
    class GeneratedCourse {
        UUID id
        UUID user_id
        string pdf_filename
        string status
        string difficulty
        json result
    }

    class QCMAttempt {
        UUID id
        UUID student_id
        UUID course_id
        UUID section_id
        string difficulty
        int score
        int total
        bool passed
    }

    class Course {
        string ai_summary
        datetime ai_summary_generated_at
    }

    GeneratedCourse "*" --> "1" User
    QCMAttempt "*" --> "1" User
    QCMAttempt "*" --> "1" Course
```

### Use Case Diagram — AI Features

```mermaid
graph LR
    S((Student))
    P((Professor))

    UC1([Ask AI Tutor])
    UC2([Use Suggested Prompts])
    UC3([Generate Quiz])
    UC4([Submit Quiz])
    UC5([View Quiz History])
    UC6([Request Course Summary])
    UC7([Upload PDF for Generation])
    UC8([Review Generated Draft])
    UC9([Regenerate Subsection])
    UC10([Import Generated Course])

    S --> UC1
    S --> UC2
    S --> UC3
    S --> UC4
    S --> UC5
    S --> UC6
    P --> UC7
    P --> UC8
    P --> UC9
    P --> UC10
```

### Sequence Diagram — AI Tutor (RAG Chat)

```mermaid
sequenceDiagram
    actor Student
    participant Frontend
    participant API as FastAPI
    participant Pinecone
    participant Gemini

    Student->>Frontend: Ask a question
    Frontend->>API: POST /ai/chat
    API->>Pinecone: Query top relevant chunks
    Pinecone-->>API: Course content snippets
    API->>Gemini: Prompt with chunks + question
    Gemini-->>API: Grounded answer
    API-->>Frontend: Reply text
```

### Sequence Diagram — PDF → Course Generation

```mermaid
sequenceDiagram
    actor Professor
    participant Frontend
    participant API as FastAPI
    participant Gemini
    participant DB as Neon PostgreSQL

    Professor->>Frontend: Upload PDF
    Frontend->>API: POST /course-gen/upload
    API->>DB: Insert job (status=processing)
    API-->>Frontend: job_id

    Note over API,Gemini: Background task
    API->>Gemini: Generate course outline
    Gemini-->>API: Sections + subsections JSON
    API->>DB: Update job (status=completed)

    Professor->>Frontend: Review + Import
    Frontend->>API: POST /course-gen/{job_id}/import
    API->>DB: Create real Course + Sections + Blocks
```

---

## Conclusion

Sprint 3 transforms Hub4Learners from a static content platform into an interactive learning environment. RAG-grounded answers, automated quizzes, and PDF-driven authoring meaningfully reduce friction for both learners and professors, while keeping AI output anchored to the actual course material.

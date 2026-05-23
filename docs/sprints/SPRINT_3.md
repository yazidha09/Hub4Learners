# Sprint 3 — AI Learning Features
**Weeks 5–6 | Story Points: 43**

## Introduction

Sprint 3 integrates the platform's AI capabilities, transforming passive content consumption into an interactive learning experience. Students gain access to an AI Tutor powered by a RAG pipeline (Pinecone + Gemini) that answers questions strictly grounded in course materials. Professors can generate an entire course structure from a PDF upload, and automated knowledge checks appear at the end of each lesson.

## Sprint Goal

> Integrate AI-powered learning capabilities into the platform, enabling students to interact with course content through an intelligent tutor, receive automated knowledge checks, and allowing professors to accelerate course creation through PDF-based AI generation.

---

## User Stories

### Student

| ID | Priority | User Story | Subtasks |
|---|---|---|---|
| US-19 | High | As a student, I can ask the AI Tutor questions about the current lesson and receive answers grounded in course materials | T-3.1: AI Tutor panel UI · T-3.2: POST /ai/chat · T-3.3: RAG retrieval from Pinecone · T-3.4: Gemini answer generation |
| US-20 | High | As a student, I can use suggested prompts (Summarize, Key concepts, Quiz me) to interact with the AI Tutor quickly | T-3.5: Prompt chip UI · T-3.6: Pre-fill chat input on click |
| US-21 | High | As a student, I receive AI-generated knowledge check questions at the end of each lesson | T-3.7: Knowledge check UI · T-3.8: GET /ai/qcm/{subsection_id} · T-3.9: Render QCM with scoring |
| US-22 | Medium | As a student, I can view an AI-generated summary of a discussion thread to catch up quickly | T-3.10: Summary button in discussion · T-3.11: POST /ai/summarize · T-3.12: Display summary card |

### Professor

| ID | Priority | User Story | Subtasks |
|---|---|---|---|
| US-23 | High | As a professor, I can generate a full course structure from an uploaded PDF | T-3.13: "Generate from PDF" button · T-3.14: POST /ai/generate-course · T-3.15: PDF parsing + Gemini structuring |
| US-24 | High | As a professor, I can review and edit the AI-generated course structure before saving | T-3.16: Preview/edit wizard UI · T-3.17: Confirm & save to DB |
| US-25 | Medium | As a professor, I can trigger AI generation of a quiz for any subsection | T-3.18: Generate quiz button · T-3.19: POST /ai/generate-qcm · T-3.20: Save questions to DB |

### System

| ID | Priority | User Story | Subtasks |
|---|---|---|---|
| US-26 | High | As the system, course materials are chunked, embedded, and indexed in Pinecone when uploaded | T-3.21: Sentence-aware chunker (1500 char target) · T-3.22: embedding-001 vectorisation · T-3.23: Pinecone upsert |
| US-27 | High | As the system, RAG queries retrieve only chunks above MIN_SCORE=0.40 | T-3.24: Cosine similarity filter · T-3.25: Top-k retrieval · T-3.26: Inject context into Gemini prompt |

---

## Related Diagrams

### C4 Component View — AI Learning Domain

```mermaid
graph TD
    A["React Frontend\nTypeScript + Vite"] -->|REST| B["ai_routes.py\nRAG chat · QCM · PDF endpoints"]
    B --> C["ai_controller.py\nOrchestrates RAG pipeline\nPDF parsing · quiz generation"]
    C --> D["utils/rag.py\nSentence-aware chunking\nPinecone upsert · query"]
    C --> E["utils/gemini.py\nGemini 3.1 Flash Lite\nTTL cache 6h · 256 entries"]
    C --> F["Data Access\nSQLAlchemy · Course · GeneratedCourse"]
    F -->|SQL| G[("Neon PostgreSQL")]
    D -->|Vectors| H[["Pinecone\nVector DB"]]
    E -->|API call| I[["Google Gemini API"]]
```

### Class Diagram — AI Models

```mermaid
classDiagram
    class GeneratedCourse {
        +int id
        +int professor_id
        +str title
        +json structure
        +str source_pdf
        +datetime generated_at
    }

    class ChatRequest {
        +int id
        +int user_id
        +int subsection_id
        +str question
        +str answer
        +float score
        +datetime created_at
    }

    class QCMQuestion {
        +int id
        +int subsection_id
        +str question
        +list options
        +int correct_index
        +str explanation
    }

    GeneratedCourse "*" --> "1" User
    ChatRequest "*" --> "1" User
    ChatRequest "*" --> "1" CourseSubsection
    QCMQuestion "*" --> "1" CourseSubsection
```

### Sequence Diagram — RAG Chat Flow

```mermaid
sequenceDiagram
    actor Student
    participant Frontend
    participant FastAPI
    participant Pinecone
    participant Gemini

    Student->>Frontend: Type question in AI Tutor panel
    Frontend->>FastAPI: POST /ai/chat { question, subsection_id }
    FastAPI->>FastAPI: Embed question (embedding-001)
    FastAPI->>Pinecone: Query top-k vectors (MIN_SCORE=0.40)
    Pinecone-->>FastAPI: Relevant content chunks
    FastAPI->>Gemini: Prompt = context chunks + question
    Gemini-->>FastAPI: Grounded answer
    FastAPI->>Neon PostgreSQL: Save ChatRequest record
    FastAPI-->>Frontend: { answer }
    Frontend-->>Student: Display answer in tutor panel
```

### Sequence Diagram — PDF Course Generation

```mermaid
sequenceDiagram
    actor Professor
    participant Frontend
    participant FastAPI
    participant Gemini
    participant Neon PostgreSQL

    Professor->>Frontend: Upload PDF + click Generate
    Frontend->>FastAPI: POST /ai/generate-course (multipart)
    FastAPI->>FastAPI: Parse PDF · extract text chunks
    FastAPI->>Gemini: Prompt: generate course structure from text
    Gemini-->>FastAPI: JSON structure (sections + subsections)
    FastAPI-->>Frontend: Preview course structure
    Professor->>Frontend: Review and confirm
    Frontend->>FastAPI: POST /courses (confirmed structure)
    FastAPI->>Neon PostgreSQL: INSERT Course + Sections + Subsections
    Neon PostgreSQL-->>FastAPI: records
    FastAPI-->>Frontend: Course created
    Frontend-->>Professor: Redirect to course editor
```

---

## Conclusion

Sprint 3 elevated Hub4Learners from a content delivery platform to an intelligent learning environment. The RAG pipeline, built on Pinecone vector search and Google Gemini generation, ensures AI answers are accurate and course-scoped. The PDF-to-course generator significantly reduces professor onboarding time, and knowledge checks provide immediate feedback loops for students. The TTL caching layer on Gemini calls ensures performance remains consistent under load.

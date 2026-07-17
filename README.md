# Hub4Learners

An AI-powered e-learning platform. Professors publish free or paid courses (PDF, video, audio), students enroll and learn, and an AI layer generates course content, quizzes, and recaps from the uploaded material.

Built as a FastAPI + React monorepo with PostgreSQL, Gemini for generation, Pinecone for retrieval, and Stripe for payments.

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Running the app](#running-the-app)
- [User roles](#user-roles)
- [API overview](#api-overview)
- [Further documentation](#further-documentation)

---

## Features

**Courses**
- Professors create courses organised into sections and subsections, with a rich-text lesson builder (TipTap).
- Materials upload as PDF, video, or audio. PDFs are parsed server-side with PyMuPDF.
- Courses are grouped by category and can be free or paid.
- Students enroll, track progress per lesson, and leave feedback.

**AI**
- **Course generation** — build a structured course from source material via Gemini.
- **QCM (multiple-choice quizzes)** — auto-generated from lesson content, with attempt tracking.
- **Recaps** — condensed summaries of a lesson or course.
- Retrieval-augmented generation backed by a Pinecone vector index, so answers are grounded in the course's own material rather than the model's general knowledge.

**Social and engagement**
- Gamification: XP, levels, badges, achievements, streaks, and leaderboards.
- Per-lesson discussion threads.
- Friend requests and real-time direct messaging over WebSockets.
- Notifications and university-wide announcements.

**Platform**
- JWT authentication with four roles.
- University/organisation accounts with join requests.
- Stripe checkout for paid courses and Pro professor upgrades.
- Analytics dashboards for both students and professors.
- Admin dashboard for platform-level management.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 3, React Router 7 |
| Editor / viewers | TipTap 3, react-pdf, react-markdown |
| Backend | FastAPI, Uvicorn, SQLModel, Python 3.11+ |
| Database | PostgreSQL (via psycopg2) |
| AI | Google Gemini (`google-generativeai`), Pinecone vector DB |
| Auth | python-jose (JWT, HS256), passlib + bcrypt |
| Payments | Stripe |
| Real-time | WebSockets |
| Package managers | `uv` (backend), `npm` (frontend) |

---

## Repository layout

```
Hub4Learners/
├── backend/                  FastAPI application
│   ├── app/
│   │   ├── main.py           App entry point: CORS, routers, startup migrations, seeding
│   │   ├── database.py       SQLAlchemy engine, session factory, get_db dependency
│   │   ├── websocket_manager.py
│   │   ├── models/           SQLModel tables (users, courses, enrollment, gamification, …)
│   │   ├── schemas/          Pydantic request/response models
│   │   ├── routes/           Route definitions, mounted under /api
│   │   ├── controller/       Business logic per domain
│   │   └── utils/            gemini, rag, pdf_parser, security, stripe_client, leveling
│   └── pyproject.toml
│
├── frontend/                 React + Vite single-page app
│   └── src/
│       ├── api/              One typed module per backend domain
│       ├── pages/            Route-level screens (dashboards, login, learning page)
│       ├── components/       Shared UI, incl. components/gamification/
│       ├── context/          AuthContext, GamificationContext
│       └── hooks/            useNotifications, useSettings
│
├── docs/                     Use case + class diagrams, sprint plans (SPRINT_1..6)
├── markdown/                 Per-feature design docs and the PFE report
└── generate_*.py             Scripts that build the .pptx presentation decks
```

The `generate_*.py` scripts at the repo root and the `.pptx` files they produce are project/report deliverables. They are not part of the running application.

---

## Prerequisites

- **Python 3.11+** and [`uv`](https://docs.astral.sh/uv/getting-started/installation/)
- **Node.js 18+** and npm
- **PostgreSQL** database (the project uses [Neon](https://neon.tech), but any Postgres instance works)
- API keys for **Google Gemini**, **Pinecone**, and **Stripe** (test keys are fine for local development)

---

## Getting started

```bash
git clone https://github.com/yazidha09/Hub4Learners.git
cd Hub4Learners
```

### Backend

```bash
cd backend
uv sync
```

Create `backend/.env` — see [Configuration](#configuration) for the variable names.

```bash
uv run uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

On first startup the app creates all tables, runs its migrations, and seeds the default categories and gamification data. There is no separate migration command to run.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is now at `http://localhost:5173`.

Start the backend first — the frontend calls it on startup and will show errors if port 8000 is not answering.

---

## Configuration

Backend configuration lives in `backend/.env`, loaded by `python-dotenv` at startup.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string, e.g. `postgresql+psycopg2://user:pass@host/db?sslmode=require` |
| `SECRET_KEY` | yes | Signing key for JWTs. Use a long random value. |
| `gemini_api_key` | yes | Google Gemini — powers course generation, QCM, recaps, embeddings |
| `Pinecone_api_key` | yes | Pinecone — vector store for RAG |
| `PINECONE_INDEX` | no | Pinecone index name. Defaults to `hub4learners`. |
| `Stripe_secret_key` | for payments | Stripe server-side API key |
| `Stripe_publishable_key` | for payments | Stripe client-side key |

Example `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg2://user:password@host/dbname?sslmode=require
SECRET_KEY=replace-with-a-long-random-string
gemini_api_key=your-gemini-key
Pinecone_api_key=your-pinecone-key
PINECONE_INDEX=hub4learners
Stripe_secret_key=sk_test_...
Stripe_publishable_key=pk_test_...
```

Never commit `.env`. It is already covered by `.gitignore`.

### Notes on current configuration

A few values are presently hardcoded in the source rather than read from the environment. If you are setting this project up fresh, these are the places to change:

- **`app/database.py`** holds `DATABASE_URL` as a literal. Replace it with `os.getenv("DATABASE_URL")`.
- **`app/utils/security.py`** holds `SECRET_KEY` as a literal placeholder. Replace it with `os.getenv("SECRET_KEY")` — the JWT signing key must not ship in source.
- **`frontend/src/api/_client.ts`** hardcodes `API_BASE = 'http://localhost:8000/api'`. For any non-local deployment, read it from `import.meta.env.VITE_API_BASE` instead.
- **CORS** in `app/main.py` allows only `http://localhost:5173` and `http://127.0.0.1:5173`. Add your deployed origin before going live.
- Env var casing is inconsistent (`gemini_api_key` vs `PINECONE_INDEX`). The Stripe helper accepts either case; the others are matched exactly as written above.

---

## Running the app

| | Command | URL |
|---|---|---|
| Backend (dev) | `uv run uvicorn app.main:app --reload --port 8000` | http://localhost:8000 |
| API docs | — | http://localhost:8000/docs |
| Frontend (dev) | `npm run dev` | http://localhost:5173 |
| Frontend (build) | `npm run build` | output in `frontend/dist` |
| Frontend (preview build) | `npm run preview` | — |
| Lint frontend | `npm run lint` | — |

To try it end to end: register at `http://localhost:5173`, create an account as a professor, publish a course with a PDF, then register a student in a second browser profile and enroll.

---

## User roles

The `role` field on a user is one of:

| Role | Can do |
|---|---|
| `student` | Enroll in courses, learn, take quizzes, earn XP, discuss, message friends |
| `professor` | Everything a student can, plus create and publish courses, use AI generation, view course analytics. Pro upgrade unlocks paid courses. |
| `university_admin` | Manage their university's members, handle join requests, post announcements |
| `super_admin` | Platform-wide administration via the admin dashboard |

Roles are stored as a plain string column, not a database enum — the values above are enforced in application logic.

---

## API overview

All HTTP routes are mounted under `/api`; WebSockets are served from `/ws` without the prefix.

| Prefix | Area |
|---|---|
| `/api/auth` | Register, login, current user, profile updates |
| `/api/courses` | Course CRUD, sections, materials, enrollment, progress |
| `/api/categories` | Course categories |
| `/api/ai` | AI features (recaps, QCM) |
| `/api/course-gen` | AI course generation: upload, job status, import into a course |
| `/api/discussions` | Lesson discussion threads |
| `/api/friends` | Friend requests and direct messages |
| `/api/notifications` | User notifications |
| `/api/announcements` | University announcements |
| `/api/gamification` | XP, levels, badges, achievements, leaderboard |
| `/api/payments`, `/api/billing` | Stripe checkout and subscriptions |
| `/api/org` | Universities and join requests |
| `/api/admin` | Admin dashboard operations |
| `/api/public` | Unauthenticated endpoints (platform stats) |

WebSocket endpoints are served outside the `/api` prefix:

| Path | Purpose |
|---|---|
| `/ws/notifications/{user_id}` | Live notification stream |
| `/ws/friends/{friendship_id}` | Live direct-message channel |

Authenticated requests carry a bearer token:

```
Authorization: Bearer <jwt>
```

Tokens are HS256-signed and expire after 60 minutes.

Full interactive documentation is generated by FastAPI at `/docs` while the backend is running.

---

## Further documentation

**`docs/`** — diagrams and planning
- `Hub4Learners_Global_Use_Case_Diagram.md` / `.drawio` — global use case diagram
- `class_diagram.md` — domain model
- `sprints/SPRINT_1.md` … `SPRINT_6.md` — sprint-by-sprint scope

**`markdown/`** — per-feature deep dives
- `Hub4Learners_PFE_Report.md` — the full project report
- `Hub4Learners_Mermaid_Diagrams.md` — architecture and flow diagrams
- `AI_Course_Generation_Documentation.md`, `AI_QCM_Documentation.md`, `AI_Course_Recap_Documentation.md`
- `JWT_Auth_Documentation.md`, `Gamification_Documentation.md`, `Notification_System_Documentation.md`
- `Course_Management_Documentation.md`, `Course_Content_Builder_Documentation.md`, `Course_Category_Documentation.md`
- `Discussion_Documentation.md`, `Chat_Request_Documentation.md`, `Announcements_Notifications_Documentation.md`
- `Student_Analytics_Documentation.md`, `Learner_Analytics_Documentation.md`, `Admin_Dashboard_Documentation.md`
- `Professor_Upgrade_Documentation.md`, `Performance_Optimization_Report.md`, `RealTime_Loading_Documentation.md`

Start with the PFE report for the whole picture, then the feature doc for whatever you're touching.

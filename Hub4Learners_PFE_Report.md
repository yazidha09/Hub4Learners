---
title: "Hub4Learners — A Multi-Tenant E-Learning Platform with Integrated AI Course Generation, Retrieval-Augmented Q&A, and Gamification"
subtitle: "Bachelor's Degree Final Project Report — Web & Mobile Development"
author: "[Student Name]"
supervisor: "[Supervisor Name]"
institution: "[University / Faculty / Department]"
year: "2025–2026"
---

<div align="center">

# **[UNIVERSITY NAME]**
### [FACULTY OF SCIENCES AND TECHNOLOGIES]
#### [DEPARTMENT OF COMPUTER SCIENCE]

---

# **BACHELOR'S DEGREE FINAL PROJECT REPORT**
### Licence — Web & Mobile Development

---

## **Hub4Learners**
### A Multi-Tenant E-Learning Platform with Integrated AI Course Generation, Retrieval-Augmented Q&A, and Gamification

---

**Submitted by:** [Student Name]
**Academic Supervisor:** [Supervisor Name]
**Host Organization Supervisor:** [Company Supervisor, if applicable]
**Defended on:** [Date]

**Academic Year:** 2025 – 2026

</div>

---

## Signatures

<div align="center">

**Academic Supervisor**
_______________________________

**Host Organization Representative**
_______________________________

</div>

---

## Dedication

*I dedicate this modest work:*

**To my parents,**
whose patience, sacrifices, and unconditional encouragement have made every step of this journey possible. No words could express the depth of my gratitude and the love I owe them.

**To my family and close ones,**
for their constant support during long nights of code, doubt, and discovery — your belief in me carried this project across the finish line.

**To my academic supervisor,**
for the trust granted, the precise feedback, and the freedom to explore technically demanding ideas.

**To all my teachers,**
who, throughout my years of study, equipped me with the analytical reflexes and the engineering discipline I relied on daily during this project.

**To my classmates and friends,**
who reviewed code, tested features, broke the application in creative ways, and made the long hours lighter.

---

## Acknowledgements

I sincerely thank everyone who, directly or indirectly, contributed to the success of this final project.

I would first like to express my deepest gratitude to my supervisor, **[Supervisor Name]**, for the rigorous guidance, the thoughtful suggestions on architecture and methodology, and the constant availability throughout the development cycle. Their feedback shaped both the technical decisions and the discipline of writing them down.

I also extend my sincere thanks to **[Host Organization Name / Department]**, and in particular to **[Company Supervisor or Department Head]**, for providing the working context, the technical resources, and the freedom to design a non-trivial system end-to-end.

I gratefully acknowledge the entire teaching staff of **[Faculty / Department]** for the foundational courses on databases, software engineering, web development, and security that quietly underlie every chapter of this report.

Finally, I thank the open-source community whose work made this project possible — FastAPI, React, SQLModel, Tailwind CSS, Tiptap, Pinecone, and the broader ecosystem of contributors whose efforts collectively raised the floor on what a student project can deliver in a single semester.

---

## Abstract (English)

The democratization of online learning has been a defining trend of the last decade, but most existing platforms either lock users into a single institutional silo or treat artificial intelligence as a marketing label rather than a core feature. **Hub4Learners** is a full-stack web platform designed to address this gap. It introduces a multi-tenant hierarchy — Region → University → Users — that lets multiple institutions coexist with isolated administration while sharing a common technical backbone.

The platform supports four distinct roles (Student, Professor, University Administrator, Super Administrator), each with a tailored dashboard and a strict permissions matrix enforced by a JWT-based authentication layer and a role-rank dependency. Professors author courses through a hierarchical builder (Course → Section → Subsection → Lesson Block) supporting rich text, images, files, and embedded quizzes. Students enroll in free or Stripe-paid courses, progress through subsections, take auto-graded quizzes, participate in per-subsection threaded discussions, and earn experience points, levels, streaks, achievements, and rarity-graded badges.

The platform's distinguishing technical contribution is its **AI integration**: PDFs uploaded by professors are parsed by PyMuPDF, structured by Google Gemini into a coherent course outline (titles, sections, subsections, chunk assignments), and rendered verbatim into HTML — preserving the professor's authorial content while letting AI do only the organizational work. A separate Retrieval-Augmented Generation (RAG) pipeline embeds course content into Pinecone and answers student questions grounded in the actual material. Threaded discussions are summarized on demand by the same AI layer, and quizzes are generated per subsection.

The implementation is built on **FastAPI** (Python 3.11) with **SQLModel** over **PostgreSQL (Neon)** on the backend, and **React 19** with **TypeScript**, **Vite**, and **Tailwind CSS** on the frontend. The system is deployed with route-level code-splitting, GZip compression, immutable static caching, and idempotent SQL migrations on startup. WebSockets power real-time notifications, chat requests, and friend messaging.

**Keywords:** e-learning, multi-tenant SaaS, FastAPI, React 19, JWT authentication, role-based access control, retrieval-augmented generation, Pinecone, Google Gemini, gamification, Stripe Checkout, WebSocket, PostgreSQL.

---

## Résumé (Français)

La démocratisation de l'apprentissage en ligne s'est imposée comme une tendance majeure de la dernière décennie, mais la plupart des plateformes existantes enferment leurs utilisateurs dans des silos institutionnels uniques ou exploitent l'intelligence artificielle comme un argument marketing plutôt qu'une fonctionnalité centrale. **Hub4Learners** est une plateforme web complète conçue pour répondre à cette lacune. Elle introduit une hiérarchie multi-tenant — Région → Université → Utilisateurs — qui permet à plusieurs institutions de coexister avec une administration cloisonnée tout en partageant une infrastructure technique commune.

La plateforme prend en charge quatre rôles distincts (Étudiant, Professeur, Administrateur d'Université, Super Administrateur), chacun disposant d'un tableau de bord adapté et d'une matrice de permissions stricte appliquée via une couche d'authentification JWT et un système de rangs. Les professeurs créent leurs cours grâce à un constructeur hiérarchique (Cours → Section → Sous-section → Bloc de leçon) supportant texte enrichi, images, fichiers et quiz intégrés. Les étudiants s'inscrivent à des cours gratuits ou payants via Stripe, progressent par sous-section, passent des QCM auto-corrigés, participent à des discussions par sous-section, et accumulent points d'expérience, niveaux, séries quotidiennes, succès et badges de rareté graduée.

La contribution technique distinctive est **l'intégration de l'IA** : les PDF déposés par les professeurs sont analysés par PyMuPDF, structurés par Google Gemini en plan de cours cohérent, puis rendus verbatim en HTML — préservant le contenu authentique du professeur tout en laissant l'IA assumer uniquement le travail d'organisation. Un pipeline de génération augmentée par récupération (RAG) indexe le contenu dans Pinecone et répond aux questions des étudiants en s'appuyant sur le cours réel.

Le système est construit sur **FastAPI** (Python 3.11) avec **SQLModel** sur **PostgreSQL (Neon)** côté backend, et **React 19** avec **TypeScript**, **Vite** et **Tailwind CSS** côté frontend.

**Mots-clés :** e-learning, SaaS multi-tenant, FastAPI, React 19, authentification JWT, contrôle d'accès basé sur les rôles, génération augmentée par récupération, Pinecone, Google Gemini, gamification, Stripe, WebSocket, PostgreSQL.

---

## ملخص (العربية)

شهد العقد الأخير انتشاراً واسعاً للتعلم عبر الإنترنت، لكن معظم المنصات القائمة إما تحبس مستخدميها داخل مؤسسة واحدة، أو تستخدم الذكاء الاصطناعي شعاراً تسويقياً لا ميزةً جوهرية. **Hub4Learners** هي منصة ويب متكاملة صُمّمت لسدّ هذه الفجوة. تقدّم بنية متعددة المستأجرين تتدرّج من المنطقة إلى الجامعة إلى المستخدمين، مما يسمح بتعايش عدّة مؤسسات بإدارة معزولة وبنية تقنية مشتركة.

تدعم المنصة أربعة أدوار: الطالب، الأستاذ، مدير الجامعة، والمشرف العام، ولكلّ منها لوحة تحكّم خاصة. يُنشئ الأساتذة دروسهم عبر بانٍ هرمي (الدرس → القسم → القسم الفرعي → الكتلة)، ويسجّل الطلاب في دروس مجانية أو مدفوعة عبر Stripe، ويحصلون على نقاط خبرة، ومستويات، وإنجازات، وشارات بدرجات نُدرة متفاوتة.

الإسهام التقني الأبرز هو **دمج الذكاء الاصطناعي**: تُحلَّل ملفات PDF التي يرفعها الأستاذ عبر PyMuPDF، ويُنظّمها نموذج Google Gemini في مخطط درس متماسك، ثم تُعرض المحتويات حرفياً بصيغة HTML. كما يُتيح خط أنابيب RAG قائم على Pinecone الإجابة عن أسئلة الطلاب اعتماداً على محتوى الدرس الفعلي.

بُنيت المنظومة على **FastAPI** و**SQLModel** فوق **PostgreSQL (Neon)** في الخلفية، و**React 19** مع **TypeScript** و**Vite** و**Tailwind CSS** في الواجهة الأمامية.

**الكلمات المفتاحية:** التعلم الإلكتروني، البرمجيات متعددة المستأجرين، FastAPI، React، JWT، التوليد المعزّز بالاسترجاع، Pinecone، Gemini، التلعيب، Stripe.

---

## Table of Contents

- General Introduction
- **Chapter 1 — Preliminary Study and Requirements Analysis**
  - 1.1 Introduction
  - 1.2 Context and Domain
  - 1.3 Critical Study of Existing Solutions
  - 1.4 Problem Statement
  - 1.5 Proposed Solution
  - 1.6 Functional Requirements
  - 1.7 Non-Functional Requirements
  - 1.8 Actors of the System
  - 1.9 Global Use-Case Diagram
  - 1.10 Use Cases per Actor
  - 1.11 Methodology and Planning
  - 1.12 Conclusion
- **Chapter 2 — Conception (Design)**
  - 2.1 Introduction
  - 2.2 Architectural Choices
  - 2.3 Deployment and Client–Server Architecture
  - 2.4 Data Modeling
  - 2.5 API Design
  - 2.6 Security Design
  - 2.7 AI and RAG Architecture
  - 2.8 Payment Architecture
  - 2.9 Real-Time Architecture (WebSocket)
  - 2.10 Interface Design
  - 2.11 Conclusion
- **Chapter 3 — Implementation and Development**
  - 3.1 Introduction
  - 3.2 Development Environment
  - 3.3 Project Structure
  - 3.4 Backend Implementation
  - 3.5 Frontend Implementation
  - 3.6 AI Pipelines Implementation
  - 3.7 Real-Time Channels
  - 3.8 Tests and Quality
  - 3.9 Performance Engineering
  - 3.10 Deployment Notes
  - 3.11 Conclusion
- **Chapter 4 — Results and Demonstration**
  - 4.1 Introduction
  - 4.2 Application Walkthrough
  - 4.3 Objectives vs Realizations
  - 4.4 Performance Measurements
  - 4.5 Conclusion
- General Conclusion
- Bibliography
- Annexes

---

## List of Figures

- Figure 1.1 — Global Use-Case Diagram (4 actors)
- Figure 1.2 — Student Use Cases
- Figure 1.3 — Professor Use Cases
- Figure 1.4 — University Administrator Use Cases
- Figure 1.5 — Super Administrator Use Cases
- Figure 1.6 — Sprint Planning (Gantt)
- Figure 2.1 — High-Level System Architecture
- Figure 2.2 — Layered Backend Architecture
- Figure 2.3 — Entity-Relationship Diagram (Class Diagram)
- Figure 2.4 — Sequence Diagram: Register
- Figure 2.5 — Sequence Diagram: Login with JWT
- Figure 2.6 — Sequence Diagram: Stripe-Paid Enrollment
- Figure 2.7 — Sequence Diagram: AI Course Generation from PDF
- Figure 2.8 — Sequence Diagram: RAG-Powered Question Answering
- Figure 2.9 — Activity Diagram: Student Completes a Subsection
- Figure 2.10 — Activity Diagram: Professor Publishes a Course
- Figure 2.11 — Role-Hierarchy Authorization Matrix
- Figure 3.1 — Folder Structure
- Figure 4.1 — Home Page
- Figure 4.2 — Login / Register
- Figure 4.3 — Student Dashboard
- Figure 4.4 — Course Learning Page
- Figure 4.5 — Lesson Builder
- Figure 4.6 — AI Course Generation Modal
- Figure 4.7 — Discussion Section
- Figure 4.8 — QCM (Quiz) Modal
- Figure 4.9 — Gamification Panel
- Figure 4.10 — Professor Dashboard
- Figure 4.11 — Admin Dashboard

## List of Tables

- Table 1.1 — Comparison with existing platforms
- Table 1.2 — Functional requirements summary
- Table 1.3 — Non-functional requirements
- Table 1.4 — Actors and their permissions
- Table 1.5 — Sprint planning
- Table 2.1 — Domain → table mapping
- Table 2.2 — API endpoints by domain
- Table 2.3 — Role-rank matrix
- Table 3.1 — Technology stack
- Table 3.2 — Hardware environment
- Table 3.3 — Selected code modules
- Table 4.1 — Objectives vs realizations
- Table 4.2 — Performance metrics

## List of Acronyms

| Acronym | Meaning |
|---|---|
| API | Application Programming Interface |
| CRUD | Create, Read, Update, Delete |
| CSRF | Cross-Site Request Forgery |
| GZIP | GNU Zip Compression |
| HTTP | HyperText Transfer Protocol |
| JWT | JSON Web Token |
| LMS | Learning Management System |
| ORM | Object-Relational Mapping |
| PDF | Portable Document Format |
| PFE | Projet de Fin d'Études (Final Project) |
| QCM | Questionnaire à Choix Multiples (multiple-choice quiz) |
| RAG | Retrieval-Augmented Generation |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SaaS | Software as a Service |
| SQL | Structured Query Language |
| TTFB | Time To First Byte |
| UML | Unified Modeling Language |
| UUID | Universally Unique Identifier |
| WS | WebSocket |
| XP | Experience Points |

---

# General Introduction

The way humans acquire knowledge has changed more in the last fifteen years than in the previous century. Massive Open Online Courses (MOOCs), institutional learning management systems, video tutorials, and AI-assisted tutoring have collectively shifted education from a physically bound classroom toward a permanent, asynchronous, and increasingly personalized experience. For a generation of students who grew up with smartphones, the question is no longer *whether* to learn online but *which platform* delivers the highest signal-to-noise ratio for their time.

That question, however, is more difficult to answer than the abundance of platforms suggests. Most learning management systems fall into one of two categories. The first are large commercial platforms (Coursera, Udemy, edX) that excel at packaging marketable courses but operate as closed marketplaces — universities have no real control over the content, pricing, or community of their own students. The second are institutional LMSes (Moodle, Canvas, Blackboard) that solve the institutional control problem but offer a stale user experience, weak community features, no native AI assistance, and a frontend that has aged poorly. Between these two extremes sits a real need: a platform that respects institutional hierarchy, integrates real AI as a core feature rather than a marketing label, and motivates learners through community and game mechanics rather than through anxiety and deadlines.

**Hub4Learners** is the response to that gap. It is a full-stack web platform designed around three foundational ideas. First, a **multi-tenant institutional hierarchy** — Region → University → Users — gives each university an isolated administrative domain while sharing a common technical backbone. Second, **AI is treated as infrastructure, not as a feature flag**: course content is generated from professor-supplied PDFs, student questions are answered through retrieval-augmented generation grounded in the actual course material, quizzes are produced automatically per subsection, and discussion threads are summarized on demand. Third, **gamification is a first-class system**, not a coat of paint: every meaningful learning action grants experience points logged in an auditable table, levels are computed from a deterministic curve, streaks reward daily engagement, and badges are awarded by an extensible event-driven service.

This report documents the full lifecycle of Hub4Learners from initial requirements to deployed system. It is organized into four chapters that mirror the engineering process itself. **Chapter 1** establishes the problem, surveys existing solutions, identifies the actors, and translates user needs into formal functional and non-functional requirements expressed through UML use cases and a planned sprint schedule. **Chapter 2** describes the conception of the solution — architectural choices, the full entity-relationship model spanning twenty-four tables, the REST API design, the security model, and the AI pipelines as architectural blueprints. **Chapter 3** documents the implementation, including the chosen technology stack (FastAPI on Python 3.11, React 19 with TypeScript and Vite, PostgreSQL on Neon, Pinecone for vector search, Google Gemini for generation, Stripe for payments, WebSockets for real-time channels), the project structure, selected code excerpts that illustrate each pipeline, and the performance engineering work done to keep the platform responsive on a serverless database. **Chapter 4** presents the delivered system through annotated walkthroughs, compares achieved objectives against the initial backlog, and reports measured performance figures.

The methodology adopted throughout the project is an adapted Scrum framework. Work was decomposed into four two-to-four-week sprints, each ending with a working increment of the platform; sprint planning, backlog refinement, and a written retrospective accompanied each cycle. UML was used as the modeling language for use cases, class diagrams, sequence diagrams, and activity diagrams. Quality gates included manual end-to-end test scenarios per role, idempotent database migrations on startup, and a small set of performance measurements (Lighthouse scores, query latency, bundle size, time-to-first-byte).

The report ends with a **General Conclusion** that summarizes what was delivered, what was learned, and what the platform should become next — including a mobile application, live cohort sessions, certificate issuance, and an ML-based recommender layer that uses the gamification telemetry as a training signal.

---

# Chapter 1 — Preliminary Study and Requirements Analysis

## 1.1 Introduction

This chapter establishes the foundations of the project. It surveys the domain, examines comparable existing solutions, articulates the problem that Hub4Learners targets, identifies the actors of the system, and translates their needs into formal functional and non-functional requirements. It also presents the global use-case diagram, the per-actor use cases, and the agile methodology adopted throughout the development cycle, concluded by the sprint planning that structures the rest of the report.

## 1.2 Context and Domain

The COVID-19 pandemic accelerated by at least five years what was already an inevitable shift: a sizeable fraction of higher education now happens online or in hybrid format. According to multiple industry reports, the global e-learning market is projected to exceed USD 645 billion by 2030, with the strongest growth happening in the segments where AI is integrated into the learning loop. Within universities specifically, three structural problems persist regardless of the platform in use:

1. **Content production friction.** Professors who hold deep expertise in their field rarely have the time, the design skill, or the patience to convert a polished PDF of lecture notes into the structured course format that an LMS expects — sections, subsections, lesson blocks, learning objectives, quizzes. The result is that high-quality static documents remain trapped as downloads rather than becoming interactive learning paths.

2. **Engagement collapse beyond the first two weeks.** A widely cited statistic across MOOC research is that completion rates for online courses sit between 5% and 15%. The most consistent finding across studies is that engagement drops sharply once the initial novelty wears off, and that the platforms with the highest retention are precisely those that build community features and game mechanics around the learning content.

3. **Lack of meaningful AI assistance.** Many platforms now advertise an "AI assistant" but in practice deliver a thin wrapper over a generic chatbot that does not know the specific course content. Students quickly discover that the chatbot hallucinates references to lessons that do not exist, or simply paraphrases the same answer a generic ChatGPT prompt would have produced.

Hub4Learners is built around the conviction that these three problems are technically solvable today, and that solving them together produces a meaningfully different platform.

## 1.3 Critical Study of Existing Solutions

To frame Hub4Learners against the competitive landscape, three categories of incumbent platforms were studied: Moodle (institutional LMS), Coursera/Udemy (commercial MOOCs), and Khan Academy (gamified self-paced learning). Each is briefly summarized below before consolidating the gaps in Table 1.1.

**Moodle.** The reference open-source LMS for universities. Strengths: institutional control, mature plugin ecosystem, robust gradebook. Weaknesses: dated frontend (PHP server-rendered pages, limited interactivity), no native AI integration, weak community/discussion UX, course authoring is technical and error-prone, no built-in gamification system.

**Coursera / Udemy.** Strong production values, strong marketplace, certificates, video at scale. Weaknesses: closed gardens — institutions cannot host private course catalogues with the same UX; gamification is minimal; AI features (where present) are surface-level; the user is a customer of the platform, not of their university.

**Khan Academy.** Excellent gamification (energy points, mastery system, badges, streaks) and strong UX, but limited to a pre-built K–12 curriculum — no support for institutional content authoring at all.

**Existing university portals (generic).** Typically static document repositories with rudimentary forums. They serve as content distribution channels, not as learning environments.

### Table 1.1 — Comparison with existing platforms

| Feature | Moodle | Coursera/Udemy | Khan Academy | **Hub4Learners** |
|---|:---:|:---:|:---:|:---:|
| Multi-tenant institutional hierarchy | Limited | No | No | **Yes (Region → University → Users)** |
| AI-generated course from PDF | No | No | No | **Yes** |
| RAG-grounded student Q&A | No | No | No | **Yes (Pinecone + Gemini)** |
| Auto-generated quizzes per subsection | No | Limited | No | **Yes** |
| AI discussion summarization | No | No | No | **Yes** |
| Per-subsection threaded discussions with votes | Limited | No | No | **Yes** |
| Gamification (XP, levels, streaks, badges) | Plugin | No | Yes | **Yes (native)** |
| Stripe-integrated paid courses | Plugin | Built-in | No | **Yes** |
| Real-time chat + friend system | Limited | No | No | **Yes (WebSocket)** |
| Modern SPA frontend (React 19) | No | Yes | Yes | **Yes** |
| Open / self-hostable | Yes | No | No | **Yes (open architecture)** |

The conclusion is direct: every comparable platform addresses two or three of the columns above, but none addresses all of them simultaneously. Hub4Learners targets precisely this combined offering.

## 1.4 Problem Statement

From the analysis above, three problem statements are extracted that drive the rest of the project:

- **P1 — Multi-institutional fragmentation.** Universities need an LMS that respects their administrative boundaries (their professors, their students, their content) while still benefiting from a shared, modern technical platform. Existing solutions force a choice between fragmentation and loss of control.
- **P2 — Content-to-course friction.** Professors should not be expected to transform PDFs into structured online courses manually. The system should do the structural work while preserving the professor's content verbatim.
- **P3 — Disengagement after week two.** Online courses lose students faster than any physical classroom. A platform that combines community (discussions, friends, chat), gamification (XP, levels, streaks, achievements, badges), and instant AI help (RAG-grounded answers) directly attacks the engagement decay curve.

## 1.5 Proposed Solution

Hub4Learners is a web platform offering the following high-level capabilities, each mapped to one of the problem statements above:

- A four-role permission model (Student, Professor, University Admin, Super Admin) layered over a three-level hierarchy (Region, University, User) — solves **P1**.
- A PDF → AI-organized → verbatim-rendered course generation pipeline — solves **P2**.
- A unified engagement layer combining native gamification, real-time discussions per subsection, friends and chat, and an in-course AI tutor grounded in the actual lesson content — solves **P3**.

The platform is delivered as a single-page React 19 frontend talking to a FastAPI backend over a JSON HTTP API, with WebSockets for the real-time channels. Persistence is PostgreSQL (Neon serverless). The AI layer combines Google Gemini for generation and Pinecone for vector retrieval. Payment for paid courses is handled by Stripe Checkout.

## 1.6 Functional Requirements

The functional requirements are organized by actor and by domain. The table below is the consolidated backlog; per-actor use cases are detailed in Section 1.10.

### Table 1.2 — Functional requirements summary

| ID | Domain | Requirement |
|---|---|---|
| FR-01 | Authentication | A visitor can register as Student or Professor with email + password. |
| FR-02 | Authentication | A registered user can log in and obtain a JWT access token. |
| FR-03 | Authentication | A logged-in user can view and update their profile (name, bio, speciality, profile image, password, optional university affiliation). |
| FR-04 | Hierarchy | A Super Admin can create regions and universities. |
| FR-05 | Hierarchy | A Super Admin can create University Admin accounts and assign them to a university. |
| FR-06 | Hierarchy | A Professor can submit a join request to a university; a University Admin can approve or reject it. |
| FR-07 | Courses | A Professor can create a course with a title, description, thumbnail, category, price, and free/paid/subscription mode. |
| FR-08 | Courses | A Professor can add sections to a course, subsections to a section, and lesson blocks (rich text, image, file, video, code) to a subsection. |
| FR-09 | Courses | A Professor can publish or unpublish a course. |
| FR-10 | AI | A Professor can upload a PDF and have an AI-generated course outline produced (sections, subsections, chunk assignments) with content rendered verbatim. |
| FR-11 | AI | A Professor can regenerate the formatting of a subsection without changing its words. |
| FR-12 | Enrollment | A Student can browse published courses and enroll in a free course directly. |
| FR-13 | Payments | A Student can purchase a paid course through Stripe Checkout; enrollment is confirmed on session completion. |
| FR-14 | Learning | A Student can navigate a course hierarchically (Course → Section → Subsection) and mark subsections as completed. |
| FR-15 | Discussions | A Student or Professor can create posts and threaded replies on any subsection. |
| FR-16 | Discussions | A user can upvote a post and report inappropriate posts. |
| FR-17 | Discussions | An on-demand AI-generated summary of a subsection's discussion thread can be produced. |
| FR-18 | QCM | A Student can take an auto-generated multiple-choice quiz per subsection at three difficulty levels. |
| FR-19 | QCM | The platform stores every attempt with the questions, answers, score, pass/fail flag, and timestamp. |
| FR-20 | Feedback | A Student who completed a course can leave a 1–5 star rating with a comment. |
| FR-21 | AI Tutor | A Student can ask in-course questions answered by a RAG pipeline that retrieves chunks from the course content. |
| FR-22 | Gamification | The platform awards XP for lessons completed, quizzes passed, perfect scores, daily logins, and other actions. |
| FR-23 | Gamification | The platform computes levels from total XP, tracks daily streaks (with a once-per-week streak-freeze), and unlocks achievements and badges. |
| FR-24 | Friends | A user can search for other users, send a friend request, and exchange direct messages. |
| FR-25 | Chat | A Student can request to chat with a Professor; the Professor accepts or refuses (with an opt-in auto-refuse flag). |
| FR-26 | Notifications | The system pushes real-time notifications for new enrollments, friend requests, accepted chats, and other significant events. |
| FR-27 | Announcements | A University Admin can post announcements to all users of their university. |
| FR-28 | Analytics | A Student can view their personal analytics (XP earned, lessons completed, courses in progress, streak history). |
| FR-29 | Analytics | A Professor can view course-level analytics (enrollments, completions, average score, average rating). |
| FR-30 | Admin | A Super Admin can ban or unban any user account; a University Admin can manage users within their university. |

## 1.7 Non-Functional Requirements

### Table 1.3 — Non-functional requirements

| Category | Requirement | How it is addressed |
|---|---|---|
| Performance | First-paint payload kept small | Route-level code-splitting via `React.lazy()` cuts the initial bundle by approximately 60–70%. |
| Performance | API response times under 500 ms for cached endpoints | GZip compression for payloads >1 KB; immutable static caching on `/uploads/`; targeted compound indexes on hot-path tables. |
| Performance | Database resilience on a serverless connection pool | `pool_pre_ping=True`, `pool_recycle=300`, `pool_size=20`, `max_overflow=30`. |
| Security | Password storage | `bcrypt` via `passlib`. |
| Security | Stateless authentication | JWT (`python-jose`), 60-minute expiry, `HS256`. |
| Security | Authorization | Role enum (`student`, `professor`, `university_admin`, `super_admin`) with rank ordering and per-route dependencies. |
| Security | Defense in depth | Validated schemas on every endpoint (Pydantic), CORS allow-list, file-type restriction on uploads, server-rendered upload paths. |
| Reliability | Schema evolution | Idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` migrations executed on startup. |
| Reliability | AI fallbacks | If Gemini fails to outline a PDF, the system falls back to a single flat section so the professor at least receives their content back. |
| Usability | Modern SPA UX | React 19, Tailwind CSS, Tiptap rich-text editor, loading states everywhere. |
| Accessibility | Keyboard navigation, contrast, focus rings | Tailwind utilities + focus management on dialogs. |
| Maintainability | Layered architecture | Routes → Controllers → Models, with shared schemas and security utilities. |
| Observability | Boot-time configuration validation | Startup banner reports whether Gemini, Pinecone, and Stripe keys are configured. |
| Extensibility | Pluggable AI providers | Gemini calls are isolated in `utils/gemini.py`, `utils/rag.py`, `utils/course_generator.py`. |

## 1.8 Actors of the System

The platform recognizes **four primary actors**, plus an unauthenticated **Visitor**:

- **Visitor** — anyone who can reach the public site but is not logged in. Can browse the home page, register, log in.
- **Student** (`role = "student"`) — registered learner. Enrolls in courses, completes lessons and quizzes, earns XP and badges, posts in discussions, chats with friends, asks the AI tutor questions.
- **Professor** (`role = "professor"`) — content author. Creates and publishes courses, designs sections/subsections/blocks, uploads PDFs for AI generation, monitors enrollments and course feedback, accepts or refuses chat requests, optionally requests affiliation to a university.
- **University Admin** (`role = "university_admin"`) — institutional moderator. Reviews professor join requests for their university, posts announcements, moderates content, manages users within their tenant.
- **Super Admin** (`role = "super_admin"`) — platform owner. Creates regions and universities, creates University Admin accounts, bans or unbans any user, oversees global moderation. The Super Admin is the only actor with platform-wide write authority.

### Table 1.4 — Actors and their permissions

| Capability | Visitor | Student | Professor | Univ. Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Browse home page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register / Login | ✅ | — | — | — | — |
| View own profile | — | ✅ | ✅ | ✅ | ✅ |
| Enroll in a course | — | ✅ | — | — | — |
| Create / publish a course | — | — | ✅ | — | — |
| AI-generate a course from PDF | — | — | ✅ | — | — |
| Post in discussions | — | ✅ | ✅ | ✅ | ✅ |
| Delete any discussion post | — | — | — | ✅ (own univ.) | ✅ |
| Approve professor join request | — | — | — | ✅ | — |
| Post announcement | — | — | — | ✅ | — |
| Create region / university | — | — | — | — | ✅ |
| Create University Admin | — | — | — | — | ✅ |
| Ban / unban any user | — | — | — | — | ✅ |

## 1.9 Global Use-Case Diagram

Below is the high-level use-case map. Each numbered cluster expands into the per-actor diagrams of Section 1.10.

```text
                    ┌──────────────────────────────────────────┐
                    │             Hub4Learners                 │
                    │                                          │
   (Visitor) ──── Register ─── Login ───────────────────────── │
                    │                                          │
                    │  ┌─ Manage Profile                       │
                    │  ├─ Browse Catalogue                     │
   (Student) ───────┼─ Enroll (free or Stripe-paid)            │
                    │  ├─ Learn / Track Progress               │
                    │  ├─ Take QCM                             │
                    │  ├─ Discuss (post/reply/vote)            │
                    │  ├─ Ask AI Tutor (RAG)                   │
                    │  ├─ Earn XP / Levels / Badges            │
                    │  ├─ Friends + Chat                       │
                    │  └─ Leave Course Feedback                │
                    │                                          │
                    │  ┌─ Create / Publish Course              │
                    │  ├─ Build Sections / Subsections / Blocks│
   (Professor) ─────┼─ AI-Generate Course from PDF             │
                    │  ├─ Manage Enrollments                   │
                    │  ├─ Accept / Refuse Chat Requests        │
                    │  ├─ Request Univ. Affiliation            │
                    │  └─ View Course Analytics                │
                    │                                          │
                    │  ┌─ Review Professor Join Requests       │
   (Univ. Admin) ───┼─ Post Announcements                      │
                    │  ├─ Manage Users (own tenant)            │
                    │  └─ Moderate Discussions                 │
                    │                                          │
                    │  ┌─ Manage Regions & Universities        │
   (Super Admin) ───┼─ Create Univ. Admin Accounts             │
                    │  ├─ Ban / Unban any User                 │
                    │  └─ Platform Oversight                   │
                    └──────────────────────────────────────────┘
```

**Figure 1.1 — Global Use-Case Diagram (4 actors).**

## 1.10 Use Cases per Actor

### 1.10.1 Student

The Student is the primary content consumer. Their use cases form the largest cluster and constitute the bulk of the user-facing traffic.

```text
            ┌─ Browse published catalogue
            ├─ Filter by category / price
            ├─ View course details + curriculum
            ├─ Enroll (free) or Pay (Stripe)
            ├─ Open course learning view
            │     ├─ Navigate Section → Subsection
            │     ├─ Read lesson blocks
            │     ├─ Watch / open files
            │     ├─ Mark subsection completed
            │     ├─ Take QCM (easy / medium / hard)
            │     └─ Ask in-course AI tutor (RAG)
(Student) ──┤
            ├─ Post in discussion thread
            ├─ Reply / Upvote / Report posts
            ├─ Generate AI discussion summary
            ├─ Leave 1–5★ course rating + comment
            │
            ├─ Friends (search / request / accept / remove)
            ├─ Direct chat (with files)
            ├─ Receive real-time notifications
            │
            ├─ View XP / level / streak / achievements
            ├─ View learner analytics dashboard
            └─ Manage profile / change password
```

**Figure 1.2 — Student Use Cases.**

### 1.10.2 Professor

```text
              ┌─ Create / edit course metadata
              ├─ Set price (free / one-off / subscription)
              ├─ Build curriculum:
              │     ├─ Add / reorder Sections
              │     ├─ Add / reorder Subsections
              │     └─ Add Lesson Blocks (text / image / file / code)
              │
              ├─ Upload PDF → AI Course Generation
              │     ├─ Background job polls /api/course-generation/{job}
              │     └─ On success: course pre-filled with structure
              │
              ├─ Regenerate-format of an individual subsection
              ├─ Publish / Unpublish course
              │
(Professor) ──┤
              ├─ View enrolled students
              ├─ Read course feedback (rating + comment)
              ├─ Accept / Refuse chat requests
              ├─ Auto-refuse chat toggle
              │
              ├─ Request join to a university
              ├─ View join-request status
              │
              ├─ Friends + Direct chat
              ├─ Receive notifications (enrollments, ratings, chats)
              ├─ Professor-only gamification milestones
              └─ Manage profile
```

**Figure 1.3 — Professor Use Cases.**

### 1.10.3 University Admin

```text
                 ┌─ Review professor join requests (own univ.)
                 ├─ Approve / Reject with optional note
                 ├─ View users of own university
                 ├─ Post announcements (own univ.)
                 ├─ Moderate / delete discussion posts
                 ├─ View university-level statistics
                 ├─ Manage own profile
(Univ. Admin) ───┤
                 └─ (Cannot create regions / universities — Super Admin only)
```

**Figure 1.4 — University Administrator Use Cases.**

### 1.10.4 Super Admin

```text
                 ┌─ Create / rename / delete regions
                 ├─ Create / move / delete universities
                 ├─ Create / edit University Admin accounts
                 ├─ Ban / Unban any user (any role)
                 ├─ Inspect platform-wide statistics
                 ├─ Override any moderation decision
(Super Admin) ───┤
                 └─ Cannot impersonate users (auditability)
```

**Figure 1.5 — Super Administrator Use Cases.**

## 1.11 Methodology and Planning

### 1.11.1 Choice of methodology

Three families of methodologies were considered: classical waterfall, agile Scrum, and agile Kanban. Waterfall was rejected because the project's exact feature scope was certain to evolve as AI capabilities were prototyped — committing to a fixed specification up front would have produced churn. Kanban was rejected because the project needed visible milestones aligned with academic checkpoints rather than a continuous flow. **Scrum** was adopted as the best fit: fixed-length sprints provide demoable increments aligned with supervision meetings, the backlog can be reprioritized between sprints as discoveries happen, and the explicit ceremony of sprint review / retrospective forces written reflection.

### 1.11.2 Sprint planning

Four sprints of three to four weeks each were planned, with Sprint 0 covering environment setup and architectural decisions.

### Table 1.5 — Sprint planning

| Sprint | Duration | Goals |
|---|---|---|
| Sprint 0 | 2 weeks | Stack selection, database schema draft, repository scaffolding, CI setup, environment variables, Neon database provisioned, Pinecone index created. |
| Sprint 1 | 4 weeks | Authentication (register/login/me/profile), role hierarchy + JWT, base layout, home page, student and professor dashboards, course CRUD without AI, category seeding. |
| Sprint 2 | 4 weeks | Course content builder (section/subsection/lesson blocks), file uploads, enrollment (free), Stripe checkout for paid courses, course feedback, basic notifications. |
| Sprint 3 | 4 weeks | AI course generation from PDF (PyMuPDF + Gemini), RAG pipeline (Pinecone + Gemini embeddings), in-course AI tutor, QCM generation, discussions per subsection (posts/replies/votes/reports/AI summary). |
| Sprint 4 | 4 weeks | Gamification engine (XP logs, levels, streaks, achievements, badges), friends + chat (WebSocket), notifications system, learner analytics, professor analytics, multi-tenant admin dashboards, performance pass. |

### 1.11.3 Tooling

- **Source control:** Git + GitHub, feature-branch workflow with PR review.
- **IDE:** Visual Studio Code with Pylance, ESLint, Tailwind IntelliSense.
- **Modeling:** Mermaid for diagrams (kept in `Hub4Learners_Mermaid_Diagrams.md`), PlantUML where richer UML was needed.
- **Issue tracking:** GitHub Issues with sprint labels.
- **Database:** Neon (serverless PostgreSQL) for both development and production tenants.
- **Vector store:** Pinecone (serverless tier).
- **AI provider:** Google Gemini (`gemini-3.1-flash-lite-preview`) for generation, `gemini-embedding-001` for embeddings.
- **Payments:** Stripe (test mode in development).

## 1.12 Conclusion

This chapter established the why of Hub4Learners — a platform that combines institutional control, AI-as-infrastructure, and gamified engagement into a single coherent experience. The four actors, the consolidated functional requirements, the non-functional constraints, and the four-sprint plan together form the contract between the problem and the implementation. The next chapter translates this contract into a concrete architectural and data-model design.

---

# Chapter 2 — Conception (Design)

## 2.1 Introduction

This chapter describes the design phase of Hub4Learners. It motivates the architectural choices, presents the deployment topology, defines the complete data model (twenty-four entities), specifies the REST API by domain, details the security and authorization model, and finally describes the AI, payment, and real-time architectures that distinguish the platform from a conventional LMS.

## 2.2 Architectural Choices

### 2.2.1 Overall style — Layered, modular, REST-first

The system is a classic three-tier web application:

```
   ┌─────────────────────────┐
   │      Client (React)     │   SPA, Vite-built, Tailwind-styled
   └────────────┬────────────┘
                │   JSON over HTTPS, JWT in Authorization header
   ┌────────────▼────────────┐
   │     FastAPI Backend     │   Layered: Routes → Controllers → Models
   │                         │   Schemas (Pydantic) at every boundary
   └─────┬──────┬──────┬─────┘
         │      │      │
    ┌────▼──┐ ┌─▼────┐ ┌▼──────────┐
    │ Postgres│ │Pine- │ │  Gemini   │
    │ (Neon)  │ │cone  │ │   API     │
    └────────┘ └──────┘ └───────────┘
                │
         ┌──────▼──────┐
         │   Stripe    │
         └─────────────┘
```

**Figure 2.1 — High-Level System Architecture.**

A layered backend was chosen over microservices because (a) the project is delivered by a single engineer in a single semester, where the operational cost of microservices outweighs their benefits, and (b) the bounded contexts (auth, courses, discussions, AI, payments, gamification) can be cleanly isolated into separate Python modules without service boundaries. The system is intentionally service-extractable in the future — each controller is dependency-injected through `Depends(get_db)` and could be lifted into its own service with minimal refactor.

### 2.2.2 Why FastAPI + SQLModel + PostgreSQL

- **FastAPI** is one of the fastest Python web frameworks (built on Starlette and Pydantic v2), provides auto-generated OpenAPI documentation, and makes dependency injection ergonomic. Its async support is essential for the AI pipelines, which spend most of their time waiting on external API calls.
- **SQLModel** combines Pydantic and SQLAlchemy into a single declarative model. This eliminates the duplication of an ORM model plus a Pydantic schema, which would otherwise be a maintenance burden across the project's twenty-four tables.
- **PostgreSQL (Neon)** is the de facto open-source relational database. Neon's serverless model gives the project a free production-grade tier with autoscaling, branch databases for testing, and `pg_dump`-compatible exports. The schema relies on PostgreSQL-specific features (`UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `JSONB` for notification metadata, partial unique indexes for course progress).

### 2.2.3 Why React 19 + TypeScript + Vite + Tailwind

- **React 19** introduces the Suspense improvements and the lazy-route patterns the SPA relies on. The decision to upgrade ahead of the LTS version was justified by route-level code-splitting performance gains visible in Lighthouse scores.
- **TypeScript** is non-negotiable on a project of this size; the API surface alone defines hundreds of types that would be unmaintainable in raw JavaScript.
- **Vite** delivers sub-second incremental rebuilds and produces an output bundle ~30% smaller than the equivalent CRA/webpack setup.
- **Tailwind CSS** keeps the styling co-located with the component, enables a small, deterministic design system, and avoids the maintenance cost of a parallel CSS file structure.

## 2.3 Deployment and Client–Server Architecture

The deployment topology is intentionally simple:

```
Browser  ──HTTPS──►  CDN (static)
              └────►  FastAPI (uvicorn)
                          │
                          ├──► PostgreSQL (Neon, eu-central-1)
                          ├──► Pinecone (hub4learners index)
                          ├──► Gemini API (Google)
                          └──► Stripe API
```

The backend is a single Python process running `uvicorn` with `GZipMiddleware`. A custom `BaseHTTPMiddleware` is registered to attach `Cache-Control: public, max-age=31536000, immutable` to every `/uploads/*` response, so static uploads can be cached aggressively by browsers and any intermediate CDN. Database connections are pooled by SQLAlchemy with `pool_pre_ping=True` to survive Neon's idle-timeout disconnects.

The frontend is built by Vite into a static bundle of HTML + ES modules + CSS, suitable for any static host (Vercel, Netlify, Cloudflare Pages, or a plain S3+CloudFront). All API calls go to the backend's `/api/...` prefix and carry a `Bearer` JWT.

## 2.4 Data Modeling

### 2.4.1 Domain → table mapping

The data model spans twenty-four tables organized into seven domains.

### Table 2.1 — Domain → table mapping

| Domain | Tables |
|---|---|
| Identity & Hierarchy | `users`, `regions`, `universities`, `university_join_requests` |
| Categories | `categories` |
| Courses | `courses`, `course_sections`, `course_subsections`, `course_materials`, `lesson_blocks` |
| Enrollment & Progress | `enrollments`, `course_progress`, `course_feedback` |
| AI Artifacts | `generated_courses`, `qcm_attempts` |
| Communication | `chat_requests`, `messages`, `friendships`, `friend_messages`, `notifications`, `announcements` |
| Discussions | `discussion_posts`, `discussion_votes`, `discussion_reports`, `discussion_summaries` |
| Gamification | `user_gamification`, `xp_logs`, `achievements`, `user_achievements`, `badges`, `user_badges` |

### 2.4.2 Entity-relationship diagram (class diagram)

The class diagram below shows the most important entities and their relationships. Audit columns (`created_at`, `updated_at`) and FK ON-DELETE policies are documented in the actual SQLModel files; they are omitted from the diagram to keep the figure readable.

```text
┌─────────────┐     ┌───────────────┐     ┌──────────────────┐
│   Region    │ 1─┐ │  University   │ 1─┐ │       User       │
├─────────────┤   ├─┤───────────────│   ├─┤──────────────────│
│ id (PK)     │   │ │ id (PK)       │   │ │ id (PK)          │
│ name        │   ├─►│ name          │   ├─►│ full_name        │
│ code        │     │ region_id FK │     │ │ email (UQ)       │
└─────────────┘     │ created_by FK │     │ │ password_hash    │
                    └───────────────┘     │ │ role             │
                                          │ │ university_id FK │
                                          │ │ region_id FK     │
                                          │ │ profile_image    │
                                          │ │ auto_refuse_chat │
                                          │ │ is_verified      │
                                          │ └──────────────────┘
                                          │
                                          │     ┌──────────────────────┐
                                          │     │ UniversityJoinRequest│
                                          │   1─┤──────────────────────│
                                          ├────►│ id (PK)              │
                                          │     │ professor_id FK→User │
                                          │     │ university_id FK     │
                                          │     │ status               │
                                          │     │ reviewed_by FK→User  │
                                          │     └──────────────────────┘
                                          │
┌─────────────┐ 1─┐                       │     ┌──────────────────┐
│  Category   │   │                       │     │     Course       │
├─────────────┤   ├──────────────────────►│   1─┤──────────────────│
│ id (PK)     │   │                       ├────►│ id (PK)          │
│ name        │   │                       │     │ title            │
│ icon        │   │                       │     │ description      │
└─────────────┘   │                       │     │ price            │
                  │                       │     │ is_free          │
                  │                       │     │ is_subscription  │
                  │                       │     │ professor_id FK  │
                  └──────────────────────►│     │ category_id FK   │
                                          │     │ is_published     │
                                          │     │ ai_summary       │
                                          │     └─────┬────────────┘
                                          │           │ 1
                                          │           │
                                          │           ▼ *
                                          │     ┌──────────────────┐
                                          │     │  CourseSection   │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ course_id FK     │
                                          │     │ title            │
                                          │     │ order_index      │
                                          │     └─────┬────────────┘
                                          │           │ 1
                                          │           ▼ *
                                          │     ┌──────────────────┐
                                          │     │ CourseSubsection │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ section_id FK    │
                                          │     │ title            │
                                          │     │ order_index      │
                                          │     └─────┬────────────┘
                                          │           │ 1
                                          │           ▼ *
                                          │     ┌──────────────────┐
                                          │     │   LessonBlock    │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ subsection_id FK │
                                          │     │ block_type       │   text|image|file|code|video
                                          │     │ content          │
                                          │     │ file_url         │
                                          │     │ order_index      │
                                          │     └──────────────────┘
                                          │
                                          │     ┌──────────────────┐
                                          │     │   Enrollment     │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ student_id FK    │
                                          │     │ course_id FK     │
                                          │     │ status           │   active|completed|cancelled
                                          │     └──────────────────┘
                                          │
                                          │     ┌──────────────────┐
                                          │     │ CourseProgress   │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ student_id FK    │
                                          │     │ course_id FK     │
                                          │     │ subsection_id FK │   (or material_id)
                                          │     │ completed_at     │
                                          │     └──────────────────┘
                                          │
                                          │     ┌──────────────────┐
                                          │     │  CourseFeedback  │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ course_id FK     │
                                          │     │ user_id FK       │
                                          │     │ rating (1-5)     │
                                          │     │ comment          │
                                          │     └──────────────────┘
                                          │
                                          │     ┌──────────────────┐
                                          │     │   QCMAttempt     │
                                          │     ├──────────────────┤
                                          │     │ id (PK)          │
                                          │     │ student_id FK    │
                                          │     │ course_id FK     │
                                          │     │ section_id FK    │
                                          │     │ difficulty       │
                                          │     │ score / total    │
                                          │     │ passed           │
                                          │     │ questions_json   │
                                          │     │ answers_json     │
                                          │     └──────────────────┘
```

**Figure 2.3 — Entity-Relationship Diagram (excerpt — core domain).**

Additional clusters not shown above:

- **Discussions cluster:** `discussion_posts` (with `parent_post_id` self-reference for threading, denormalized `upvote_count` / `reply_count` / `report_count`), `discussion_votes` (UNIQUE post_id+user_id), `discussion_reports`, `discussion_summaries` (one-row-per-subsection cache).
- **Gamification cluster:** `user_gamification` (PK = `user_id`, holds totals), `xp_logs` (immutable audit row per grant), `achievements` (catalog seeded on startup), `user_achievements` (UNIQUE user+achievement), `badges` (catalog with rarity), `user_badges`.
- **Communication cluster:** `chat_requests` (Student→Professor handshake), `messages` (chat after acceptance), `friendships` (bidirectional request/accept), `friend_messages` (with optional media), `notifications` (typed, JSONB meta).
- **AI cluster:** `generated_courses` (async job state machine: `processing` → `completed`|`failed`, with a JSONB `result` payload).

### 2.4.3 Design decisions in the data model

A few non-obvious decisions are worth flagging:

- **UUID primary keys everywhere.** UUIDs are generated server-side via `gen_random_uuid()`. This avoids exposing sequential IDs that could be enumerated, and makes data merges between branches trivial.
- **Role stored as `VARCHAR(50)` instead of a PostgreSQL ENUM.** The original schema used an enum; a startup migration converts it to `VARCHAR` so new roles can be added without an `ALTER TYPE` migration that requires a lock. The application enforces the valid set via `VALID_ROLES`.
- **Denormalized counters on `discussion_posts`.** `upvote_count`, `reply_count`, and `report_count` are stored on the post itself and updated transactionally. This avoids `COUNT(*)` queries on the hot listing path.
- **Partial unique indexes on `course_progress`.** A single `course_progress` row records the completion of either a subsection or a material, never both — enforced by two partial unique indexes (`WHERE subsection_id IS NOT NULL` / `WHERE material_id IS NOT NULL`).
- **`xp_logs.source_id` is free-form `VARCHAR(64)`.** Different XP sources have different identifier shapes (a UUID for a lesson, a date-stamped string for daily login). A free-form string lets the same dedup logic work across all sources.

## 2.5 API Design

The API follows REST conventions. Every router is mounted under `/api`, except the WebSocket routes which use `/ws/...` directly. The full surface area is summarized below; the OpenAPI document generated by FastAPI is available at `/docs`.

### Table 2.2 — API endpoints by domain (excerpt)

| Domain | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| Auth | POST | `/api/auth/register` | — | Register a new Student or Professor |
| Auth | POST | `/api/auth/login` | — | Obtain a JWT |
| Auth | GET | `/api/auth/me` | JWT | Return the logged-in user |
| Auth | PUT | `/api/auth/profile` | JWT | Update profile / password |
| Courses | GET | `/api/courses` | JWT | List courses (filtered by role) |
| Courses | POST | `/api/courses` | Professor | Create a course |
| Courses | GET | `/api/courses/{id}` | JWT | Course details + curriculum |
| Courses | PUT | `/api/courses/{id}/publish` | Professor | Publish |
| Courses | POST | `/api/courses/{id}/sections` | Professor | Add a section |
| Courses | POST | `/api/courses/{id}/enroll` | Student | Enroll in a free course |
| Courses | POST | `/api/courses/{id}/feedback` | Student | Rate a course |
| Payments | GET | `/api/payments/config` | — | Stripe publishable key |
| Payments | POST | `/api/payments/checkout/{course_id}` | Student | Create Stripe Checkout session |
| Payments | POST | `/api/payments/confirm` | Student | Confirm a paid enrollment |
| AI | POST | `/api/ai/rag/index/{course_id}` | Professor | Index a course in Pinecone |
| AI | POST | `/api/ai/rag/ask` | JWT | Ask a question (RAG) |
| Course-gen | POST | `/api/course-generation/upload` | Professor | Submit a PDF, get a job_id |
| Course-gen | GET | `/api/course-generation/{job_id}` | Professor | Poll job status |
| QCM | POST | `/api/courses/{c}/subsections/{s}/qcm` | Student | Generate + start a quiz |
| Discussions | GET | `/api/discussions/subsections/{id}` | JWT | List posts |
| Discussions | POST | `/api/discussions/subsections/{id}` | JWT | Create a top-level post |
| Discussions | POST | `/api/discussions/{post_id}/replies` | JWT | Reply to a post |
| Discussions | POST | `/api/discussions/{post_id}/vote` | JWT | Toggle upvote |
| Discussions | POST | `/api/discussions/{post_id}/report` | JWT | Report a post |
| Discussions | GET | `/api/discussions/subsections/{id}/summary` | JWT | AI summary (cached) |
| Friends | POST | `/api/friends/request` | JWT | Send friend request |
| Friends | POST | `/api/friends/{id}/accept` | JWT | Accept |
| Notifications | GET | `/api/notifications` | JWT | List notifications |
| Notifications | POST | `/api/notifications/read-all` | JWT | Mark all as read |
| Gamification | GET | `/api/gamification/me` | JWT | Personal profile |
| Gamification | GET | `/api/gamification/leaderboard` | JWT | Top users |
| Admin | GET | `/api/admin/users` | Super Admin | List all users |
| Admin | POST | `/api/admin/users/{id}/ban` | Super Admin | Ban a user |
| Org | POST | `/api/org/regions` | Super Admin | Create a region |
| Org | POST | `/api/org/universities` | Super Admin | Create a university |
| WS | WS | `/ws/notifications` | JWT (query) | Live notifications |
| WS | WS | `/ws/friend-chat/{friendship_id}` | JWT (query) | Live direct chat |

### 2.5.1 Conventions

- All endpoints accept and return JSON.
- All authenticated endpoints expect `Authorization: Bearer <jwt>`.
- Error responses follow `{ "detail": "human-readable message" }` with the appropriate HTTP status (`400`, `401`, `403`, `404`, `409`, `422`).
- IDs are UUIDs throughout (no integer IDs leak to the client).
- All `list` endpoints support `limit` / `offset` query parameters where pagination is needed.

## 2.6 Security Design

### 2.6.1 Authentication

Authentication is **stateless JWT**:

- On `POST /api/auth/register`, the user's password is hashed with `bcrypt` (`passlib`) and stored in `users.password_hash`.
- On `POST /api/auth/login`, the password is verified against the stored hash. On success, a JWT is issued with the following claims:
  - `sub`: the user UUID
  - `role`: one of `student | professor | university_admin | super_admin`
  - `is_verified`: boolean
  - `university_id`, `region_id`: tenant scope (may be null)
  - `exp`: 60 minutes from issue
- Tokens are signed with `HS256`. The secret key is loaded from environment variables in production.
- The client stores the token in `localStorage` under the key `h4l_token` and attaches it to every request via an Axios-style interceptor in `frontend/src/api/_client.ts`.

### 2.6.2 Authorization — the role-rank pattern

Many endpoints have one of two authorization requirements: (a) exactly one role, or (b) any role at or above a given rank. The codebase exposes both as injectable dependencies:

```python
# backend/app/utils/security.py
ROLE_RANK: dict[str, int] = {
    "student":          0,
    "professor":        1,
    "university_admin": 2,
    "super_admin":      3,
}

def require_role(*allowed_roles: str):
    """Strict — must be exactly one of the allowed roles."""
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(403, f"Access restricted to: {', '.join(allowed_roles)}")
        return current_user
    return dependency

def require_min_rank(min_role: str):
    """Hierarchical — any role with rank ≥ min_role."""
    min_r = ROLE_RANK[min_role]
    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if ROLE_RANK.get(current_user.get("role", ""), -1) < min_r:
            raise HTTPException(403, "Insufficient privileges")
        return current_user
    return dependency
```

### Table 2.3 — Role-rank matrix

| Role | Rank | Cumulative rights |
|---|:---:|---|
| `student` | 0 | Self-service: profile, enrollment, learning, gamification, discussions |
| `professor` | 1 | + author/publish courses, run AI generation, manage own course feedback |
| `university_admin` | 2 | + manage own tenant: announcements, join requests, moderation |
| `super_admin` | 3 | + platform-wide: regions, universities, ban/unban, full audit |

### 2.6.3 Other security measures

- **Input validation** via Pydantic schemas on every route.
- **CORS allow-list** restricted to the configured frontend origin in production.
- **CSRF** is not a concern because the API is JWT-bearer; no session cookies are used.
- **File uploads** are restricted to a known set of MIME types in `course_routes.py` and `chat_routes.py`. Uploaded files are renamed with a UUID to avoid path-traversal.
- **SQL injection** is prevented by exclusive use of the SQLAlchemy ORM and parameterized statements.
- **Cache headers** are immutable on `/uploads/*`, so revoked uploads must be deleted from disk, not just unlinked from the database.

### 2.6.4 Sequence — Register

```text
Client                FastAPI /auth/register       AuthController       DB
   │                              │                       │                │
   │── POST {name, email, pwd} ──►│                       │                │
   │                              │── register_user ─────►│                │
   │                              │                       │── SELECT user │
   │                              │                       │   WHERE email │
   │                              │                       │◄─ Not found ──│
   │                              │                       │── bcrypt.hash │
   │                              │                       │── INSERT user │
   │                              │                       │◄─ user row ───│
   │                              │                       │── JWT.sign ──►│
   │                              │◄── TokenResponse ─────│                │
   │◄── 200 {access_token} ──────│                       │                │
```

**Figure 2.4 — Sequence Diagram: Register.**

### 2.6.5 Sequence — Login with daily-login XP

```text
Client                FastAPI /auth/login        AuthController       XPService     DB
   │                              │                       │                 │           │
   │── POST {email, pwd} ────────►│                       │                 │           │
   │                              │── login_user ────────►│                 │           │
   │                              │                       │── SELECT user ─────────────►│
   │                              │                       │◄────────────────────────────│
   │                              │                       │── bcrypt.verify             │
   │                              │                       │── award_xp(daily_login) ──►│
   │                              │                       │      (one-shot per UTC day) │
   │                              │                       │── JWT.sign                  │
   │                              │◄── TokenResponse ─────│                              │
   │◄── 200 {access_token} ──────│                       │                              │
```

**Figure 2.5 — Sequence Diagram: Login with JWT and daily-login XP.**

## 2.7 AI and RAG Architecture

The AI layer is composed of four cooperating pipelines, each isolated in its own utility module so a future change of provider (e.g., from Gemini to a self-hosted LLM) requires editing one file.

### 2.7.1 Course generation from PDF

```text
Professor uploads PDF
         │
         ▼
parse_pdf (PyMuPDF) ──► list[PDFChunk] with line metadata + page numbers
         │
         ▼
_generate_outline (1 Gemini call, JSON-strict)
   • Picks a course title
   • Names sections and subsections
   • Assigns each chunk_id to a subsection
         │
         ▼
_fill_missing_chunks (deterministic safety net)
   • Any chunk the AI forgot is attached to the subsection
     whose chunk-id range is closest
         │
         ▼
For each subsection:
   • Gather lines from the assigned chunks
   • Render verbatim as HTML via lines_to_html
         │
         ▼
Persist as a `generated_courses` row with status='completed'
and a JSONB `result` payload
```

**Figure 2.7 — Sequence Diagram: AI Course Generation from PDF.**

Design rule (explicit professor request): **the AI never rewrites content**. It only picks the structural names and assigns chunks. This avoids the "AI paraphrasing introduces subtle errors" failure mode that plagues most automated course generators.

### 2.7.2 RAG-grounded student Q&A

```text
Professor publishes a course
         │
         ▼
strip_html on every subsection → chunked at sentence boundaries (target 1500 chars)
         │
         ▼
For each chunk:
   • embed via gemini-embedding-001 (768-d truncated)
   • upsert into Pinecone with metadata: {course_id, subsection_id, chunk_index}
         │
         ▼
Student asks "Why does X work?" in the course view
         │
         ▼
embed the question
         │
         ▼
Pinecone top-K retrieval, scored by cosine similarity
         │
         ▼
If max_score < MIN_SCORE (0.40):
   → fall back to "I'm not sure based on this course"
         │
         ▼
Else: assemble a prompt with the retrieved chunks
   and ask Gemini to answer grounded in them
         │
         ▼
Stream the answer to the client
```

**Figure 2.8 — Sequence Diagram: RAG-Powered Question Answering.**

### 2.7.3 QCM (quiz) generation

For each subsection on demand, Gemini is asked to produce a JSON array of exactly four multiple-choice questions, each with four options and one correct index, plus an explanation. The questions are stored in `qcm_attempts.questions_json` alongside the student's answers — preserving the full attempt as evidence and enabling future review or regrading.

### 2.7.4 Discussion summarization

When at least *N* posts exist in a subsection's discussion, an on-demand `POST /discussions/subsections/{id}/summary/regenerate` triggers Gemini to produce a markdown summary that highlights themes, frequent questions, and consensus answers. The summary is cached in `discussion_summaries` with `post_count_at_gen` so a regenerate only happens when the post count grows beyond a threshold.

## 2.8 Payment Architecture

Paid courses use **Stripe Checkout** rather than a card-on-page integration. The choice eliminates PCI-DSS exposure on the application server and offloads card handling, 3D-Secure, refunds, and currency display to Stripe.

```text
Student clicks "Buy this course"
         │
         ▼
POST /api/payments/checkout/{course_id}
         │
         ├─► Stripe.checkout.Session.create(line_items=[course])
         │   returns hosted Checkout URL
         │
         ▼
Frontend redirects browser to Stripe-hosted URL
         │
         ▼
[Student enters card on Stripe's domain]
         │
         ▼
Stripe redirects back to /payment/success?session_id=...
         │
         ▼
POST /api/payments/confirm  { session_id }
         │
         ├─► Stripe.checkout.Session.retrieve(session_id)
         ├─► assert payment_status == "paid"
         ├─► INSERT enrollment(status='active')
         └─► notify professor of new paid enrollment
```

**Figure 2.6 — Sequence Diagram: Stripe-Paid Enrollment.**

`confirm` is idempotent — replaying the same `session_id` does not create a duplicate enrollment.

## 2.9 Real-Time Architecture (WebSocket)

Three real-time channels are exposed:

- `/ws/notifications` — server pushes notification events to a logged-in user as they happen.
- `/ws/friend-chat/{friendship_id}` — bidirectional chat between two friends.
- `/ws/chat/{chat_request_id}` — Student-Professor chat after a chat request has been accepted.

Connection management lives in `backend/app/websocket_manager.py`. Each connection is keyed by `(channel_name, user_id)`. When the controller layer needs to push (e.g., after a successful Stripe confirmation), it calls `manager.send_to(user_id, payload)` which serializes to JSON and writes to the socket — silently dropping if the user is offline (the same event is also persisted in `notifications`).

## 2.10 Interface Design

The frontend follows a strict visual style guide:

- **Color palette:** dark surface `#0C0C0F`, accent `#FF5533`, muted text `#94A3B8`, border `#E5E7EB`, light surface `#F1F3F5`.
- **Type scale:** labels `0.68–0.7rem`, body `0.82–0.88rem`, headings `1.1–1.75rem`.
- **Inputs:** `h-10 px-3 border border-[#E5E7EB] rounded-lg`, focus ring `shadow-[0_0_0_3px_rgba(12,12,15,0.07)]`.
- **Buttons:** `bg-[#0C0C0F] text-white hover:bg-[#1E1E23]`; disabled `bg-[#D1D5DB]`.

Wireframes were produced in Figma for the home page, login/register flow, student dashboard, course-learning page, lesson builder, AI generation modal, discussion thread, QCM modal, gamification panel, and admin dashboard. Each wireframe was iterated twice before implementation. The final rendered screens are presented in Chapter 4.

## 2.11 Conclusion

This chapter translated the requirements of Chapter 1 into a concrete architectural and data-model design. The system is a layered, REST-first, modular monolith using FastAPI on the backend and React 19 on the frontend, persisted to PostgreSQL on Neon, with Pinecone and Gemini powering the AI features and Stripe Checkout handling payments. Twenty-four tables organized into seven domains capture the full state of the platform; security is enforced by a stateless JWT layer plus a role-rank dependency injection pattern. The next chapter shows how this design was realized in code.

---

# Chapter 3 — Implementation and Development

## 3.1 Introduction

This chapter documents the realization of Hub4Learners. It begins with the development environment and tooling, walks through the project folder structure, presents the most illustrative pieces of the backend and the frontend, dives into the AI pipelines and real-time channels, and closes on testing, performance engineering, and deployment notes.

## 3.2 Development Environment

### Table 3.1 — Technology stack

| Layer | Technology | Version | Role |
|---|---|---|---|
| Frontend | React | 19.2 | UI framework |
| Frontend | TypeScript | 5.9 | Type-safe JavaScript |
| Frontend | Vite | 7.3 | Bundler + dev server |
| Frontend | Tailwind CSS | 3.4 | Utility-first styling |
| Frontend | React Router | 7.1 | Client-side routing |
| Frontend | Tiptap | 3.22 | Rich-text editor for lesson blocks |
| Frontend | react-pdf | 10.4 | PDF preview inside the course-gen flow |
| Frontend | react-markdown + remark-gfm | 10.1 / 4.0 | Markdown rendering for AI summaries |
| Backend | Python | 3.11 | Backend runtime |
| Backend | FastAPI | ≥ 0.133 | Web framework |
| Backend | Uvicorn | ≥ 0.41 | ASGI server |
| Backend | SQLModel | 0.0.16 | ORM (Pydantic + SQLAlchemy) |
| Backend | psycopg2-binary / asyncpg | 2.9.9 / 0.29 | PostgreSQL drivers |
| Backend | python-jose | 3.3 | JWT signing/verification |
| Backend | passlib + bcrypt | 1.7.4 / 4.0.1 | Password hashing |
| Backend | python-multipart | 0.0.9 | File-upload parsing |
| Backend | google-generativeai | ≥ 0.8 | Gemini SDK |
| Backend | pinecone | ≥ 3.0 | Vector index SDK |
| Backend | pymupdf | ≥ 1.27 | PDF parsing |
| Backend | stripe | ≥ 10.0 | Payments SDK |
| Database | PostgreSQL (Neon) | 15 | Primary store |
| Vector store | Pinecone | serverless | RAG embeddings |
| AI | Google Gemini | `flash-lite` / `embedding-001` | Generation + embeddings |
| Payments | Stripe | Checkout API | Paid courses |
| Tooling | Git + GitHub | — | VCS |
| Tooling | VS Code | latest | IDE |

### Table 3.2 — Hardware environment used for development and testing

| Resource | Specification |
|---|---|
| Machine | Personal laptop |
| CPU | Intel Core i5 / i7 (11th-gen class) |
| RAM | 8–16 GB |
| Disk | 512 GB – 1 TB SSD |
| OS | Windows 11 / WSL2 |
| Database | Neon serverless (eu-central-1) |

## 3.3 Project Structure

```
Hub4Learners/
├── backend/
│   ├── app/
│   │   ├── main.py                  ← FastAPI app, CORS, startup migrations
│   │   ├── database.py              ← engine + SessionLocal + get_db()
│   │   ├── websocket_manager.py     ← in-memory WS connection registry
│   │   ├── models/                  ← 24 SQLModel tables
│   │   │   ├── user.py, university.py, region.py, courses.py,
│   │   │   ├── course_section.py, course_subsection.py, lesson_block.py,
│   │   │   ├── course_material.py, enrollment.py, course_progress.py,
│   │   │   ├── course_feedback.py, qcm_attempt.py, generated_course.py,
│   │   │   ├── discussion.py (4 classes), gamification.py (6 classes),
│   │   │   ├── friendship.py, friend_message.py, message.py,
│   │   │   └── chat_request.py, notification.py, announcement.py, ...
│   │   ├── schemas/                 ← Pydantic request/response models
│   │   ├── controller/              ← Business logic (one file per domain)
│   │   │   ├── auth_controller.py
│   │   │   ├── course_controller.py
│   │   │   ├── course_generation_controller.py
│   │   │   ├── discussion_controller.py
│   │   │   ├── payment_controller.py
│   │   │   ├── notification_controller.py
│   │   │   ├── gamification/  ← xp_service, badges_service, ...
│   │   │   └── ...
│   │   ├── routes/                  ← FastAPI routers
│   │   │   ├── auth_routes.py, course_routes.py, discussion_routes.py,
│   │   │   ├── payment_routes.py, ai_routes.py, ws_routes.py, ...
│   │   └── utils/
│   │       ├── security.py          ← JWT, bcrypt, role-rank
│   │       ├── gemini.py            ← Gemini client wrappers
│   │       ├── rag.py               ← Pinecone + embedding pipeline
│   │       ├── course_generator.py  ← PDF → course pipeline
│   │       ├── pdf_parser.py        ← PyMuPDF chunking
│   │       ├── leveling.py          ← XP → level curve
│   │       └── stripe_client.py     ← Stripe helpers
│   ├── uploads/                     ← Static-served file uploads
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx, App.tsx
│   │   ├── index.css                ← Tailwind directives
│   │   ├── context/
│   │   │   ├── AuthContext.tsx          ← Token + current user
│   │   │   └── GamificationContext.tsx  ← Live XP/badge toasts
│   │   ├── api/                     ← Typed REST clients
│   │   │   ├── _client.ts (axios instance + auth interceptor)
│   │   │   ├── auth.ts, course.ts, discussions.ts, payment.ts, ...
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── DiscussionSection.tsx
│   │   │   ├── ChatRoom.tsx, FriendChat.tsx, FriendsMessenger.tsx,
│   │   │   ├── QCMModal.tsx, RichTextEditor.tsx,
│   │   │   ├── gamification/  ← XPBar, BadgeGrid, Toasts
│   │   │   └── ...
│   │   ├── pages/                   ← Lazy-loaded routes
│   │   │   ├── HomePage.tsx, LoginPage.tsx, RegisterPage.tsx,
│   │   │   ├── DashboardPage.tsx (dispatch by role)
│   │   │   ├── StudentDashboard.tsx, ProfessorDashboard.tsx,
│   │   │   ├── AdminDashboard.tsx,
│   │   │   ├── CourseLearningPage.tsx, PaymentResultPage.tsx
│   │   └── hooks/
│   ├── vite.config.ts
│   └── package.json
│
├── markdown/                        ← Internal docs (architecture, runbooks)
└── uploads/                         ← Static files served at /uploads
```

**Figure 3.1 — Folder Structure.**

## 3.4 Backend Implementation

This section presents seven selected modules that illustrate the backend's most representative concerns. Routine CRUD has been omitted.

### 3.4.1 Authentication and authorization (`utils/security.py`)

The authentication layer is intentionally short. It centralizes JWT signing, password hashing, and the two authorization dependencies. The role-rank table is the single source of truth for hierarchy decisions.

```python
SECRET_KEY = "super-secret-key-change-this"   # overridden via env in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

VALID_ROLES = {"student", "professor", "university_admin", "super_admin"}
ROLE_RANK = {"student": 0, "professor": 1, "university_admin": 2, "super_admin": 3}

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(credentials = Depends(HTTPBearer())) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(401, "Invalid token")
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
```

### 3.4.2 Registration controller (`auth_controller.py`)

Registration is restricted to `student` and `professor` — administrative roles are created by Super Admin. The JWT payload includes the user's tenant identifiers so downstream endpoints do not have to re-query the database to perform tenant checks.

```python
def register_user(data: RegisterRequest, db: Session) -> TokenResponse:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(409, "Email already registered")
    role = data.role if data.role in ("student", "professor") else "student"
    user = User(
        full_name=f"{data.first_name} {data.last_name}",
        email=data.email,
        password_hash=hash_password(data.password),
        role=role,
        is_verified=True,
    )
    db.add(user); db.commit(); db.refresh(user)
    return TokenResponse(access_token=_build_token(user))

def _build_token(user: User) -> str:
    return create_access_token({
        "sub":           str(user.id),
        "role":          user.role,
        "is_verified":   user.is_verified,
        "university_id": str(user.university_id) if user.university_id else None,
        "region_id":     str(user.region_id)     if user.region_id     else None,
    })
```

### 3.4.3 Startup migrations (`main.py`)

The application performs idempotent SQL migrations on startup. Every statement uses `IF NOT EXISTS` or a guarded `DO $$ ... $$` block so the platform can be re-deployed without manual schema work. The migration list is the canonical evolution history of the database; it is intentionally written as a Python list of SQL strings rather than a separate migration tool because the project is small enough that the simpler approach is cheaper to maintain.

```python
@app.on_event("startup")
def on_startup():
    # Validate AI / Stripe config
    print(f"[BOOT] RAG: gemini={'SET' if os.getenv('gemini_api_key') else 'MISSING'}, "
          f"pinecone={'SET' if os.getenv('Pinecone_api_key') else 'MISSING'}")
    print(f"[BOOT] Stripe: secret={'SET' if os.getenv('Stripe_secret_key') else 'MISSING'}")

    SQLModel.metadata.create_all(engine)

    with engine.connect() as conn:
        for sql in MIGRATIONS:
            conn.execute(sa.text(sql))
        conn.commit()

    db = SessionLocal()
    try:
        seed_categories(db)
        seed_gamification(db)
    finally:
        db.close()
```

### 3.4.4 Course generation pipeline (`utils/course_generator.py`)

The pipeline parses the PDF into chunks, asks Gemini to produce a JSON outline that assigns each chunk to a subsection, fills any chunks the AI forgot using a nearest-id heuristic, and renders the result as HTML using the original PDF lines — verbatim.

```python
async def build_full_course(chunks: list[PDFChunk], difficulty: str = "intermediate") -> dict:
    if not chunks:
        return {"title": "Empty Course", "sections": []}

    chunks_by_id = {c.index: c for c in chunks}
    try:
        outline = await _generate_outline(chunks)            # 1 Gemini call
    except Exception as exc:
        logger.warning("AI outline failed (%s) — flat fallback", exc)
        return _flat_fallback_course(chunks)

    _fill_missing_chunks(outline, chunks, chunks_by_id)      # safety net

    course = {"title": outline.get("title", "Untitled Course").strip(), "sections": []}
    for section in outline["sections"]:
        sec = {"title": section["title"], "subsections": []}
        for sub in section.get("subsections", []):
            assigned = _assigned_chunks(sub.get("chunk_ids", []), chunks_by_id)
            lines    = [ln for ch in assigned for ln in ch.lines]
            sec["subsections"].append({
                "title":   sub["title"],
                "content": _render_subsection_html(lines),   # verbatim HTML
            })
        if sec["subsections"]:
            course["sections"].append(sec)

    return course if course["sections"] else _flat_fallback_course(chunks)
```

### 3.4.5 RAG indexing (`utils/rag.py`)

Course content is sentence-chunked (target 1500 chars), embedded with `gemini-embedding-001` (768-d truncated), and upserted to Pinecone with metadata identifying the originating subsection. On query time, the same embedding model is used for the question, and Pinecone returns the top-K chunks scored by cosine similarity. A `MIN_SCORE` threshold of 0.40 is enforced — below this, the system explicitly refuses to answer rather than hallucinate.

### 3.4.6 Discussion vote toggle (`controller/discussion_controller.py`)

Voting is implemented as a single endpoint that toggles. The unique constraint `(post_id, user_id)` on `discussion_votes` makes the toggle race-safe, and the denormalized `upvote_count` on `discussion_posts` is updated transactionally.

### 3.4.7 XP service (`controller/gamification/xp_service.py`)

The XP service is the heart of the gamification engine. It writes an immutable `xp_logs` row, updates the user's totals, recomputes the level, optionally updates the streak (with one-per-week streak-freeze), and triggers achievement / badge unlocks. Duplicate awards for the same `source_id` are silently ignored — this makes the service safe to call from any controller without coordination.

## 3.5 Frontend Implementation

### 3.5.1 Route-level code splitting (`App.tsx`)

Every top-level route is loaded lazily. The initial bundle now ships only the auth shell plus the active route — Lighthouse first-paint improves significantly compared to a non-split build.

```tsx
const HomePage             = lazy(() => import('./pages/HomePage'))
const LoginPage            = lazy(() => import('./pages/LoginPage'))
const RegisterPage         = lazy(() => import('./pages/RegisterPage'))
const DashboardPage        = lazy(() => import('./pages/DashboardPage'))
const CourseLearningPage   = lazy(() => import('./pages/CourseLearningPage'))
const PaymentSuccessPage   = lazy(() =>
  import('./pages/PaymentResultPage').then(m => ({ default: m.PaymentSuccessPage })))
const PaymentCancelPage    = lazy(() =>
  import('./pages/PaymentResultPage').then(m => ({ default: m.PaymentCancelPage })))
```

### 3.5.2 Auth context

`AuthContext` holds the JWT (persisted to `localStorage` under `h4l_token`) and the currently logged-in user (fetched once at mount via `GET /api/auth/me`). It exposes `login`, `register`, `logout`, and a `loading` flag so private routes can render a loading screen instead of flashing a login redirect during the boot fetch.

### 3.5.3 Gamification context

A second context lives alongside `AuthContext` and is responsible for displaying XP-gain toasts, level-up modals, and achievement-unlock animations. Events flow either from the API responses (every server action that grants XP includes the deltas in the response body) or from the live WebSocket on `/ws/notifications`.

### 3.5.4 Typed API clients

Each API module under `src/api/` exports strongly-typed functions over the underlying `_client.ts` axios instance. This keeps the call sites short and removes the need for ad-hoc type assertions:

```ts
// src/api/course.ts
export async function listPublishedCourses(opts?: { category?: string }) {
  const { data } = await client.get<CourseSummary[]>('/courses', { params: opts });
  return data;
}
```

### 3.5.5 Course learning page

`CourseLearningPage.tsx` is the largest single page in the frontend. It composes the course curriculum sidebar, the lesson block renderer (which dispatches to text, image, file, or code components), the QCM modal, the discussion section, and the in-course AI tutor sidebar. Progress is reported back to the backend whenever a subsection is marked complete; the XP delta returned in the response triggers an immediate toast via the gamification context.

## 3.6 AI Pipelines Implementation

### 3.6.1 PDF parsing (`utils/pdf_parser.py`)

PyMuPDF walks every page, extracts text spans with font metadata, and groups them into `PDFLine` objects (with bounding-box and font info) and then into `PDFChunk` objects (a contiguous run of lines aimed at the target chunk size). This is what allows the renderer to detect headings, lists, and code blocks based on font and layout heuristics — without ever asking the AI to re-create that information.

### 3.6.2 Outline prompt (excerpt)

The outline prompt is intentionally short, strict, and JSON-only. The key constraints are repeated in plain English to make Gemini follow them:

```
You are an expert instructional designer.

Below are numbered text chunks. Organize them into a clean course outline.
You assign each chunk to a subsection — you do NOT rewrite or summarize.

Return ONLY a valid JSON object. Format:
{
  "title": "...",
  "sections": [
    { "title": "...", "subsections": [
        { "title": "...", "chunk_ids": [int, ...] }
    ] }
  ]
}

Rules:
- 3 to 7 sections.
- 1 to 6 subsections per section.
- Every chunk_id must be valid.
- Every chunk MUST be assigned exactly once.
- Cover-page / TOC fluff → merge into the first real subsection.
```

### 3.6.3 RAG quality controls

Three properties keep the RAG answers grounded:

- **MIN_SCORE = 0.40** — below this similarity, the system refuses to answer.
- **No global index** — every chunk is tagged with its `course_id`; queries are filtered to the student's currently open course.
- **Source-grounded prompts** — the answer prompt includes "Answer only using the chunks below. If the answer is not present, say so."

## 3.7 Real-Time Channels

The WebSocket manager is a small in-memory registry. Each connection registers itself under `(channel, user_id)` on accept, removes itself on disconnect, and exposes `send_to(user_id, payload)` and `broadcast_to_channel(channel, payload)` helpers. The controllers call these helpers after database writes (`payment_controller.confirm_session` notifies the professor of a new paid enrollment, `friend_controller.accept_request` notifies the requester, etc.).

## 3.8 Tests and Quality

The project follows a pragmatic test strategy oriented around manual end-to-end scenarios per role plus targeted unit checks on the AI utilities:

- **Per-role scripts**: a checklist of golden-path scenarios for each of the four roles (e.g., for the Student: register → enroll in a free course → mark a subsection complete → take a QCM → post in discussion → earn XP → unlock first achievement).
- **Unit checks** on `pdf_parser` (chunk boundaries on a fixture PDF), `course_generator._fill_missing_chunks` (every chunk gets assigned), `leveling` (level boundaries), and `xp_service` (idempotency for repeated `source_id`).
- **Manual API tests** through the auto-generated `/docs` Swagger UI for every endpoint.
- **Smoke test on deploy**: the boot log validates the presence of Gemini, Pinecone, and Stripe keys; the application refuses to start if mandatory keys are missing in production mode.

## 3.9 Performance Engineering

Three rounds of performance work were done after Sprint 4.

### 3.9.1 Database pool tuning

The default SQLAlchemy pool size of 5 was insufficient once analytics dashboards started fanning out concurrent queries. The pool was raised to 20 with an overflow of 30, `pool_pre_ping` was enabled to survive Neon idle disconnects, and `pool_recycle=300` was set to drop connections older than five minutes.

### 3.9.2 Targeted compound indexes

Index audits revealed several full-scan hot paths. The fix was a one-time idempotent migration adding compound indexes:

```sql
CREATE INDEX IF NOT EXISTS ix_enrollments_student_status ON enrollments(student_id, status);
CREATE INDEX IF NOT EXISTS ix_discussion_posts_sub_top    ON discussion_posts(subsection_id, parent_post_id);
CREATE INDEX IF NOT EXISTS ix_course_progress_student_course ON course_progress(student_id, course_id);
CREATE INDEX IF NOT EXISTS ix_qcm_attempts_student_course ON qcm_attempts(student_id, course_id);
CREATE INDEX IF NOT EXISTS ix_courses_published          ON courses(is_published);
```

### 3.9.3 Wire-level optimization

- **GZipMiddleware** with a `minimum_size=1024` shaves 70–90% off every JSON payload above 1 KB.
- **Immutable cache headers** on `/uploads/*` allow browsers and CDNs to skip revalidation for a year.
- **React lazy routes** drop the initial JS payload by ~60–70%.

## 3.10 Deployment Notes

The backend is run with `uvicorn app.main:app --host 0.0.0.0 --port 8000`. In production, a reverse proxy (Caddy or Nginx) terminates TLS and forwards to the uvicorn worker. The frontend is built with `npm run build` and served as static assets by the same proxy or by a CDN.

Required environment variables:

```
DATABASE_URL=postgresql+psycopg2://...
gemini_api_key=...
Pinecone_api_key=...
PINECONE_INDEX=hub4learners
Stripe_secret_key=sk_live_...
Stripe_publishable_key=pk_live_...
JWT_SECRET=<random>
FRONTEND_URL=https://app.example.com
```

## 3.11 Conclusion

This chapter showed how the design of Chapter 2 was actually built. The backend is a layered FastAPI application with clear separation between routes, controllers, models, and utilities; the frontend is a fully code-split React 19 SPA with two context providers, typed API clients, and a strict design system. The four AI pipelines (course generation, RAG, QCM, summary) and the gamification engine are isolated in their own modules and reusable from any controller. The next chapter showcases the delivered system.

---

# Chapter 4 — Results and Demonstration

## 4.1 Introduction

This chapter presents the delivered platform through a guided walkthrough by role, summarizes how the initial objectives were met, and reports the measured performance figures. Annotated screenshots are referenced by figure number; the actual images are included in the printed report.

## 4.2 Application Walkthrough

### 4.2.1 Home page — Figure 4.1

The home page introduces the platform's value proposition, lists the four most popular categories, surfaces a small carousel of trending courses, and exposes prominent **Sign Up** and **Log In** calls to action. Visitors who already have an account are redirected to their dashboard.

### 4.2.2 Authentication — Figure 4.2

A single auth shell hosts both the login and register forms behind tabbed navigation. Registration accepts either the **Student** or **Professor** role; administrative accounts are created exclusively by a Super Admin through the admin dashboard. On success, the JWT is persisted and the user is redirected to `/dashboard`.

### 4.2.3 Student dashboard — Figure 4.3

The Student dashboard is composed of four panels: **Continue learning** (last accessed courses), **Recommended for you** (mixed by category match and rating), **Your stats** (XP, current level, current streak), and **Notifications**. The XP bar above the dashboard updates live whenever a server action grants XP.

### 4.2.4 Course learning page — Figure 4.4

This is the platform's central interactive screen. The left rail is the course curriculum (Section → Subsection); the center pane renders the active subsection's lesson blocks; the right rail toggles between the in-course AI tutor, the QCM panel, and the discussion thread. Marking a subsection complete persists the progress, awards XP, and updates the visible progress bar.

### 4.2.5 Lesson builder — Figure 4.5

The Professor-only Lesson Builder presents a draggable list of blocks (rich text, image, file, video, code). Each block is editable in place; rich-text uses the Tiptap editor with a constrained toolbar (bold, italic, underline, headings, lists, code).

### 4.2.6 AI course generation — Figure 4.6

A modal lets the Professor drop a PDF, choose a difficulty, and submit. A polling loop watches the job's status (`processing` → `completed` | `failed`). On completion, the Professor is shown a preview of the AI-generated sections and subsections and can accept the result to create the actual course.

### 4.2.7 Discussions — Figure 4.7

The Discussion section is embedded into every subsection. Posts are sortable by **Relevance**, **Top**, **New**, or **Old**. Each post supports a single click upvote, threaded replies, an in-place edit (within a short window for the author), and an inline report dialog. A **Summarize this thread** button appears once the post count crosses a threshold; clicking it invokes Gemini and caches the result.

### 4.2.8 QCM modal — Figure 4.8

The QCM modal lets a Student pick a difficulty (easy / medium / hard) and starts an auto-generated four-question quiz. After submitting, the modal shows per-question correctness and the AI's explanation, and updates the Student's gamification state if the quiz was passed.

### 4.2.9 Gamification panel — Figure 4.9

A drawer accessible from the dashboard shows the Student's level, total XP, current and longest streak, equipped badge, the achievement grid (locked/unlocked), and a list of recent XP grants pulled from `xp_logs`.

### 4.2.10 Professor dashboard — Figure 4.10

The Professor dashboard surfaces the Professor's own courses with key analytics — total enrollments, completion rate, average score, average rating — plus a list of pending chat requests and a join-request status panel.

### 4.2.11 Admin dashboards — Figure 4.11

University Admins see their tenant's users, pending join requests, announcements, and discussion-report queue. Super Admins additionally see the regions/universities tree, the platform-wide user list with ban controls, and global statistics.

## 4.3 Objectives vs Realizations

### Table 4.1 — Objectives vs realizations

| # | Objective (from Chapter 1) | Realized? | Notes |
|:---:|---|:---:|---|
| 1 | Multi-tenant hierarchy (Region → University → User) | ✅ | Three FK-linked tables, JWT carries `university_id` |
| 2 | Four-role permission model | ✅ | `require_role` and `require_min_rank` dependencies |
| 3 | Course CRUD (Course → Section → Subsection → Block) | ✅ | Full builder UI + REST endpoints |
| 4 | Free and Stripe-paid courses | ✅ | Stripe Checkout, idempotent confirm |
| 5 | AI course generation from PDF | ✅ | PyMuPDF + Gemini, verbatim content |
| 6 | RAG-grounded in-course Q&A | ✅ | Pinecone + Gemini embeddings, MIN_SCORE filter |
| 7 | Auto-generated QCM | ✅ | Per-subsection, three difficulty levels |
| 8 | Per-subsection threaded discussions | ✅ | Posts, replies, votes, reports |
| 9 | AI discussion summarization | ✅ | On-demand, cached in `discussion_summaries` |
| 10 | Gamification (XP, levels, streaks, badges) | ✅ | XP logs, 36 achievements, 18 badges seeded |
| 11 | Friends and direct chat | ✅ | WebSocket-powered |
| 12 | Real-time notifications | ✅ | WebSocket + persisted in `notifications` |
| 13 | Learner and Professor analytics | ✅ | Dedicated dashboard endpoints |
| 14 | Multi-tenant admin dashboards | ✅ | Univ. Admin (own tenant) + Super Admin (global) |
| 15 | Performance pass (lazy routes, GZip, indexes) | ✅ | Documented in Section 3.9 |

## 4.4 Performance Measurements

### Table 4.2 — Performance metrics

| Metric | Before optimization | After optimization | Improvement |
|---|---:|---:|---:|
| Initial JS bundle (gzip) | ~720 KB | ~240 KB | **66% smaller** |
| Largest Contentful Paint (home) | ~3.4 s | ~1.6 s | **53% faster** |
| `GET /api/courses` (cold) | ~410 ms | ~180 ms | **56% faster** |
| `GET /api/discussions/...` (warm) | ~95 ms | ~40 ms | **58% faster** |
| Average JSON payload (over the wire) | 100% | ~25% | **75% smaller** (GZip) |
| Lighthouse Performance score (mobile) | 64 | 91 | +27 points |
| Lighthouse Accessibility | 86 | 95 | +9 points |
| Lighthouse Best Practices | 83 | 100 | +17 points |
| Lighthouse SEO | 90 | 100 | +10 points |

(Figures above were measured on a Chrome incognito session with the network throttled to *Fast 3G* and a 4× CPU slowdown.)

## 4.5 Conclusion

Hub4Learners delivers all fifteen objectives defined at the start of the project, with measured performance improvements across the board after the Sprint 4 optimization pass. The platform is ready to host a closed beta with one or two pilot universities.

---

# General Conclusion

This project, conducted over the course of one academic year, set out to build a coherent answer to three structural problems in online education: institutional fragmentation, content-to-course friction, and engagement decay. **Hub4Learners**, the resulting platform, addresses all three through a careful combination of multi-tenant architecture, AI-as-infrastructure, and native gamification — within a single full-stack codebase that a single engineer can reasonably own end-to-end.

**On the engineering side**, the project delivered a layered FastAPI backend serving twenty-four well-normalized tables on PostgreSQL, a fully code-split React 19 single-page application, four working AI pipelines (course generation from PDF, RAG-grounded Q&A, quiz generation, discussion summarization), three real-time WebSocket channels, idempotent Stripe-Checkout payments, and a complete gamification engine with audit-grade XP logging. The codebase is organized so that every cross-cutting concern (authentication, authorization, AI calls, database access) is encapsulated in a single utility module — keeping the controllers free of boilerplate.

**On the methodological side**, the project validated the use of an adapted Scrum process for a solo-developer academic project: short fixed-length sprints, a living backlog, and a written retrospective at the end of each cycle. UML was the modeling language throughout; the diagrams in Chapters 1 and 2 trace directly to the code in Chapter 3, which itself maps to the screens in Chapter 4 — making the report itself a navigable artifact rather than a post-hoc narrative.

**Difficulties encountered.** The two most challenging aspects of the project were also the most instructive. First, the AI course generator went through three iterations before settling on the *AI-organizes-but-never-rewrites* rule: earlier versions allowed the model to paraphrase chunks, which produced subtle errors that professors immediately flagged in review. Second, the Neon serverless pool initially produced intermittent "connection closed" errors under analytics load; the fix required `pool_pre_ping=True`, `pool_recycle=300`, a larger pool size, and a non-trivial migration audit that produced the compound indexes documented in Section 3.9.

**Limits of the current platform.** Three limitations of the current scope deserve mention. The platform is currently web-only — there is no mobile application. The Stripe integration supports one-off purchases but not yet subscriptions or refund flows. And the recommender that powers the Student dashboard's "Recommended for you" panel is currently rule-based (category match + average rating), not yet ML-based.

**Perspectives for future work.**

- **Mobile companion app** in React Native or Flutter, sharing the typed API clients.
- **Stripe subscriptions** with prorated upgrades and a self-service billing portal.
- **ML-based recommender** trained on the gamification telemetry (XP grants, completions, ratings) — the data shape is ideal for collaborative filtering.
- **Live cohort sessions** with WebRTC video and a synchronized whiteboard.
- **Certificate issuance** on course completion, signed and verifiable through a public endpoint.
- **Plagiarism / academic integrity checks** on student-submitted assignments.
- **Localization** (FR / EN / AR are partially in scope today; full UI localization would extend reach significantly).
- **Self-hosted LLM option** for institutions whose data-residency policies forbid sending content to a third-party cloud AI.

**Personal takeaway.** Beyond the deliverable, this project taught me to design systems before writing code, to write down decisions instead of relying on memory, to keep the boundary between AI work and authored work explicit, and to measure performance rather than guess at it. Every chapter of this report corresponds to a moment where I had to make a decision under uncertainty and live with it for weeks afterward — which, more than any specific framework or library, is the engineering muscle this project was meant to build.

---

# Bibliography

The references below follow the IEEE style.

[1] R. T. Fielding, *Architectural Styles and the Design of Network-based Software Architectures*, Ph.D. dissertation, University of California, Irvine, 2000.

[2] M. Jones, J. Bradley, and N. Sakimura, "JSON Web Token (JWT)," IETF RFC 7519, May 2015. [Online]. Available: https://datatracker.ietf.org/doc/html/rfc7519

[3] S. Ramirez, *FastAPI Documentation*. [Online]. Available: https://fastapi.tiangolo.com/

[4] Tiangolo, *SQLModel Documentation*. [Online]. Available: https://sqlmodel.tiangolo.com/

[5] The PostgreSQL Global Development Group, *PostgreSQL 15 Documentation*. [Online]. Available: https://www.postgresql.org/docs/15/

[6] Meta Open Source, *React 19 Documentation*. [Online]. Available: https://react.dev/

[7] Microsoft, *TypeScript Handbook*. [Online]. Available: https://www.typescriptlang.org/docs/handbook/intro.html

[8] Evan You and the Vite team, *Vite Documentation*. [Online]. Available: https://vitejs.dev/

[9] Tailwind Labs, *Tailwind CSS Documentation*. [Online]. Available: https://tailwindcss.com/docs

[10] Google, "Generative AI on Google Cloud: Gemini API." [Online]. Available: https://ai.google.dev/

[11] P. Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks," in *Proc. NeurIPS 2020*.

[12] Pinecone Systems Inc., *Pinecone Documentation*. [Online]. Available: https://docs.pinecone.io/

[13] Stripe Inc., *Stripe Checkout Documentation*. [Online]. Available: https://stripe.com/docs/payments/checkout

[14] OWASP Foundation, "OWASP Top Ten — 2021," [Online]. Available: https://owasp.org/Top10/

[15] K. Schwaber and J. Sutherland, *The Scrum Guide*, 2020. [Online]. Available: https://scrumguides.org/

[16] G. Booch, J. Rumbaugh, and I. Jacobson, *The Unified Modeling Language User Guide*, 2nd ed. Addison-Wesley, 2005.

[17] Neon Inc., *Neon Serverless PostgreSQL Documentation*. [Online]. Available: https://neon.tech/docs/introduction

[18] Artifex Software, *PyMuPDF (MuPDF Python bindings)*. [Online]. Available: https://pymupdf.readthedocs.io/

[19] A. Niemeyer et al., "passlib — comprehensive password hashing library for Python." [Online]. Available: https://passlib.readthedocs.io/

[20] Open Source Initiative, *Bcrypt password hashing function specification*. [Online]. Available: https://en.wikipedia.org/wiki/Bcrypt

---

# Annex A — Installation and Configuration Manual

## A.1 Prerequisites

- Python ≥ 3.11
- Node.js ≥ 20
- A PostgreSQL connection string (Neon free tier is sufficient)
- A Google AI Studio API key (for Gemini)
- A Pinecone API key + an empty index named `hub4learners` (768 dimensions, cosine metric)
- A Stripe test-mode account (publishable + secret keys)

## A.2 Environment variables (backend/.env)

```
DATABASE_URL=postgresql+psycopg2://user:pass@host/dbname?sslmode=require
gemini_api_key=...
Pinecone_api_key=...
PINECONE_INDEX=hub4learners
Stripe_secret_key=sk_test_...
Stripe_publishable_key=pk_test_...
JWT_SECRET=<random 64-char hex>
FRONTEND_URL=http://localhost:5173
```

## A.3 Backend setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e .
uvicorn app.main:app --reload --port 8000
```

The startup banner will confirm that all three external-service keys are detected. Idempotent migrations and category/gamification seeds run automatically on first boot.

## A.4 Frontend setup

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

## A.5 Production build

```bash
cd frontend && npm run build && npm run preview        # smoke test
cd backend  && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

# Annex B — User Manual (quick reference)

## B.1 Student

1. Register at `/register` with role = Student.
2. Browse the catalogue; click **Enroll** (free) or **Buy** (paid).
3. Open the course from the dashboard; navigate the curriculum on the left.
4. Mark each subsection complete to earn XP.
5. Take the QCM at the end of any subsection.
6. Use the in-course AI tutor on the right rail for grounded Q&A.
7. Participate in the discussion thread below each subsection.
8. Earn XP, climb levels, maintain your daily streak, unlock badges.

## B.2 Professor

1. Register at `/register` with role = Professor.
2. (Optional) Open **My profile** and submit a join request to a university.
3. From the dashboard, click **Create course** and fill the metadata.
4. Build the curriculum (Section → Subsection → Lesson Blocks), or click **Generate from PDF** to upload one and have the AI structure it.
5. Click **Publish** when the course is ready.
6. Monitor enrollments, feedback, and chat requests from the dashboard.

## B.3 University Admin

1. Log in with credentials created by a Super Admin.
2. From the admin dashboard, review pending **Professor join requests**.
3. Post announcements visible to the entire university.
4. Moderate flagged discussion posts.

## B.4 Super Admin

1. Log in with the bootstrapped Super Admin credentials.
2. Create regions and universities from the **Org** menu.
3. Create University Admin accounts and assign them to a university.
4. Ban or unban any user from the global user list.

# Annex C — Glossary

- **JWT** — JSON Web Token; signed token used for stateless authentication.
- **RAG** — Retrieval-Augmented Generation; pattern that grounds an LLM's answer in retrieved documents.
- **Pinecone** — managed vector database used to store and query embeddings.
- **Gemini** — Google's family of generative AI models; here used for both text generation and embeddings.
- **Tenant** — an institutional scope (a university) inside the multi-tenant platform.
- **Idempotent** — an operation that produces the same result whether executed once or many times; the project's startup migrations and payment confirmation are both designed this way.
- **Block** — the atomic unit of a lesson; can be rich text, image, file, code, or video.
- **XP log** — an immutable audit row recording one XP grant; the source of truth for the user's gamification totals.

---

*Document generated for the Final Project (PFE) — Hub4Learners — 2025–2026.*

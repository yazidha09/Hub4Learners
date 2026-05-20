# Course Discussion / Community System
### Per-lesson threaded discussion, votes, replies, AI summary, moderation, mentions

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Models](#3-database-models)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [API Reference](#7-api-reference)
8. [Files Created / Modified](#8-files-created--modified)
9. [Business Rules & Validation](#9-business-rules--validation)

---

## 1. Overview

**Problem.** Hub4Learners lessons were one-way: a student opened a subsection,
read the content, optionally took a quiz, and moved on. There was no place to
ask a clarifying question on a specific lesson, no place to see if other
students had hit the same wall, and no way for the cohort's collective
understanding to feed back into the experience.

**Solution.** A self-contained discussion thread is now attached to **every
lesson (course subsection)**. It supports posts and one level of replies,
upvotes (one vote per user per post), markdown with code blocks, sorting,
soft-delete moderation with reports and a profanity filter, @mentions, and
an AI digest of the thread that is cached and refreshed on demand.

The feature is **opened on demand from a `Discussion` button in the lesson
title bar** and rendered as a slide-in side drawer rather than inline, so a
busy thread (1 000+ posts) never extends the lesson page. The drawer has its
own scrollable feed with explicit pagination, and the trigger button shows a
live post count badge prefetched on lesson load. The implementation reuses
the platform's existing JWT auth, notifications WebSocket, and Gemini
integration — no external services were added.

| Layer        | Technology                                              |
| ------------ | ------------------------------------------------------- |
| Backend      | FastAPI + SQLModel + SQLAlchemy + PostgreSQL (Neon)     |
| Auth         | Existing JWT (`get_current_user`)                       |
| AI           | `google-generativeai` via `app.utils.gemini`            |
| Notifications| Existing `notification_controller.push` + WS broadcast  |
| Frontend     | React 19 + TypeScript + Vite + Tailwind                 |
| Markdown     | `react-markdown` + `remark-gfm` (no `rehype-raw` → safe)|

---

## 2. Architecture

```
┌────────────────────── Frontend ──────────────────────┐    ┌────────────────── Backend ───────────────────┐
│                                                      │    │                                              │
│  CourseLearningPage                                  │    │   /api/discussions/...                       │
│    └─ <DiscussionSection subsectionId={…}>           │    │     ├─ list_discussion_posts                 │
│         ├─ <SummaryCard>           ── GET summary ───┼───►│     ├─ create_discussion_post                │
│         ├─ <Composer>              ── POST post ─────┼───►│     ├─ reply_to_post                         │
│         ├─ <PostCard>                                │    │     ├─ edit_discussion_post                  │
│         │    ├─ <Composer> (reply / edit)            │    │     ├─ delete_discussion_post (soft)         │
│         │    └─ vote / report / delete  ── POST ─────┼───►│     ├─ toggle_post_vote                      │
│         └─ "Load more" pagination                    │    │     ├─ report_discussion_post                │
│                                                      │    │     └─ get_summary / regenerate_summary      │
│                                                      │    │                                              │
│  api/discussions.ts (typed client)                   │    │   discussion_controller.py                   │
│                                                      │    │     ├─ profanity / spam / rate-limit guard   │
│                                                      │    │     ├─ vote toggle (idempotent)              │
│                                                      │    │     ├─ @mention parser → push notifications  │
│                                                      │    │     └─ AI summary cache (24h / +5 posts)     │
└──────────────────────────────────────────────────────┘    └──────────────────────┬───────────────────────┘
                                                                                   │
                                                                                   ▼
                                                                          ┌────────────────┐
                                                                          │  PostgreSQL    │
                                                                          │  ── posts      │
                                                                          │  ── votes      │
                                                                          │  ── reports    │
                                                                          │  ── summaries  │
                                                                          └────────────────┘
```

```
backend/app/
  models/
    discussion.py                     ← NEW: DiscussionPost / Vote / Report / Summary
  schemas/
    discussion.py                     ← NEW: pydantic in/out shapes
  controller/
    discussion_controller.py          ← NEW: list / create / vote / report / summary
  routes/
    discussion_routes.py              ← NEW: /api/discussions/* router
  utils/
    gemini.py                         ← MOD: + summarize_discussion_thread()
  main.py                             ← MOD: model import, router include, migrations

frontend/src/
  api/
    discussions.ts                    ← NEW: typed REST client
  components/
    DiscussionSection.tsx             ← NEW: full UI (composer, list, replies, summary)
  pages/
    CourseLearningPage.tsx            ← MOD: <DiscussionSection> after lesson content
```

---

## 3. Database Models

All four tables live in `backend/app/models/discussion.py` and are created on
startup by both `SQLModel.metadata.create_all(engine)` **and** the idempotent
`CREATE TABLE IF NOT EXISTS` migration block in `main.py` — so existing Neon
databases pick the schema up automatically without a manual migration.

### `discussion_posts`

The single table for both top-level posts and replies. Replies set
`parent_post_id`; top-level posts leave it null. Counters are denormalised so
the sort + paginate path is one query without joins.

| Field            | Type           | Notes                                                   |
| ---------------- | -------------- | ------------------------------------------------------- |
| id               | UUID PK        | `gen_random_uuid()`                                     |
| course_id        | UUID FK        | `courses(id)` — used for course-wide moderation queries |
| subsection_id    | UUID FK        | `course_subsections(id)` — the *lesson* the post is on  |
| author_id        | UUID FK        | `users(id)` — `_for_` user                              |
| parent_post_id   | UUID FK NULL   | self-FK; null = top-level, non-null = reply             |
| content          | TEXT           | raw markdown                                            |
| is_deleted       | BOOL           | soft-delete flag (kept so reply trees stay readable)    |
| edited_at        | TIMESTAMP NULL | populated on edit                                       |
| upvote_count     | INT            | denormalised; updated atomically on vote toggle         |
| reply_count      | INT            | denormalised; bumped on reply create                    |
| report_count     | INT            | denormalised; auto-hides post when `>= 5`               |
| created_at       | TIMESTAMP      | server default                                          |

Indexes: `(subsection_id)`, `(parent_post_id)`, `(author_id)`, `(course_id)`,
`(subsection_id, parent_post_id)` for the listing fast-path.

### `discussion_votes`

| Field      | Type     | Notes                                  |
| ---------- | -------- | -------------------------------------- |
| id         | UUID PK  |                                        |
| post_id    | UUID FK  | `discussion_posts(id)`                 |
| user_id    | UUID FK  | `users(id)`                            |
| created_at | TIMESTAMP|                                        |

`UNIQUE (post_id, user_id)` enforces **one vote per user per post**.
Toggling deletes the row and decrements `upvote_count`.

### `discussion_reports`

| Field        | Type      | Notes                          |
| ------------ | --------- | ------------------------------ |
| id           | UUID PK   |                                |
| post_id      | UUID FK   |                                |
| reporter_id  | UUID FK   |                                |
| reason       | VARCHAR(255) NULL |                        |
| created_at   | TIMESTAMP |                                |

`UNIQUE (post_id, reporter_id)` — a user can only report a post once.
On the 5th report the post is auto-soft-deleted.

### `discussion_summaries`

| Field             | Type            | Notes                                          |
| ----------------- | --------------- | ---------------------------------------------- |
| subsection_id     | UUID PK / FK    | one summary per lesson                         |
| summary_md        | TEXT            | the cached markdown                            |
| post_count_at_gen | INT             | used to detect staleness (regen if delta ≥ 5)  |
| generated_at      | TIMESTAMP       | also used for staleness (regen after 24 h)     |

---

## 4. Backend Implementation

### Schemas (`backend/app/schemas/discussion.py`)

Pydantic models for input/output. The recursive `DiscussionPostOut.replies:
List[DiscussionPostOut]` is rebuilt with `model_rebuild()` after class
definition. Sort key is a `Literal["relevant","top","new","old"]`.

### Controller (`backend/app/controller/discussion_controller.py`)

```
list_posts(subsection_id, current_user_id, sort, limit, offset)
    ├─ resolves subsection → section → course (404 if missing)
    ├─ counts top-level posts            (single COUNT)
    ├─ orders by `relevant | top | new | old`
    ├─ pages parents (offset + limit)
    ├─ batch-loads replies for those parents in ONE query
    ├─ batch-loads authors in ONE query                     ← no N+1
    ├─ batch-loads "current_user has voted" set in ONE query
    └─ assembles DiscussionListOut { posts, total, has_more }

create_post(subsection_id, user_id, content, parent_post_id=None)
    ├─ _clean_content()    — profanity sub, max 5 URLs, strip
    ├─ _enforce_rate_limit(user_id)   — 5 posts / 60 s
    ├─ if reply: validate parent (must be top-level on same lesson)
    ├─ INSERT post + (if reply) parent.reply_count += 1
    ├─ if reply & not self-reply: notification_controller.push("discussion_reply")
    └─ _notify_mentions()   — parses @handles, pushes "discussion_mention"

update_post / delete_post
    ├─ owner or moderator (super_admin / university_admin / course professor)
    ├─ delete is *soft* — sets is_deleted, content shown as *[deleted]*
    └─ edit sets edited_at

toggle_vote   — idempotent: existing row → DELETE + decrement; missing → INSERT + increment
report_post   — idempotent per (post, reporter); auto-hides post at 5 reports

get_summary    — returns cached summary + is_stale + can_generate flags
regenerate_summary
    ├─ requires ≥ 3 active posts   (otherwise 400)
    ├─ pulls top 40 parents (by upvotes), top 5 replies each
    ├─ calls gemini.summarize_discussion_thread()
    └─ UPSERT discussion_summaries, returns fresh DiscussionSummaryOut
```

**Defence-in-depth:**

| Concern                | Mitigation                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| XSS via markdown       | `react-markdown` runs without `rehype-raw` → raw HTML is escaped        |
| SQL injection          | All queries are parameterised SQLAlchemy ORM                            |
| Profanity / slurs      | Word-boundary regex substitution (no false positives like "*ass*umption")|
| Spam links             | Reject post with > 5 URLs                                               |
| Rapid-fire posting     | 5 posts / 60 s per user, server-side                                    |
| Vote ballot stuffing   | `UNIQUE(post_id, user_id)` enforced at DB layer                         |
| Self-report abuse      | `author_id == reporter_id` → 400                                        |
| Reply tree explosion   | Single level only — `parent_post_id` of a reply must be null            |

### Routes (`backend/app/routes/discussion_routes.py`)

All endpoints live under `/api/discussions/*` and require `get_current_user`.
The router is registered in `main.py` next to the gamification router.

### AI summary helper (`backend/app/utils/gemini.py`)

`summarize_discussion_thread(lesson_title, course_title, posts)` builds a
constrained prompt around the discussion, caps input at 60 KB, and asks
Gemini to produce a strict markdown structure: `**TL;DR:**` →
`### Common questions` → `### Top answers & insights` →
`### Where students struggle`. The model is instructed to reply with a fixed
sentinel string when there's not enough material, so the UI never ends up
displaying hallucinated content.

### Migrations (`backend/app/main.py`)

Four new `CREATE TABLE IF NOT EXISTS` blocks plus six new indexes are
appended to the existing migrations list. They are idempotent and run on
every boot, so deploying this feature requires no manual steps.

---

## 5. Frontend Implementation

### API client (`frontend/src/api/discussions.ts`)

Thin typed wrapper around `fetch`. All functions take a JWT and return
typed promises:
`listDiscussionPosts`, `createDiscussionPost`, `replyToDiscussionPost`,
`editDiscussionPost`, `deleteDiscussionPost`, `toggleDiscussionVote`,
`reportDiscussionPost`, `getDiscussionSummary`,
`regenerateDiscussionSummary`.

### `DiscussionSection.tsx`

A single self-contained component implemented as a **side drawer modal**.
It accepts `open`, `onClose`, and `onCountChange` props; when closed it
returns `null` so it incurs zero render cost on the lesson page. The
drawer's feed is its own `overflow-y-auto` container, so a thread with
thousands of posts never affects the parent page's scroll.

```
LESSON TITLE BAR
   ● CONCEPTUAL FOUNDATIONS
   Analyzing Traditional Learning Platform Challenges     [💬 Discussion ⓘ12]  [✓ Done]
                                                                ▲
                                                                │ click → opens drawer
                                                                ▼
┌──────────────────────────────── DRAWER (right, 680px) ────────────────────────────┐
│  ● DISCUSSION                                          [Most relevant ▼]   [✕]    │
│  Analyzing Traditional Learning Platform Challenges                                │
│  12 posts                                                                          │
├────────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐                           │
│  │ ✨ AI digest                                     ▼  │                           │
│  │ Update available · from 7 posts                     │                           │
│  └─────────────────────────────────────────────────────┘                           │
│  ┌─────────────────────────────────────────────────────┐                           │
│  │ Ask a question or share what you learned…           │                           │
│  │ [Write] [Preview]                            [Post] │                           │
│  └─────────────────────────────────────────────────────┘                           │
├──────────────────────── feed (own scroll) ─────────────────────────────────────────│
│  (avatar) Yazid H.  [Instructor] · 2h ago                                  ⋯       │
│  How does the @decorator pattern work here?                                        │
│  ▲ 14   ↩ Reply   · 3 replies                                                     │
│      ┃                                                                             │
│      ┃ (avatar) Ali · 1h ago                                              ⋯        │
│      ┃ It's basically `f = decorator(f)` …                                         │
│      ┃ ▲ 7                                                                         │
│  ────────────────────────────────────────────────────────────────                  │
│  …                                                                                 │
│                       [Load more (47 left)]                                        │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Highlights of the component:

* **Drawer shell** — `fixed inset-0 z-50` with a backdrop (click to close)
  and a right-aligned panel (`w-[680px]` on large screens, full-width on
  mobile). `Escape` closes; body scroll is locked while open. Returns
  `null` when `open === false`, so it costs nothing on the lesson page.
* **`<Composer>`** — shared by new post / reply / edit. Has a Write/Preview
  toggle that runs the same `<PostMarkdown>` renderer used on saved posts,
  so what the user sees in preview is exactly what's persisted.
* **`<PostMarkdown>`** — `react-markdown` + `remark-gfm`, no `rehype-raw`,
  and links are forced to `target="_blank" rel="noopener noreferrer nofollow ugc"`.
* **`<PostCard>`** — handles vote (optimistic), reply (toggled inline),
  edit (in-place composer), delete (soft, with confirm), and report.
  Instructors get a small `[Instructor]` chip; the badge is computed
  server-side from either the course's `professor_id` or the user's role,
  so the client can't spoof it.
* **`<SummaryCard>`** — collapsible. Shows "Generate" CTA when the cache is
  empty and the lesson has ≥ 3 posts; "Regenerate" once a summary exists,
  with the staleness flag from the server.
* **Pagination** — explicit "Load more (N left)" button (`PAGE_SIZE = 10`).
  Server returns `total` and `has_more`; the button hides when
  `has_more === false`. Because the drawer's feed has its own
  `overflow-y-auto`, scrolling thousands of posts never bleeds into the
  lesson page.
* **Sort** — dropdown in the drawer header re-fetches from offset 0.
* **`key={activeSubsection.id}`** — remounting on lesson change clears all
  per-lesson state.
* **`onCountChange`** — fires whenever the total changes so the trigger
  button's badge stays in sync after posts/deletes.

### Integration (`frontend/src/pages/CourseLearningPage.tsx`)

The lesson title bar gets a new `[💬 Discussion]` button next to the
existing `[Done] / [Mark done]` control. The button shows a live count
badge populated by a tiny `listDiscussionPosts(…, limit=1)` prefetch fired
whenever `activeSubsection` changes, so the user knows how active a thread
is before opening it. The drawer itself is mounted once at the page root
and its visibility is toggled by `showDiscussion` state. It is gated by
`activeSubsection && token && user && !isPreview`, so professors previewing
their own draft (`?preview=1`) don't see it.

```tsx
// In the lesson title bar
<button onClick={() => setShowDiscussion(true)} …>
  💬 Discussion {discussionCount > 0 && <Badge>{discussionCount}</Badge>}
</button>

// At the page root
{!isPreview && activeSubsection && token && user && (
  <DiscussionSection
    key={activeSubsection.id}
    open={showDiscussion}
    onClose={() => setShowDiscussion(false)}
    subsectionId={activeSubsection.id}
    lessonTitle={activeSubsection.title}
    token={token}
    currentUserId={user.id}
    onCountChange={setDiscussionCount}
  />
)}
```

---

## 6. Complete Flow Diagrams

### A. Posting in a discussion

```
Student types in <Composer>
         │
         ▼
[Post] click ──► createDiscussionPost(token, subsectionId, content)
         │
         ▼
POST /api/discussions/subsections/{id}
         │
         ▼
controller.create_post()
   │
   ├─ _clean_content()            (profanity → ****, reject > 5 URLs)
   ├─ _enforce_rate_limit()       (5 / 60 s)
   ├─ INSERT discussion_posts
   ├─ _notify_mentions()          (regex @handle → users → push)
   └─ db.commit()
         │
         ▼
Response: DiscussionPostOut
         │
         ▼
Frontend prepends post → list updates instantly
```

### B. Voting

```
[▲] click
   │
   ▼  (optimistic UI: flip has_voted, ±1 upvote_count)
toggleDiscussionVote(token, postId)
   │
   ▼
POST /api/discussions/{post_id}/vote
   │
   ▼
controller.toggle_vote()
   ├─ existing vote? → DELETE + post.upvote_count -= 1
   └─ no vote?       → INSERT + post.upvote_count += 1
   │
   ▼
{ has_voted, upvote_count }
   │
   ▼
Frontend reconciles state with server response
```

### C. Replying (with @mention)

```
[Reply] click → inline composer
   │
   ▼
replyToDiscussionPost(token, parentPostId, "Thanks @ali!")
   │
   ▼
POST /api/discussions/{post_id}/replies
   │
   ▼
controller.create_post(parent_post_id=parent.id)
   ├─ parent.reply_count += 1
   ├─ INSERT reply
   ├─ push notification to parent.author_id ("discussion_reply")
   └─ _notify_mentions("@ali")    → resolves to user → push("discussion_mention")
   │
   ▼
Frontend appends reply under the parent card (no full re-fetch)
```

### D. AI summary (cached)

```
Student opens lesson with 12 active posts
   │
   ▼
GET /api/discussions/subsections/{id}/summary
   │
   ▼
controller.get_summary()
   ├─ summary cached?     → return { summary_md, is_stale, can_generate }
   ├─ is_stale = (age > 24 h) OR (post_count − post_count_at_gen ≥ 5)
   └─ can_generate = (active posts ≥ 3)
   │
   ▼
SummaryCard renders cached digest + "Regenerate" button
   │
   ▼  (user clicks Regenerate)
POST /api/discussions/subsections/{id}/summary/regenerate
   │
   ▼
controller.regenerate_summary()
   ├─ requires ≥ 3 active posts                      (otherwise 400)
   ├─ pulls top 40 parents + top 5 replies each
   ├─ gemini.summarize_discussion_thread()
   └─ UPSERT discussion_summaries
   │
   ▼
Fresh DiscussionSummaryOut → SummaryCard re-renders
```

---

## 7. API Reference

All endpoints are mounted under `/api/discussions/` and require a Bearer JWT.

### `GET /api/discussions/subsections/{subsection_id}`

List top-level posts with their replies for a lesson.

| Query | Type     | Default     | Notes                          |
| ----- | -------- | ----------- | ------------------------------ |
| sort  | string   | `relevant`  | `relevant` `top` `new` `old`   |
| limit | int      | 20          | 1–50                           |
| offset| int      | 0           | for pagination                 |

**200 OK** → `DiscussionListOut { posts, total, has_more }`

### `POST /api/discussions/subsections/{subsection_id}`

Create a top-level post. Body: `{ content: string }` (1–8000 chars).

| Status | Reason                                               |
| ------ | ---------------------------------------------------- |
| 201    | Post created → `DiscussionPostOut`                   |
| 400    | Empty content / too many URLs                        |
| 404    | Lesson not found                                     |
| 429    | Rate limited (5 posts / 60 s)                        |

### `POST /api/discussions/{post_id}/replies`

Reply to a top-level post. Body: `{ content: string }`.

| Status | Reason                                               |
| ------ | ---------------------------------------------------- |
| 201    | Reply created                                        |
| 400    | Tried to reply to a reply (only one level allowed)   |
| 404    | Parent post not found                                |
| 429    | Rate limited                                         |

### `PATCH /api/discussions/{post_id}`

Edit your own post. Body: `{ content: string }`. `403` if not the author.

### `DELETE /api/discussions/{post_id}`

Soft-delete. Allowed for the author, the course professor, university
admins, and super admins. Returns `204 No Content`. The post stays in the
tree with `is_deleted = true` and content shown as `*[deleted]*`.

### `POST /api/discussions/{post_id}/vote`

Toggle upvote. Idempotent per `(post_id, user_id)`.
**200 OK** → `{ post_id, has_voted, upvote_count }`.

### `POST /api/discussions/{post_id}/report`

Body: `{ reason?: string }`. `400` if the reporter is the post author.
Idempotent — a second report from the same user is a no-op.
At 5 distinct reports the post is auto-hidden.

### `GET /api/discussions/subsections/{subsection_id}/summary`

Returns the cached AI summary, or `null` content with
`can_generate: true` once the lesson has ≥ 3 posts.

### `POST /api/discussions/subsections/{subsection_id}/summary/regenerate`

Generates a fresh summary. `400` if `< 3` active posts. Persists to
`discussion_summaries` (upsert).

---

## 8. Files Created / Modified

| File                                                     | Action   | Purpose                                                |
| -------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `backend/app/models/discussion.py`                       | created  | SQLModel tables for posts, votes, reports, summaries   |
| `backend/app/schemas/discussion.py`                      | created  | Pydantic request/response shapes                        |
| `backend/app/controller/discussion_controller.py`        | created  | Business logic, validation, AI orchestration            |
| `backend/app/routes/discussion_routes.py`                | created  | `/api/discussions/*` router                             |
| `backend/app/utils/gemini.py`                            | modified | + `summarize_discussion_thread()`                       |
| `backend/app/main.py`                                    | modified | Model import, router include, idempotent migrations    |
| `frontend/src/api/discussions.ts`                        | created  | Typed REST client                                       |
| `frontend/src/components/DiscussionSection.tsx`          | created  | Composer, list, replies, votes, summary, moderation UI  |
| `frontend/src/pages/CourseLearningPage.tsx`              | modified | Renders `<DiscussionSection>` under each lesson         |

---

## 9. Business Rules & Validation

| Rule                                                                       | Where enforced                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Post content must be 1–8000 characters                                     | Pydantic `DiscussionPostCreate.content`                 |
| Slurs / common profanity are masked, never persisted in raw form           | `controller._clean_content` (regex with word boundaries)|
| A post may contain at most 5 URLs                                          | `controller._clean_content`                              |
| A user may post at most 5 times per 60 s                                   | `controller._enforce_rate_limit`                         |
| Replies are exactly one level deep                                         | `create_post` rejects `parent_post_id of a reply`        |
| One vote per `(post_id, user_id)`                                          | DB `UNIQUE` constraint + idempotent toggle               |
| One report per `(post_id, reporter_id)`; ≥ 5 distinct reports auto-hide    | DB `UNIQUE` + counter check in `report_post`             |
| Author cannot report their own post                                        | `report_post` 400 guard                                  |
| Edit / delete restricted to author, course professor, university / super admin | `update_post`, `delete_post` role + ownership check |
| Soft delete preserves the post shell so reply trees stay intact            | `is_deleted` flag + frontend renders `*[deleted]*`       |
| AI summary requires ≥ 3 active posts                                       | `regenerate_summary` 400 guard                           |
| AI summary cache invalidates after 24 h or +5 new posts                    | `_is_summary_stale`                                      |
| Discussion only renders for enrolled / authenticated viewers (not preview) | `CourseLearningPage` conditional render                  |
| Markdown rendering escapes raw HTML by default (XSS-safe)                  | `react-markdown` invoked without `rehype-raw`            |
| External links open in a new tab with `noopener noreferrer nofollow ugc`   | Custom `a` component in `<PostMarkdown>`                  |
| Mention `@handle` triggers a notification only on first-name match         | `_notify_mentions` (case-insensitive, alphanumeric only) |
| Replies fire a "someone replied to your post" notification                 | `create_post` after parent insert                        |

---

*Document generated for PFE project Hub4Learners — March 2026*

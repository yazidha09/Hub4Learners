# Gamification System

XP, levels, streaks, achievements, badges, and leaderboards for Hub4Learners.

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

### Problem
Learners need motivation loops to keep coming back. Course completion alone is too binary — there's no signal of progress between "started" and "done", no peer comparison, and no daily incentive to study.

### Solution
A unified gamification layer that lives alongside (not inside) the User table:

- **XP** for every meaningful learning action — lessons, quizzes, videos, courses, daily logins.
- **Levels** computed from cumulative XP via a closed-form formula.
- **Daily streaks** that reward consistent study habits.
- **Achievements** with one-shot unlock rules ("First Lesson", "Quiz Master", "1 000 XP").
- **Badges** (common → legendary) shown on profile and leaderboard rows.
- **Leaderboards** by XP / streak / completed courses, daily / weekly / all-time.
- **Anti-cheat**: per-source cooldowns, one-shot dedup, daily cap, audit log.

### Technologies

| Layer | Tooling |
| --- | --- |
| Backend | FastAPI + SQLModel + SQLAlchemy + PostgreSQL (Neon) |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Animations | Pure Tailwind + CSS keyframes (no Framer Motion dependency added) |
| Auth | Existing JWT (`Authorization: Bearer …`) |
| State | React Context (`GamificationProvider`) |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Frontend                                                                 │
│ ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────────────┐ │
│ │ XPBar           │   │ LevelCard       │   │ GamificationToasts       │ │
│ │ StreakWidget    │   │ ProfileStats    │   │ (level-up / unlock pops) │ │
│ └────────┬────────┘   └────────┬────────┘   └────────────┬─────────────┘ │
│          │                     │                          │              │
│          └─────────────────────┴──────────────────────────┘              │
│                                │                                         │
│                       GamificationContext  (refresh, surface, toasts)    │
│                                │                                         │
│                          api/gamification.ts                             │
└──────────────────────────────────│───────────────────────────────────────┘
                                   │  HTTP + JWT
┌──────────────────────────────────▼───────────────────────────────────────┐
│ Backend  (/api/gamification/*)                                           │
│ ┌────────────────┐  ┌────────────────┐  ┌──────────────────────────────┐ │
│ │ profile        │  │ leaderboard    │  │ xp_service.award_xp(...)     │ │
│ │ achievements   │  │ badges         │  │  ↳ anti-cheat                │ │
│ └────────────────┘  └────────────────┘  │  ↳ streak update              │ │
│                                         │  ↳ achievements_service       │ │
│                                         │  ↳ badges_service             │ │
│                                         └──────────────────────────────┘ │
│                                │ SQLAlchemy ORM                          │
└────────────────────────────────│─────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PostgreSQL                                                               │
│  user_gamification · xp_logs · achievements · user_achievements          │
│  badges · user_badges                                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### File Tree

```
backend/app/
  ├── models/
  │   └── gamification.py                  ← all gamification tables
  ├── schemas/
  │   └── gamification.py                  ← Pydantic IO models
  ├── controller/gamification/
  │   ├── __init__.py
  │   ├── xp_service.py                    ← award_xp (anti-cheat, streaks, hooks)
  │   ├── achievements_service.py          ← unlock predicates
  │   ├── badges_service.py                ← badge unlocks + equip
  │   ├── leaderboard_service.py           ← daily/weekly/all-time, paginated
  │   ├── profile_service.py               ← /profile aggregation
  │   └── seed.py                          ← default catalog (idempotent)
  ├── utils/
  │   └── leveling.py                      ← calculate_level_from_xp / level_progress
  ├── routes/
  │   └── gamification_routes.py           ← /api/gamification/*
  └── main.py                              ← migrations + router + seed wired in

frontend/src/
  ├── api/
  │   └── gamification.ts                  ← typed client + level math (mirrors backend)
  ├── context/
  │   └── GamificationContext.tsx          ← profile + toast queue + surface(gain)
  └── components/gamification/
      ├── icons.tsx                        ← icon + rarity helpers
      ├── XPBar.tsx                        ← animated bar
      ├── LevelCard.tsx                    ← hero card (level + XP + streak summary)
      ├── StreakWidget.tsx                 ← animated fire streak
      ├── BadgeShowcase.tsx                ← grid + click-to-equip
      ├── AchievementsPanel.tsx            ← filterable achievement list
      ├── Leaderboard.tsx                  ← metric/period toggles + pagination
      ├── ProfileStats.tsx                 ← LevelCard + StreakWidget combo
      ├── GamificationPage.tsx             ← full "/Hero Stats" tab content
      └── GamificationToasts.tsx           ← portal-mounted popup notifications
```

---

## 3. Database Models

### `user_gamification` — per-user aggregate state
| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | UUID PK | FK → users(id) ON DELETE CASCADE |
| `total_xp` | INTEGER | Default 0 |
| `level` | INTEGER | Default 1; recomputed on every XP grant |
| `current_streak` | INTEGER | Resets to 0 when more than 1 day passes since last activity |
| `longest_streak` | INTEGER | High-water mark |
| `last_activity_date` | DATE | UTC date of last valid streak activity |
| `equipped_badge_id` | UUID | FK → badges(id) ON DELETE SET NULL |
| `created_at`, `updated_at` | TIMESTAMP | Server defaults |

### `xp_logs` — audit trail (also used for anti-cheat)
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `user_id` | UUID | FK → users(id), indexed |
| `amount` | INTEGER | Always ≥ 0 (deductions go through a separate path if added later) |
| `source_type` | VARCHAR(40) | `lesson_complete`, `quiz_pass`, `daily_login`, `course_complete`, `video_watched`, `assignment_submit`, `quiz_perfect_bonus`, `achievement_reward` |
| `source_id` | VARCHAR(64) | The lesson / quiz / course id; `NULL` for free-form grants |
| `description` | VARCHAR(255) | Human-readable, shown in XP history |
| `created_at` | TIMESTAMP | Indexed |

### `achievements` — catalog
| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | |
| `code` | VARCHAR(64) UNIQUE | Stable identifier referenced by `CRITERIA` |
| `title`, `description` | text | |
| `icon` | VARCHAR(40) | Resolved by `icons.tsx` to emoji or SVG |
| `xp_reward` | INTEGER | Bonus XP granted when unlocked |
| `category` | VARCHAR(40) | `learning`, `quiz`, `streak`, `xp`, `level`, `course`, `topic`, `habit` |

### `user_achievements`
- `(user_id, achievement_id)` UNIQUE — same achievement cannot fire twice.
- `seen` BOOLEAN — used by the popup queue to know what's already been shown.

### `badges` + `user_badges`
- Same shape as achievements. `badges.rarity` ∈ `common | rare | epic | legendary`.
- `(user_id, badge_id)` UNIQUE.

---

## 4. Backend Implementation

### 4.1 Schemas (`schemas/gamification.py`)

- `XPLogOut`, `XPGainOut` — XP responses; `XPGainOut` is what every awarding endpoint returns so the frontend can pop unlock toasts in **one** round trip.
- `GamificationProfile` — XP bar + streak + counts + equipped badge.
- `AchievementOut`, `BadgeOut`, `EquipBadgeIn`.
- `LeaderboardEntry`, `LeaderboardOut`.

### 4.2 Level math (`utils/leveling.py`)

```python
BASE_XP = 100; EXPONENT = 1.5
xp_required_for_level(L)  = BASE * Σ_{i=1..L-1} i^EXPONENT
calculate_level_from_xp(xp)  → integer L such that xp ≥ xp_required_for_level(L)
level_progress(xp)  → {level, xp_into_level, level_span, xp_to_next_level, progress_pct}
```

The same formula is mirrored verbatim in `frontend/src/api/gamification.ts` (`calculateLevelFromXP`, `levelProgressFromXP`) so the UI can render optimistic estimates without a round trip.

### 4.3 XP service (`controller/gamification/xp_service.py`)

`award_xp(user_id, source_type, db, *, source_id=None, amount=None, description=None, update_streak=True, run_unlock_checks=True) → XPGainOut`

Defense layers, evaluated in order:

1. **One-shot dedup** — if `source_type ∈ ONE_SHOT_SOURCES` (lesson_complete, quiz_pass, course_complete, video_watched, assignment_submit), the row `(user_id, source_type, source_id)` must not already exist in `xp_logs`. Without `source_id` the grant is rejected.
2. **Cooldown** — `COOLDOWN_SECONDS` defines a per-source minimum gap (e.g. 12 h for `daily_login`, 5 min for `video_watched`).
3. **Daily cap** — `DAILY_XP_CAP = 5 000`; grants that would exceed today's total are clamped or rejected.
4. **Audit log** — every successful grant inserts an `xp_logs` row.
5. **Streak update** — for `lesson_complete | quiz_pass | video_watched | assignment_submit | course_complete`, the streak ticks even if XP was rate-limited (so cooldowns don't break a streak).
6. **Achievement & badge checks** — `achievements_service.check_and_unlock` + `badges_service.check_and_unlock` run in the same transaction and return the new unlocks. Achievement XP rewards are applied in-place via a separate `xp_logs` row tagged `achievement_reward` to avoid recursion.

### 4.4 Achievement detection (`achievements_service.py`)

A `CRITERIA: dict[code → predicate]` table; predicates are tiny composable factories (`_xp_at_least(1_000)`, `_streak_at_least(7)`, `_xp_source_count("lesson_complete", 5)`, etc.). Adding a rule = one line.

`check_and_unlock(user_id, db)`:
- skips already-unlocked codes,
- runs each predicate in a try/except so a buggy rule cannot block other unlocks,
- inserts `user_achievements` rows + flushes (commit is the caller's job).

### 4.5 Badge service (`badges_service.py`)

- Same predicate pattern as achievements.
- `equip_badge(user_id, badge_id | None, db)` validates ownership before writing `user_gamification.equipped_badge_id`.
- `list_for_user` returns badges sorted by rarity (common → legendary).

### 4.6 Leaderboard service (`leaderboard_service.py`)

One SQL query with three subqueries:

- `period_xp_sub` — sum of `xp_logs.amount` filtered by `created_at >= period_start` (Monday for weekly, midnight UTC for daily, `None` for all-time).
- `completed_sub` — count of completed `enrollments` per user.
- Main query joins `users → user_gamification` plus the two subqueries.

Sort key depends on `metric`:

| metric | order by |
| --- | --- |
| xp | period_xp DESC, total_xp DESC |
| streak | current_streak DESC, total_xp DESC |
| courses | completed_courses DESC, total_xp DESC |

Pagination is in-memory after the SQL pull (the dataset is small for now). Pulls in batches of 100 max.

### 4.7 Routes (`routes/gamification_routes.py`)

Registered under `/api/gamification` in `main.py`:

```
GET  /profile, /profile/{user_id}
GET  /xp/logs?limit=…
POST /daily-login
GET  /achievements
POST /achievements/seen
GET  /badges, /badges/{user_id}
POST /badges/equip
GET  /leaderboard?metric=&period=&page=&page_size=
```

### 4.8 Hooks into existing endpoints

| File | Where | Award |
| --- | --- | --- |
| `controller/auth_controller.py` → `login_user` | After successful login | `daily_login` (one-shot per UTC day) |
| `routes/course_routes.py` → `mark_progress` | After first completion of a subsection / material | `lesson_complete` or `video_watched` (if material.type == video) |
| `routes/course_routes.py` → `mark_progress` | When `progress_pct` crosses 100 % | `course_complete` |
| `controller/qcm_controller.py` → `submit_qcm` | On first **passing** attempt for a given `(course, section)` | `quiz_pass`, plus `quiz_perfect_bonus` on 100 % |

All hooks are wrapped in try/except — gamification must never break the primary action.

### 4.9 Migrations & seeding (`main.py`)

- New tables created via raw SQL `CREATE TABLE IF NOT EXISTS …` so the existing migration approach is preserved (Neon Postgres + `gen_random_uuid()`).
- `seed_gamification(db)` runs after `seed_categories(db)` on every startup. Inserts only rows whose `code` is missing — safe to deploy repeatedly.
- 20 default achievements (`first_lesson` … `level_25`) and 10 default badges (`rookie` … `immortal`) ship out of the box.

---

## 5. Frontend Implementation

### 5.1 API client (`api/gamification.ts`)

Typed wrapper over `fetch` with the same `Bearer ${token}` convention as the rest of the project. All response types are exported. Includes the JS port of `calculateLevelFromXP`, `xpRequiredForLevel`, and `levelProgressFromXP` so the UI can render an XP bar from a raw XP number alone.

### 5.2 Context (`context/GamificationContext.tsx`)

`GamificationProvider` is mounted once near the root (in `App.tsx`, inside `AuthProvider`) and provides:

- `profile` — latest `GamificationProfile` (auto-loaded on token change, refreshed via `refresh()`).
- `refresh()` — re-fetches `/profile` and **diffs** against the previous snapshot to auto-fire `level_up` and `streak_milestone` toasts.
- `surface(gain)` — given an `XPGain` from a backend response, queues `xp_gain`, `level_up`, `achievement`, and `badge` toasts.
- `toasts` / `dismissToast` — consumed by `GamificationToasts`.

Existing pages call `refresh()` after any action that may award XP (lesson complete, quiz submit). The provider compares old vs new and pops the right toasts — no backend response shape changes required.

### 5.3 Component library

```
ProfileStats
├─ LevelCard      ┌───────────────────────────────┐
│                 │  ┌──┐ Hero Stats · 1,250 XP   │
│                 │  │ 5│ Yazid Hammadi           │
│                 │  └──┘ ▰▰▰▰▰▰▱▱▱  60%          │
│                 │  Streak 3d  · Ach 4/20 · 1/10 │
│                 └───────────────────────────────┘
└─ StreakWidget   ┌──────────────────────────────────┐
                  │ 🔥  CURRENT STREAK               │
                  │     3 days                       │
                  │     Best: 5 · Active today 🔥    │
                  └──────────────────────────────────┘

BadgeShowcase     ┌──────────────────────────────────┐
                  │ Badge Showcase  · [All|Unlocked] │
                  │ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │
                  │ │✨│ │📜│ │🔥│ │🔒│              │
                  │ │R │ │S │ │D │ │M │              │
                  │ └──┘ └──┘ └──┘ └──┘              │
                  └──────────────────────────────────┘

AchievementsPanel ┌──────────────────────────────────┐
                  │ Achievements · 4 of 20 unlocked  │
                  │ [all][learning][quiz][streak]…   │
                  │ ┌──┐ First Lesson Completed +25  │
                  │ │📖│ Complete your first lesson. │
                  │ └──┘ Unlocked · 2026-05-09       │
                  └──────────────────────────────────┘

Leaderboard       ┌──────────────────────────────────┐
                  │ 🏆 Leaderboard   [XP][Streak][C] │
                  │                  [Day][Wk][All]  │
                  │ 1  Maya     L 8 · 2,400 XP       │
                  │ 2  ▶ You    L 5 · 1,250 XP       │
                  │ 3  Karim    L 4 · 980 XP         │
                  │ … pagination                     │
                  └──────────────────────────────────┘

GamificationToasts (bottom-right, portal-mounted)
                  ┌────────────────────────────────┐
                  │ 🏆 LEVEL UP!  Level 5          │
                  │ ──────────────────────────────  │
                  │ ⭐ ACHIEVEMENT  First Lesson    │
                  │   Complete your first lesson    │
                  │   +25 XP                        │
                  │ ──────────────────────────────  │
                  │ 🛡 LEGENDARY BADGE  Legend     │
                  └────────────────────────────────┘
```

### 5.4 Integration points

- `App.tsx` — wraps routes in `GamificationProvider` and mounts `GamificationToasts` once.
- `pages/StudentDashboard.tsx`:
  - new `Hero Stats` nav item that renders `<GamificationPage />`
  - `<ProfileStats />` added to the top of the Home view.
- `pages/CourseLearningPage.tsx` — calls `refreshGamification()` after `markItemCompleted`.
- `components/QCMModal.tsx` — calls `refreshGamification()` after `submitQCM`.

---

## 6. Complete Flow Diagrams

### 6.1 Student completes a lesson

```
StudentClicks "Mark complete"
        │
        ▼
POST /api/courses/{id}/progress       ◄── frontend
        │
        ▼
mark_progress route
  ├─ check is_item_completed (pre)        ── prevents duplicate XP
  ├─ course_controller.mark_item_completed
  └─ if first time:
       xp_service.award_xp("lesson_complete", source_id=subsection_id)
         ├─ ONE_SHOT_SOURCES dedup check
         ├─ COOLDOWN check
         ├─ DAILY_XP_CAP check
         ├─ insert xp_logs
         ├─ recompute level
         ├─ update streak (ticks if new day)
         └─ achievements_service.check_and_unlock
              ├─ first_lesson → unlock + +25 XP reward
              ├─ five_lessons → may unlock
              └─ level_5 → may unlock
       if progress_pct just hit 100 →
         xp_service.award_xp("course_complete", source_id=course_id)
        │
        ▼
Response: CourseProgressOut
        │
        ▼
Frontend → refreshGamification()
        │
        ▼
GET /api/gamification/profile
  diff vs previous snapshot
  ├─ level changed?  → enqueue level_up toast
  └─ streak hit 3/7/14/30 milestone? → enqueue streak_milestone toast
        │
        ▼
GamificationToasts pops
  ⭐ Level Up (if applicable)
  🔥 Streak milestone (if applicable)
  🏆 Achievement (if applicable, on next refresh — see 6.2 if needed)
```

### 6.2 Student passes a quiz

```
QCMModal.finish()
        │
        ▼
POST /api/ai/qcm/submit
        │
        ▼
submit_qcm controller
  ├─ persist QCMAttempt
  └─ if passed AND no prior pass for this scope:
       xp_service.award_xp("quiz_pass", source_id=f"{course}:{section}")
       if 100 %: xp_service.award_xp("quiz_perfect_bonus", amount=25)
        │
        ▼
QCMSubmitOut
        │
        ▼
Frontend → refreshGamification()
        │
        ▼
Toasts: +50 XP, possibly Level Up, possibly Quiz Master / Perfect Score
```

### 6.3 Daily login

```
POST /api/auth/login (existing flow)
        │
        ▼
auth_controller.login_user
  └─ try: xp_service.award_xp(
            "daily_login",
            source_id=f"login-{user_id}-{YYYY-MM-DD}",
          )      ── one-shot per UTC day; cooldown 12 h
        │
        ▼ (silently swallowed on error)
Frontend boots → AuthContext loads user → GamificationProvider auto-loads profile
```

### 6.4 Equipping a badge

```
BadgeShowcase clicks unlocked Badge
        │
        ▼
POST /api/gamification/badges/equip { badge_id }
        │
        ▼
badges_service.equip_badge
  ├─ verify user owns the badge
  └─ user_gamification.equipped_badge_id = badge_id
        │
        ▼
List<Badge> with .equipped flag → BadgeShowcase re-renders
LevelCard (next refresh) shows the badge icon overlay on the avatar
Leaderboard rows show the badge icon next to the name
```

---

## 7. API Reference

All endpoints require `Authorization: Bearer <jwt>` unless noted.

### `GET /api/gamification/profile`
Current user's gamification summary.

Response — `GamificationProfile`:
```json
{
  "user_id": "uuid",
  "full_name": "Yazid Hammadi",
  "profile_image": null,
  "total_xp": 1250,
  "level": 5,
  "level_progress_pct": 38.4,
  "xp_into_level": 192,
  "xp_to_next_level": 308,
  "level_span": 500,
  "streak": {
    "current_streak": 3,
    "longest_streak": 5,
    "last_activity_date": "2026-05-10",
    "is_active_today": true
  },
  "equipped_badge": null,
  "achievements_unlocked": 4,
  "achievements_total": 20,
  "badges_unlocked": 1,
  "badges_total": 10
}
```

### `GET /api/gamification/profile/{user_id}`
Same shape, for a public profile view.

### `GET /api/gamification/xp/logs?limit=50`
Returns up to 200 most-recent `XPLogOut` rows, newest first.

### `POST /api/gamification/daily-login`
Idempotent per UTC day. Returns `XPGainOut` (awarded_xp = 0 if already claimed today).

### `GET /api/gamification/achievements`
Full catalog with `unlocked` + `unlocked_at` filled in for the current user.

### `POST /api/gamification/achievements/seen`
Marks all unseen unlocked achievements as seen.

| Field | Type | Notes |
| --- | --- | --- |
| (none) | — | Body is empty |

Response: `{ "marked": 3 }`

### `GET /api/gamification/badges`
Full catalog (sorted common → legendary) with `.unlocked` + `.equipped`.

### `GET /api/gamification/badges/{user_id}`
Same shape for any user.

### `POST /api/gamification/badges/equip`
| Field | Type | Notes |
| --- | --- | --- |
| `badge_id` | string \| null | `null` to unequip |

Errors:
- `400 You don't own this badge` — caller has no `user_badges` row for that badge.

Response: full Badge[] (so the UI can sync the equipped flag everywhere).

### `GET /api/gamification/leaderboard`
| Query | Allowed | Default |
| --- | --- | --- |
| `metric` | `xp` \| `streak` \| `courses` | `xp` |
| `period` | `daily` \| `weekly` \| `all_time` | `all_time` |
| `page` | ≥ 1 | 1 |
| `page_size` | 1..100 | 20 |

Response — `LeaderboardOut`:
```json
{
  "metric": "xp",
  "period": "weekly",
  "page": 1,
  "page_size": 10,
  "total": 42,
  "entries": [ /* LeaderboardEntry */ ],
  "me": { /* current user's row even if outside the page */ }
}
```

---

## 8. Files Created / Modified

| File | Action | Purpose |
| --- | --- | --- |
| `backend/app/models/gamification.py` | created | All gamification SQLModel tables |
| `backend/app/schemas/gamification.py` | created | Pydantic IO models |
| `backend/app/utils/leveling.py` | created | Level math (used by backend + mirrored in frontend) |
| `backend/app/controller/gamification/__init__.py` | created | Package marker |
| `backend/app/controller/gamification/xp_service.py` | created | `award_xp` + anti-cheat |
| `backend/app/controller/gamification/achievements_service.py` | created | Achievement predicates + unlock + listing |
| `backend/app/controller/gamification/badges_service.py` | created | Badge unlock + equip |
| `backend/app/controller/gamification/leaderboard_service.py` | created | Leaderboard SQL + pagination |
| `backend/app/controller/gamification/profile_service.py` | created | `/profile` aggregation |
| `backend/app/controller/gamification/seed.py` | created | Default catalog seeding |
| `backend/app/routes/gamification_routes.py` | created | `/api/gamification/*` |
| `backend/app/main.py` | modified | Imports + migrations + seed call + router |
| `backend/app/controller/auth_controller.py` | modified | Daily-login XP grant on `login_user` |
| `backend/app/controller/course_controller.py` | modified | Added `is_item_completed` helper |
| `backend/app/controller/qcm_controller.py` | modified | XP grant on first passing attempt |
| `backend/app/routes/course_routes.py` | modified | XP grant on lesson + course completion |
| `frontend/src/api/gamification.ts` | created | Typed client + level math |
| `frontend/src/context/GamificationContext.tsx` | created | Profile + toast queue + diff-based auto-popups |
| `frontend/src/components/gamification/icons.tsx` | created | Icon resolver + rarity styles |
| `frontend/src/components/gamification/XPBar.tsx` | created | Animated XP bar |
| `frontend/src/components/gamification/LevelCard.tsx` | created | Hero card |
| `frontend/src/components/gamification/StreakWidget.tsx` | created | Animated fire streak |
| `frontend/src/components/gamification/BadgeShowcase.tsx` | created | Grid + click-to-equip |
| `frontend/src/components/gamification/AchievementsPanel.tsx` | created | Filterable achievement list |
| `frontend/src/components/gamification/Leaderboard.tsx` | created | Metric × period × pagination |
| `frontend/src/components/gamification/ProfileStats.tsx` | created | LevelCard + StreakWidget combo |
| `frontend/src/components/gamification/GamificationPage.tsx` | created | Full "Hero Stats" tab |
| `frontend/src/components/gamification/GamificationToasts.tsx` | created | Portal-mounted popup notifications |
| `frontend/src/App.tsx` | modified | Wraps routes in `GamificationProvider`; mounts toasts |
| `frontend/src/pages/StudentDashboard.tsx` | modified | New nav tab + ProfileStats on home |
| `frontend/src/pages/CourseLearningPage.tsx` | modified | `refreshGamification()` after mark complete |
| `frontend/src/components/QCMModal.tsx` | modified | `refreshGamification()` after quiz submit |

---

## 9. Business Rules & Validation

| Rule | Where enforced |
| --- | --- |
| Same lesson never gives XP twice | `xp_service.ONE_SHOT_SOURCES` + `xp_logs(user_id, source_type, source_id)` lookup; also pre-check via `course_controller.is_item_completed` |
| Same course gives `course_complete` XP only on the 100 % crossover | `course_routes.mark_progress` compares `pre_progress.progress_pct < 100` to `result.progress_pct >= 100` |
| Same quiz gives XP only on the **first** passing attempt | `qcm_controller.submit_qcm` checks for an earlier passing attempt with `(student_id, course_id, section_id, passed=True)` |
| Daily login grant fires once per UTC day | `source_id = f"login-{user_id}-{YYYY-MM-DD}"` + 12 h cooldown |
| At most 5 000 XP per UTC day per user | `DAILY_XP_CAP` in `xp_service.award_xp` |
| Cooldowns | `COOLDOWN_SECONDS` in `xp_service.award_xp` (lesson 30 s, quiz 30 s, video 5 min, login 12 h, assignment 60 s) |
| Streaks: missing more than 1 day resets to 1 on next activity | `_update_streak` in `xp_service.award_xp`; also lazy-resets to 0 on `profile_service.get_profile` for instant UI feedback |
| Streak ticks once per UTC day | `last_activity_date == today` early return |
| Level capped at 100 | `calculate_level_from_xp` loop bound |
| Equipping a badge requires owning it | `badges_service.equip_badge` → 400 if no `user_badges` row |
| Achievement predicate failure must not block other unlocks | `try/except` around each predicate in `check_and_unlock` |
| Gamification failure must never break auth or learning | All hooks wrapped in `try/except` |
| Leaderboard cannot expose locked badges | `_resolve_equipped_badges` only joins `user_gamification.equipped_badge_id`; users can only equip badges they own |

---

*Document generated for PFE project Hub4Learners — March 2026*

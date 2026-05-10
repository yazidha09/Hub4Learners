"""
Reusable XP service. Every place that grants XP should go through `award_xp`
so the audit log, level recompute, streak update, and achievement/badge
checks happen atomically and consistently.

Design choices:
  - Caller passes a `source_type` and (when possible) a `source_id`.
    Same source_type+source_id → no second award (duplicate XP protection).
  - Per-source-type cooldowns prevent spam.
  - All grants logged in xp_logs for auditability and abuse forensics.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone, date
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.gamification import (
    Achievement, Badge, UserAchievement, UserBadge,
    UserGamification, XPLog,
)
from app.schemas.gamification import (
    AchievementOut, BadgeOut, XPGainOut,
)
from app.utils.leveling import calculate_level_from_xp, level_progress


# ── XP rewards per source ────────────────────────────────────────────────────
# Caller can override the amount, but these are the defaults the platform uses.
XP_REWARDS = {
    # ── Learner sources ──────────────────────────────────────────────
    "lesson_complete":     25,
    "quiz_pass":           50,
    "quiz_perfect_bonus":  25,   # extra on top of quiz_pass when score == 100%
    "daily_login":         10,
    "course_complete":    250,
    "video_watched":       15,
    "assignment_submit":   40,
    "achievement_reward":   0,   # stamped into description, amount supplied
    # ── Professor sources ────────────────────────────────────────────
    "course_published":         150,  # publishing one of their own courses
    "student_enrolled":          15,  # someone enrolled in their course
    "student_completed_course": 100,  # someone finished their course
    "course_rated":              25,  # received a feedback rating
    "course_rated_5":            40,  # bonus on top when rating == 5
}

# Per-source cooldowns. A second grant of the same source within this window
# (regardless of source_id) is rejected. Stops automation/replay attempts.
COOLDOWN_SECONDS = {
    "daily_login":     60 * 60 * 12,   # 12h between login XP
    "video_watched":   60 * 5,         # 5 min minimum between video XP grants
    "lesson_complete": 30,             # gentle anti-spam
    "quiz_pass":       30,
    "assignment_submit": 60,
}

# Sources where source_id is REQUIRED and (user_id, source_type, source_id)
# is one-shot — grants only once per artifact.
ONE_SHOT_SOURCES = {
    "lesson_complete", "quiz_pass", "course_complete",
    "video_watched", "assignment_submit",
    # Professor sources
    "course_published",          # source_id = course_id (one publish bonus per course)
    "student_enrolled",          # source_id = f"{course_id}:{student_id}"
    "student_completed_course",  # source_id = f"{course_id}:{student_id}"
    "course_rated",              # source_id = f"{course_id}:{rater_id}" (one rating per student)
    "course_rated_5",            # source_id = f"{course_id}:{rater_id}"
}

# Hard daily XP cap — defense in depth against runaway scripts
DAILY_XP_CAP = 5_000


def _get_or_create_state(user_id: UUID, db: Session) -> UserGamification:
    state = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
    if state is None:
        state = UserGamification(user_id=user_id, total_xp=0, level=1)
        db.add(state)
        db.flush()  # assign defaults without committing yet
    return state


def _today_utc() -> date:
    return datetime.now(timezone.utc).date()


def _xp_gained_today(user_id: UUID, db: Session) -> int:
    start = datetime.combine(_today_utc(), datetime.min.time(), tzinfo=timezone.utc)
    rows = (
        db.query(XPLog.amount)
        .filter(XPLog.user_id == user_id, XPLog.created_at >= start.replace(tzinfo=None))
        .all()
    )
    return sum(r[0] for r in rows)


def _has_existing_award(
    user_id: UUID, source_type: str, source_id: Optional[str], db: Session
) -> bool:
    if not source_id:
        return False
    return (
        db.query(XPLog.id)
        .filter(
            XPLog.user_id == user_id,
            XPLog.source_type == source_type,
            XPLog.source_id == source_id,
        )
        .first()
        is not None
    )


def _is_in_cooldown(user_id: UUID, source_type: str, db: Session) -> bool:
    secs = COOLDOWN_SECONDS.get(source_type)
    if not secs:
        return False
    cutoff = datetime.utcnow() - timedelta(seconds=secs)
    return (
        db.query(XPLog.id)
        .filter(
            XPLog.user_id == user_id,
            XPLog.source_type == source_type,
            XPLog.created_at >= cutoff,
        )
        .first()
        is not None
    )


def _update_streak(state: UserGamification) -> None:
    today = _today_utc()
    last = state.last_activity_date
    if last == today:
        return  # already counted today
    if last is None or (today - last).days > 1:
        state.current_streak = 1
    else:  # exactly 1 day gap
        state.current_streak += 1
    state.last_activity_date = today
    if state.current_streak > state.longest_streak:
        state.longest_streak = state.current_streak


def _build_gain(
    state: UserGamification,
    awarded: int,
    previous_level: int,
    new_achievements: List[AchievementOut],
    new_badges: List[BadgeOut],
) -> XPGainOut:
    prog = level_progress(state.total_xp)
    return XPGainOut(
        awarded_xp=awarded,
        total_xp=state.total_xp,
        level=state.level,
        previous_level=previous_level,
        leveled_up=state.level > previous_level,
        level_progress_pct=prog["progress_pct"],
        xp_to_next_level=prog["xp_to_next_level"],
        xp_into_level=prog["xp_into_level"],
        level_span=prog["level_span"],
        new_achievements=new_achievements,
        new_badges=new_badges,
    )


def award_xp(
    user_id: str,
    source_type: str,
    db: Session,
    *,
    source_id: Optional[str] = None,
    amount: Optional[int] = None,
    description: Optional[str] = None,
    update_streak: bool = True,
    run_unlock_checks: bool = True,
) -> XPGainOut:
    """
    Grant XP to a user. Returns the resulting state plus any new achievements
    or badges so the caller can surface popups in one round-trip.

    Anti-cheat layers:
      1. Reject if (source_type, source_id) was already awarded for this user
         when the source is in ONE_SHOT_SOURCES.
      2. Reject if cooldown for this source has not elapsed.
      3. Reject if today's XP would exceed DAILY_XP_CAP.
      4. All grants persist to xp_logs.
    """
    uid = UUID(user_id) if isinstance(user_id, str) else user_id
    state = _get_or_create_state(uid, db)
    previous_level = state.level
    grant_amount = amount if amount is not None else XP_REWARDS.get(source_type, 0)

    # Defensive: never write a negative grant via this path
    if grant_amount < 0:
        grant_amount = 0

    blocked = False
    if grant_amount > 0:
        if source_type in ONE_SHOT_SOURCES:
            if not source_id:
                # one-shot sources MUST carry an id; refuse silently rather than
                # raising so callers don't have to guard every grant
                blocked = True
            elif _has_existing_award(uid, source_type, source_id, db):
                blocked = True
        if not blocked and _is_in_cooldown(uid, source_type, db):
            blocked = True
        if not blocked and _xp_gained_today(uid, db) + grant_amount > DAILY_XP_CAP:
            grant_amount = max(0, DAILY_XP_CAP - _xp_gained_today(uid, db))
            if grant_amount == 0:
                blocked = True

    awarded = 0 if blocked else grant_amount

    # Streak still ticks if user did a valid activity even when XP itself was
    # rate-limited — losing a streak because of cooldowns would feel unfair.
    if update_streak and source_type in {
        "lesson_complete", "quiz_pass", "video_watched",
        "assignment_submit", "course_complete",
    }:
        _update_streak(state)

    if awarded > 0:
        log = XPLog(
            user_id=uid,
            amount=awarded,
            source_type=source_type,
            source_id=source_id,
            description=description,
        )
        db.add(log)
        state.total_xp += awarded
        state.level = calculate_level_from_xp(state.total_xp)

    db.flush()

    new_ach: List[AchievementOut] = []
    new_badges: List[BadgeOut] = []
    if run_unlock_checks:
        # Imported here to avoid a circular import at module load time.
        from app.controller.gamification import achievements_service, badges_service
        new_ach = achievements_service.check_and_unlock(uid, db)
        new_badges = badges_service.check_and_unlock(uid, db)

    db.commit()
    db.refresh(state)
    return _build_gain(state, awarded, previous_level, new_ach, new_badges)


def get_xp_logs(user_id: str, db: Session, limit: int = 50) -> List[XPLog]:
    return (
        db.query(XPLog)
        .filter(XPLog.user_id == UUID(user_id))
        .order_by(XPLog.created_at.desc())
        .limit(limit)
        .all()
    )

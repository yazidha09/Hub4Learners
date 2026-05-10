"""
Read-only aggregation for the user's gamification profile (XP bar + streak +
counts shown on the dashboard / profile page).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.gamification import (
    Achievement, Badge, UserAchievement, UserBadge, UserGamification,
)
from app.models.user import User
from app.schemas.gamification import (
    BadgeOut, GamificationProfile, StreakOut,
)
from app.utils.leveling import level_progress


def _ensure_state(user_id: UUID, db: Session) -> UserGamification:
    state = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
    if state is None:
        state = UserGamification(user_id=user_id, total_xp=0, level=1)
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def get_profile(user_id: str, db: Session) -> GamificationProfile:
    uid = UUID(user_id)
    state = _ensure_state(uid, db)
    user = db.query(User).filter(User.id == uid).first()

    today = datetime.now(timezone.utc).date()
    is_active_today = state.last_activity_date == today

    # If user missed yesterday, the streak is conceptually broken even though
    # the stored value updates only on next activity. Reset on read for display
    # consistency. Persist only if it actually changed.
    if state.last_activity_date is not None:
        gap = (today - state.last_activity_date).days
        if gap > 1 and state.current_streak != 0:
            state.current_streak = 0
            db.commit()

    prog = level_progress(state.total_xp)

    equipped: BadgeOut | None = None
    if state.equipped_badge_id:
        b = db.query(Badge).filter(Badge.id == state.equipped_badge_id).first()
        if b:
            equipped = BadgeOut(
                id=b.id, code=b.code, title=b.title, description=b.description,
                icon=b.icon, rarity=b.rarity, unlocked=True, equipped=True,
            )

    ach_total = db.query(func.count(Achievement.id)).scalar() or 0
    ach_unlocked = (
        db.query(func.count(UserAchievement.id))
        .filter(UserAchievement.user_id == uid)
        .scalar()
    ) or 0
    badge_total = db.query(func.count(Badge.id)).scalar() or 0
    badge_unlocked = (
        db.query(func.count(UserBadge.id))
        .filter(UserBadge.user_id == uid)
        .scalar()
    ) or 0

    return GamificationProfile(
        user_id=uid,
        full_name=user.full_name if user else None,
        profile_image=user.profile_image if user else None,
        total_xp=state.total_xp,
        level=state.level,
        level_progress_pct=prog["progress_pct"],
        xp_into_level=prog["xp_into_level"],
        xp_to_next_level=prog["xp_to_next_level"],
        level_span=prog["level_span"],
        streak=StreakOut(
            current_streak=state.current_streak,
            longest_streak=state.longest_streak,
            last_activity_date=state.last_activity_date,
            is_active_today=is_active_today,
        ),
        equipped_badge=equipped,
        achievements_unlocked=ach_unlocked,
        achievements_total=ach_total,
        badges_unlocked=badge_unlocked,
        badges_total=badge_total,
    )

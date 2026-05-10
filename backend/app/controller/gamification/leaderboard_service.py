"""
Leaderboards. Three metrics × three periods:

  metric: xp | streak | courses
  period: daily | weekly | all_time

For metric=xp the period bound is applied to xp_logs (sum). For streak and
courses the value is read from current state (period only filters scoring of
xp delta where it makes sense — and is informational for streak/courses).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.enrollment import Enrollment
from app.models.gamification import (
    Badge, UserBadge, UserGamification, XPLog,
)
from app.models.user import User
from app.schemas.gamification import (
    BadgeOut, LeaderboardEntry, LeaderboardOut,
)


VALID_METRICS = {"xp", "streak", "courses"}
VALID_PERIODS = {"daily", "weekly", "all_time"}


def _period_start(period: str) -> Optional[datetime]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if period == "daily":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "weekly":
        # Monday-of-this-week 00:00 UTC
        monday = now - timedelta(days=now.weekday())
        return monday.replace(hour=0, minute=0, second=0, microsecond=0)
    return None  # all_time


def _resolve_equipped_badges(
    user_ids: List[UUID], db: Session
) -> dict[UUID, BadgeOut]:
    """One query for all equipped badges in the page."""
    if not user_ids:
        return {}
    rows = (
        db.query(UserGamification.user_id, Badge)
        .join(Badge, Badge.id == UserGamification.equipped_badge_id)
        .filter(UserGamification.user_id.in_(user_ids))
        .all()
    )
    out: dict[UUID, BadgeOut] = {}
    for uid, b in rows:
        out[uid] = BadgeOut(
            id=b.id, code=b.code, title=b.title, description=b.description,
            icon=b.icon, rarity=b.rarity, unlocked=True, equipped=True,
        )
    return out


def _build_entries(
    rows: List[Tuple], me_uid: Optional[UUID], db: Session, page: int, page_size: int,
) -> Tuple[List[LeaderboardEntry], Optional[LeaderboardEntry]]:
    """rows = list of tuples (user_id, full_name, profile_image, level, total_xp,
    period_xp, current_streak, completed_courses)."""
    # Page slice
    start = (page - 1) * page_size
    page_rows = rows[start:start + page_size]
    user_ids = [r[0] for r in page_rows]
    badges = _resolve_equipped_badges(user_ids, db)

    entries: List[LeaderboardEntry] = []
    for i, r in enumerate(page_rows, start=start + 1):
        uid, name, img, lvl, xp, period_xp, streak, courses = r
        entries.append(LeaderboardEntry(
            rank=i,
            user_id=uid,
            full_name=name or "Anonymous",
            profile_image=img,
            level=lvl or 1,
            total_xp=xp or 0,
            period_xp=period_xp or 0,
            current_streak=streak or 0,
            completed_courses=courses or 0,
            equipped_badge=badges.get(uid),
        ))

    me_entry: Optional[LeaderboardEntry] = None
    if me_uid is not None:
        for i, r in enumerate(rows, start=1):
            if r[0] == me_uid:
                badges_me = _resolve_equipped_badges([me_uid], db)
                me_entry = LeaderboardEntry(
                    rank=i,
                    user_id=r[0],
                    full_name=r[1] or "You",
                    profile_image=r[2],
                    level=r[3] or 1,
                    total_xp=r[4] or 0,
                    period_xp=r[5] or 0,
                    current_streak=r[6] or 0,
                    completed_courses=r[7] or 0,
                    equipped_badge=badges_me.get(me_uid),
                )
                break
    return entries, me_entry


def get_leaderboard(
    metric: str,
    period: str,
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    me_user_id: Optional[str] = None,
) -> LeaderboardOut:
    metric = metric if metric in VALID_METRICS else "xp"
    period = period if period in VALID_PERIODS else "all_time"
    page = max(1, page)
    page_size = max(1, min(100, page_size))

    period_start = _period_start(period)

    # Per-user period XP (only relevant for metric=xp ranking, but include in output)
    if period_start is not None:
        period_xp_sub = (
            db.query(
                XPLog.user_id.label("uid"),
                func.coalesce(func.sum(XPLog.amount), 0).label("period_xp"),
            )
            .filter(XPLog.created_at >= period_start)
            .group_by(XPLog.user_id)
            .subquery()
        )
    else:
        period_xp_sub = None

    completed_sub = (
        db.query(
            Enrollment.student_id.label("uid"),
            func.count(Enrollment.id).label("completed"),
        )
        .filter(Enrollment.status == "completed")
        .group_by(Enrollment.student_id)
        .subquery()
    )

    q = (
        db.query(
            User.id,
            User.full_name,
            User.profile_image,
            UserGamification.level,
            UserGamification.total_xp,
            (period_xp_sub.c.period_xp if period_xp_sub is not None else UserGamification.total_xp).label("period_xp"),
            UserGamification.current_streak,
            func.coalesce(completed_sub.c.completed, 0).label("completed_courses"),
        )
        .join(UserGamification, UserGamification.user_id == User.id)
        .outerjoin(completed_sub, completed_sub.c.uid == User.id)
    )
    if period_xp_sub is not None:
        q = q.outerjoin(period_xp_sub, period_xp_sub.c.uid == User.id)

    # Sort
    if metric == "xp":
        if period_xp_sub is not None:
            q = q.order_by(desc(func.coalesce(period_xp_sub.c.period_xp, 0)),
                           desc(UserGamification.total_xp))
        else:
            q = q.order_by(desc(UserGamification.total_xp))
    elif metric == "streak":
        q = q.order_by(desc(UserGamification.current_streak),
                       desc(UserGamification.total_xp))
    else:  # courses
        q = q.order_by(desc(func.coalesce(completed_sub.c.completed, 0)),
                       desc(UserGamification.total_xp))

    rows = q.all()
    me_uid = UUID(me_user_id) if me_user_id else None
    entries, me_entry = _build_entries(rows, me_uid, db, page, page_size)

    return LeaderboardOut(
        metric=metric,
        period=period,
        page=page,
        page_size=page_size,
        total=len(rows),
        entries=entries,
        me=me_entry,
    )

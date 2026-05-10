"""
Badge unlocking + equipping. Mirrors achievements but rarer and shown on the
profile. Badges are tied to milestones — registration, level breakpoints, etc.
"""
from __future__ import annotations

from typing import Callable, Dict, List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.course_feedback import CourseFeedback
from app.models.courses import Course
from app.models.enrollment import Enrollment
from app.models.gamification import (
    Badge, UserBadge, UserGamification,
)
from app.schemas.gamification import BadgeOut


def _xp_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        s = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        return bool(s and s.total_xp >= threshold)
    return check


def _level_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        s = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        return bool(s and s.level >= threshold)
    return check


def _streak_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        s = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
        return bool(s and s.current_streak >= threshold)
    return check


def _courses_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Enrollment.id))
            .filter(Enrollment.student_id == user_id, Enrollment.status == "completed")
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _always(_uid: UUID, _db: Session) -> bool:
    return True


# ── Professor-side helpers ──────────────────────────────────────────────
def _published_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Course.id))
            .filter(Course.professor_id == user_id, Course.is_published.is_(True))
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _total_enrollments_for_owner_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Enrollment.id))
            .join(Course, Course.id == Enrollment.course_id)
            .filter(Course.professor_id == user_id)
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _student_completions_for_owner_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Enrollment.id))
            .join(Course, Course.id == Enrollment.course_id)
            .filter(
                Course.professor_id == user_id,
                Enrollment.status == "completed",
            )
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _avg_rating_at_least(min_avg: float, min_count: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        row = (
            db.query(
                func.coalesce(func.avg(CourseFeedback.rating), 0.0),
                func.count(CourseFeedback.id),
            )
            .join(Course, Course.id == CourseFeedback.course_id)
            .filter(Course.professor_id == user_id)
            .first()
        )
        if not row:
            return False
        avg, cnt = row
        return (cnt or 0) >= min_count and float(avg or 0) >= min_avg
    return check


CRITERIA: Dict[str, Callable[[UUID, Session], bool]] = {
    "rookie":        _always,
    "scholar":       _level_at_least(5),
    "champion":      _level_at_least(10),
    "master":        _level_at_least(25),
    "immortal":      _level_at_least(50),
    "knowledge":     _xp_at_least(5_000),
    "legend":        _xp_at_least(10_000),
    "dedicated":     _streak_at_least(7),
    "relentless":    _streak_at_least(30),
    "course_master": _courses_at_least(5),
    # Professor-only
    "educator":          _published_at_least(5),
    "crowd_favorite":    _total_enrollments_for_owner_at_least(100),
    "rising_star":       _student_completions_for_owner_at_least(10),
    "celebrity":         _total_enrollments_for_owner_at_least(500),
    "acclaimed":         _avg_rating_at_least(4.5, 10),
    "life_changer":      _student_completions_for_owner_at_least(100),
    "hall_of_fame":      _total_enrollments_for_owner_at_least(1000),
    "legendary_mentor":  _student_completions_for_owner_at_least(500),
}


def check_and_unlock(user_id: UUID, db: Session) -> List[BadgeOut]:
    already = {
        ub.badge_id for ub in
        db.query(UserBadge.badge_id).filter(UserBadge.user_id == user_id).all()
    }

    catalog = {b.code: b for b in db.query(Badge).all()}
    unlocked: List[BadgeOut] = []
    for code, predicate in CRITERIA.items():
        b = catalog.get(code)
        if not b or b.id in already:
            continue
        try:
            if predicate(user_id, db):
                ub = UserBadge(user_id=user_id, badge_id=b.id)
                db.add(ub)
                db.flush()
                unlocked.append(BadgeOut(
                    id=b.id,
                    code=b.code,
                    title=b.title,
                    description=b.description,
                    icon=b.icon,
                    rarity=b.rarity,
                    unlocked=True,
                    unlocked_at=ub.unlocked_at,
                    equipped=False,
                ))
        except Exception:
            continue
    return unlocked


def list_for_user(user_id: UUID, db: Session) -> List[BadgeOut]:
    state = db.query(UserGamification).filter(UserGamification.user_id == user_id).first()
    equipped_id = state.equipped_badge_id if state else None
    unlocked_map = {
        ub.badge_id: ub
        for ub in db.query(UserBadge).filter(UserBadge.user_id == user_id).all()
    }
    out: List[BadgeOut] = []
    rarity_order = {"common": 0, "rare": 1, "epic": 2, "legendary": 3}
    for b in sorted(
        db.query(Badge).all(),
        key=lambda x: (rarity_order.get(x.rarity, 99), x.title),
    ):
        ub = unlocked_map.get(b.id)
        out.append(BadgeOut(
            id=b.id,
            code=b.code,
            title=b.title,
            description=b.description,
            icon=b.icon,
            rarity=b.rarity,
            unlocked=bool(ub),
            unlocked_at=ub.unlocked_at if ub else None,
            equipped=(equipped_id == b.id),
        ))
    return out


def equip_badge(user_id: str, badge_id: str | None, db: Session) -> List[BadgeOut]:
    uid = UUID(user_id)
    state = db.query(UserGamification).filter(UserGamification.user_id == uid).first()
    if state is None:
        state = UserGamification(user_id=uid)
        db.add(state)
        db.flush()

    if badge_id is None:
        state.equipped_badge_id = None
    else:
        bid = UUID(badge_id)
        owned = (
            db.query(UserBadge.id)
            .filter(UserBadge.user_id == uid, UserBadge.badge_id == bid)
            .first()
        )
        if not owned:
            raise HTTPException(status_code=400, detail="You don't own this badge")
        state.equipped_badge_id = bid

    db.commit()
    return list_for_user(uid, db)

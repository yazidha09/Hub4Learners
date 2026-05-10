"""
Achievement detection. `check_and_unlock` is called from the XP service after
every grant. It looks at the user's current state and unlocks any achievement
whose criteria are met.
"""
from __future__ import annotations

from datetime import datetime
from typing import Callable, Dict, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.course_feedback import CourseFeedback
from app.models.courses import Course
from app.models.enrollment import Enrollment
from app.models.gamification import (
    Achievement, UserAchievement, UserGamification, XPLog,
)
from app.models.qcm_attempt import QCMAttempt
from app.schemas.gamification import AchievementOut


# code → predicate(user_id, db) -> bool. Easy to extend with new rules.
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


def _xp_source_count(source_type: str, threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(XPLog.id))
            .filter(XPLog.user_id == user_id, XPLog.source_type == source_type)
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _completed_courses_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Enrollment.id))
            .filter(Enrollment.student_id == user_id, Enrollment.status == "completed")
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _perfect_quiz(user_id: UUID, db: Session) -> bool:
    return (
        db.query(QCMAttempt.id)
        .filter(QCMAttempt.student_id == user_id, QCMAttempt.score == QCMAttempt.total)
        .first()
        is not None
    )


def _has_completed_topic(keyword: str) -> Callable[[UUID, Session], bool]:
    keyword_lc = keyword.lower()

    def check(user_id: UUID, db: Session) -> bool:
        rows = (
            db.query(Course.title)
            .join(Enrollment, Enrollment.course_id == Course.id)
            .filter(
                Enrollment.student_id == user_id,
                Enrollment.status == "completed",
            )
            .all()
        )
        return any(keyword_lc in (t or "").lower() for (t,) in rows)
    return check


# ── Professor-side helpers ──────────────────────────────────────────────
def _published_courses_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Course.id))
            .filter(Course.professor_id == user_id, Course.is_published.is_(True))
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _total_enrollments_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    """Counts every enrollment across every course the user owns."""
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(Enrollment.id))
            .join(Course, Course.id == Enrollment.course_id)
            .filter(Course.professor_id == user_id)
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _student_completions_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    """Number of (student × course) completions for any course the user owns."""
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


def _ratings_received_at_least(threshold: int) -> Callable[[UUID, Session], bool]:
    def check(user_id: UUID, db: Session) -> bool:
        cnt = (
            db.query(func.count(CourseFeedback.id))
            .join(Course, Course.id == CourseFeedback.course_id)
            .filter(Course.professor_id == user_id)
            .scalar()
        )
        return (cnt or 0) >= threshold
    return check


def _has_perfect_rating(user_id: UUID, db: Session) -> bool:
    return (
        db.query(CourseFeedback.id)
        .join(Course, Course.id == CourseFeedback.course_id)
        .filter(Course.professor_id == user_id, CourseFeedback.rating == 5)
        .first()
        is not None
    )


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


def _hour_window(start_hour: int, end_hour: int) -> Callable[[UUID, Session], bool]:
    """Triggers if it's currently within the [start, end) hour window."""
    def check(_user_id: UUID, _db: Session) -> bool:
        h = datetime.now().hour
        if start_hour <= end_hour:
            return start_hour <= h < end_hour
        return h >= start_hour or h < end_hour  # crosses midnight
    return check


CRITERIA: Dict[str, Callable[[UUID, Session], bool]] = {
    "first_lesson":     _xp_source_count("lesson_complete", 1),
    "five_lessons":     _xp_source_count("lesson_complete", 5),
    "twenty_lessons":   _xp_source_count("lesson_complete", 20),
    "first_quiz":       _xp_source_count("quiz_pass", 1),
    "quiz_master":      _xp_source_count("quiz_pass", 10),
    "perfect_quiz":     _perfect_quiz,
    "streak_3":         _streak_at_least(3),
    "streak_7":         _streak_at_least(7),
    "streak_30":        _streak_at_least(30),
    "xp_1000":          _xp_at_least(1_000),
    "xp_5000":          _xp_at_least(5_000),
    "xp_10000":         _xp_at_least(10_000),
    "level_5":          _level_at_least(5),
    "level_10":         _level_at_least(10),
    "level_25":         _level_at_least(25),
    "first_course":     _completed_courses_at_least(1),
    "course_collector": _completed_courses_at_least(5),
    "python_beginner":  _has_completed_topic("python"),
    "early_bird":       _hour_window(5, 8),
    "night_owl":        _hour_window(22, 24),
    # Professor-only
    "first_course_published":  _published_courses_at_least(1),
    "five_courses_published":  _published_courses_at_least(5),
    "first_student":           _total_enrollments_at_least(1),
    "ten_students":            _total_enrollments_at_least(10),
    "hundred_students":        _total_enrollments_at_least(100),
    "five_hundred_students":   _total_enrollments_at_least(500),
    "thousand_students":       _total_enrollments_at_least(1000),
    "first_completion":        _student_completions_at_least(1),
    "ten_completions":         _student_completions_at_least(10),
    "fifty_completions":       _student_completions_at_least(50),
    "hundred_completions":     _student_completions_at_least(100),
    "first_review":            _ratings_received_at_least(1),
    "highly_rated":            _avg_rating_at_least(4.5, 10),
    "perfect_rating":          _has_perfect_rating,
    "twenty_five_reviews":     _ratings_received_at_least(25),
}


def check_and_unlock(user_id: UUID, db: Session) -> List[AchievementOut]:
    """Return any achievements newly unlocked. Does NOT commit — caller does."""
    already_unlocked = {
        ua.achievement_id for ua in
        db.query(UserAchievement.achievement_id)
        .filter(UserAchievement.user_id == user_id)
        .all()
    }

    catalog = {a.code: a for a in db.query(Achievement).all()}
    unlocked: List[AchievementOut] = []

    for code, predicate in CRITERIA.items():
        ach = catalog.get(code)
        if not ach or ach.id in already_unlocked:
            continue
        try:
            if predicate(user_id, db):
                ua = UserAchievement(user_id=user_id, achievement_id=ach.id)
                db.add(ua)
                db.flush()
                unlocked.append(AchievementOut(
                    id=ach.id,
                    code=ach.code,
                    title=ach.title,
                    description=ach.description,
                    icon=ach.icon,
                    xp_reward=ach.xp_reward,
                    category=ach.category,
                    unlocked=True,
                    unlocked_at=ua.unlocked_at,
                ))
                # Stack reward XP — but skip unlock-checks to avoid recursion.
                if ach.xp_reward > 0:
                    state = db.query(UserGamification).filter(
                        UserGamification.user_id == user_id
                    ).first()
                    if state:
                        state.total_xp += ach.xp_reward
                        from app.utils.leveling import calculate_level_from_xp
                        state.level = calculate_level_from_xp(state.total_xp)
                        db.add(XPLog(
                            user_id=user_id,
                            amount=ach.xp_reward,
                            source_type="achievement_reward",
                            source_id=str(ach.id),
                            description=f"Achievement: {ach.title}",
                        ))
                        db.flush()
        except Exception:
            # A buggy predicate must never block other unlocks.
            continue

    return unlocked


def list_for_user(user_id: UUID, db: Session) -> List[AchievementOut]:
    """All achievements with unlocked status for a given user."""
    unlocked_map = {
        ua.achievement_id: ua
        for ua in db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id)
        .all()
    }
    out: List[AchievementOut] = []
    for ach in db.query(Achievement).order_by(Achievement.category, Achievement.title).all():
        ua = unlocked_map.get(ach.id)
        out.append(AchievementOut(
            id=ach.id,
            code=ach.code,
            title=ach.title,
            description=ach.description,
            icon=ach.icon,
            xp_reward=ach.xp_reward,
            category=ach.category,
            unlocked=bool(ua),
            unlocked_at=ua.unlocked_at if ua else None,
        ))
    return out


def mark_seen(user_id: UUID, db: Session) -> int:
    n = (
        db.query(UserAchievement)
        .filter(UserAchievement.user_id == user_id, UserAchievement.seen == False)  # noqa: E712
        .update({"seen": True})
    )
    db.commit()
    return n

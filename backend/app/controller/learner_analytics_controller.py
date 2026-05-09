from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.courses import Course
from app.models.course_progress import CourseProgress
from app.models.enrollment import Enrollment
from app.models.qcm_attempt import QCMAttempt
from app.models.user import User
from app.controller.course_controller import _batch_progress_pct, _count_course_items
from app.schemas.student_analytics import DifficultyStat
from app.schemas.learner_analytics import (
    LearnerActivityPoint,
    LearnerAnalyticsOut,
    LearnerCourseStats,
    LearnerHighlight,
    LearnerSummary,
)

DIFFICULTIES = ("easy", "medium", "hard")


def _empty_difficulty_map() -> Dict[str, DifficultyStat]:
    return {d: DifficultyStat() for d in DIFFICULTIES}


def _classify_risk(
    avg_progress_pct: float,
    quiz_attempts: int,
    quiz_avg_pct: float,
    last_active_at,
    now: datetime,
) -> str:
    """Bucket a learner into on_track / needs_attention / at_risk."""
    days_since_active = None
    if last_active_at:
        days_since_active = (now - last_active_at).days

    # at risk: barely started AND inactive for 2+ weeks (or never active)
    if avg_progress_pct < 25 and (days_since_active is None or days_since_active >= 14):
        return "at_risk"

    # needs attention: failing quizzes OR inactive for a week+ but has started
    if quiz_attempts > 0 and quiz_avg_pct < 60:
        return "needs_attention"
    if days_since_active is not None and days_since_active >= 7:
        return "needs_attention"

    return "on_track"


def get_learner_analytics(professor_id: str, db: Session) -> LearnerAnalyticsOut:
    pid = UUID(professor_id)
    now = datetime.utcnow()
    since_30d = now - timedelta(days=30)

    # All courses owned by this professor
    courses = db.query(Course).filter(Course.professor_id == pid).all()
    if not courses:
        empty_trend = [
            LearnerActivityPoint(date=(now - timedelta(days=i)).date().isoformat())
            for i in range(29, -1, -1)
        ]
        return LearnerAnalyticsOut(
            activity_trend=empty_trend,
            difficulty_breakdown=_empty_difficulty_map(),
        )

    course_ids = [c.id for c in courses]
    courses_by_id = {c.id: c for c in courses}

    # All enrollments across the professor's courses
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.course_id.in_(course_ids))
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )
    if not enrollments:
        empty_trend = [
            LearnerActivityPoint(date=(now - timedelta(days=i)).date().isoformat())
            for i in range(29, -1, -1)
        ]
        return LearnerAnalyticsOut(
            activity_trend=empty_trend,
            difficulty_breakdown=_empty_difficulty_map(),
        )

    student_ids = list({e.student_id for e in enrollments})
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()}

    # Group enrollments by student
    enrollments_by_student: Dict[UUID, List[Enrollment]] = defaultdict(list)
    for e in enrollments:
        enrollments_by_student[e.student_id].append(e)

    # All progress rows for these students within the professor's courses
    progress_rows = (
        db.query(CourseProgress)
        .filter(
            CourseProgress.student_id.in_(student_ids),
            CourseProgress.course_id.in_(course_ids),
        )
        .all()
    )
    progress_by_student_course: Dict[tuple, int] = defaultdict(int)
    last_progress_by_student_course: Dict[tuple, datetime] = {}
    for p in progress_rows:
        progress_by_student_course[(p.student_id, p.course_id)] += 1
        existing = last_progress_by_student_course.get((p.student_id, p.course_id))
        if p.completed_at and (existing is None or p.completed_at > existing):
            last_progress_by_student_course[(p.student_id, p.course_id)] = p.completed_at

    # Total items per course (cached once)
    total_items_by_course: Dict[UUID, int] = {}
    for cid in course_ids:
        sub_count, mat_count = _count_course_items(cid, db)
        total_items_by_course[cid] = sub_count + mat_count

    # All quiz attempts in the professor's courses
    attempts = (
        db.query(QCMAttempt)
        .filter(
            QCMAttempt.student_id.in_(student_ids),
            QCMAttempt.course_id.in_(course_ids),
        )
        .order_by(QCMAttempt.completed_at.desc())
        .all()
    )
    attempts_by_student: Dict[UUID, List[QCMAttempt]] = defaultdict(list)
    attempts_by_student_course: Dict[tuple, List[QCMAttempt]] = defaultdict(list)
    for a in attempts:
        attempts_by_student[a.student_id].append(a)
        attempts_by_student_course[(a.student_id, a.course_id)].append(a)

    # Build per-student summaries
    learners: List[LearnerSummary] = []
    overall_lessons_30d = 0
    overall_quizzes_30d = 0
    trend_lessons: Dict[str, int] = defaultdict(int)
    trend_quizzes: Dict[str, int] = defaultdict(int)
    overall_difficulty: Dict[str, List[QCMAttempt]] = defaultdict(list)

    completed_count_total = 0
    in_progress_count_total = 0
    not_started_count_total = 0

    for sid in student_ids:
        user = users.get(sid)
        if not user:
            continue

        student_enrollments = enrollments_by_student.get(sid, [])
        student_attempts = attempts_by_student.get(sid, [])

        # Per-course breakdown
        per_course_stats: List[LearnerCourseStats] = []
        progress_pcts: List[float] = []
        for e in student_enrollments:
            course = courses_by_id.get(e.course_id)
            if not course:
                continue
            total_items = total_items_by_course.get(e.course_id, 0)
            completed_items = progress_by_student_course.get((sid, e.course_id), 0)
            pct = round(completed_items / total_items * 100, 1) if total_items > 0 else 0.0
            if e.status == "completed":
                pct = 100.0

            course_attempts = attempts_by_student_course.get((sid, e.course_id), [])
            qa_count = len(course_attempts)
            if qa_count > 0:
                pcts = [(a.score / a.total * 100) if a.total else 0.0 for a in course_attempts]
                qa_avg = round(sum(pcts) / len(pcts), 1)
                qa_pass = round(sum(1 for a in course_attempts if a.passed) / qa_count * 100, 1)
            else:
                qa_avg = 0.0
                qa_pass = 0.0

            last_progress = last_progress_by_student_course.get((sid, e.course_id))
            last_attempt = max(
                (a.completed_at for a in course_attempts if a.completed_at),
                default=None,
            )
            last_active = max(
                [d for d in [last_progress, last_attempt] if d is not None],
                default=None,
            )

            per_course_stats.append(LearnerCourseStats(
                course_id=str(course.id),
                course_title=course.title,
                enrollment_status=e.status,
                enrolled_at=e.enrolled_at,
                progress_pct=pct,
                completed_items=completed_items,
                total_items=total_items,
                quiz_attempts=qa_count,
                quiz_avg_pct=qa_avg,
                quiz_pass_rate=qa_pass,
                last_active_at=last_active,
            ))
            progress_pcts.append(pct)

            if e.status == "completed":
                completed_count_total += 1
            elif pct == 0:
                not_started_count_total += 1
            else:
                in_progress_count_total += 1

        # Aggregate quiz stats for this student
        if student_attempts:
            pcts = [(a.score / a.total * 100) if a.total else 0.0 for a in student_attempts]
            quiz_avg = round(sum(pcts) / len(pcts), 1)
            quiz_best = round(max(pcts), 1)
            passed_count = sum(1 for a in student_attempts if a.passed)
            quiz_pass = round(passed_count / len(student_attempts) * 100, 1)
        else:
            quiz_avg = 0.0
            quiz_best = 0.0
            passed_count = 0
            quiz_pass = 0.0

        # Last active across all activity for this student
        student_last_active_candidates: List[datetime] = []
        for s in per_course_stats:
            if s.last_active_at:
                student_last_active_candidates.append(s.last_active_at)
        student_last_active = max(student_last_active_candidates, default=None)

        # 30-day active days for this student + contribute to trend
        active_dates_30d: set = set()
        for p in progress_rows:
            if p.student_id != sid:
                continue
            if p.completed_at and p.completed_at >= since_30d:
                d = p.completed_at.date().isoformat()
                trend_lessons[d] += 1
                overall_lessons_30d += 1
                active_dates_30d.add(p.completed_at.date())
        for a in student_attempts:
            if a.completed_at and a.completed_at >= since_30d:
                d = a.completed_at.date().isoformat()
                trend_quizzes[d] += 1
                overall_quizzes_30d += 1
                active_dates_30d.add(a.completed_at.date())

        # Overall difficulty contribution
        for a in student_attempts:
            diff = (a.difficulty or "").lower()
            if diff in DIFFICULTIES:
                overall_difficulty[diff].append(a)

        avg_progress = round(sum(progress_pcts) / len(progress_pcts), 1) if progress_pcts else 0.0
        risk = _classify_risk(avg_progress, len(student_attempts), quiz_avg, student_last_active, now)

        learners.append(LearnerSummary(
            student_id=str(sid),
            full_name=user.full_name,
            email=user.email,
            courses_enrolled=len(per_course_stats),
            courses_completed=sum(1 for c in per_course_stats if c.enrollment_status == "completed"),
            courses_in_progress=sum(
                1 for c in per_course_stats
                if c.enrollment_status != "completed" and c.progress_pct > 0
            ),
            avg_progress_pct=avg_progress,
            quiz_attempts=len(student_attempts),
            quizzes_passed=passed_count,
            quiz_avg_pct=quiz_avg,
            quiz_pass_rate=quiz_pass,
            best_quiz_score_pct=quiz_best,
            last_active_at=student_last_active,
            active_days_30d=len(active_dates_30d),
            risk_level=risk,
            courses=per_course_stats,
        ))

    # Top-level aggregates
    total_learners = len(learners)
    active_learners_30d = sum(1 for l in learners if l.active_days_30d > 0)
    avg_progress_top = round(sum(l.avg_progress_pct for l in learners) / total_learners, 1) if total_learners > 0 else 0.0

    total_quiz_attempts = sum(l.quiz_attempts for l in learners)
    if total_quiz_attempts > 0:
        # Weighted by attempts via re-walking attempts list (more accurate than averaging averages)
        all_pcts = [(a.score / a.total * 100) if a.total else 0.0 for a in attempts]
        all_passed = sum(1 for a in attempts if a.passed)
        overall_avg = round(sum(all_pcts) / len(all_pcts), 1) if all_pcts else 0.0
        overall_pass = round(all_passed / len(attempts) * 100, 1) if attempts else 0.0
    else:
        overall_avg = 0.0
        overall_pass = 0.0

    # Difficulty breakdown across all learners
    difficulty_breakdown: Dict[str, DifficultyStat] = _empty_difficulty_map()
    for diff, rows in overall_difficulty.items():
        if not rows:
            continue
        pcts = [(a.score / a.total * 100) if a.total else 0.0 for a in rows]
        passed = sum(1 for a in rows if a.passed)
        difficulty_breakdown[diff] = DifficultyStat(
            attempts=len(rows),
            avg_score_pct=round(sum(pcts) / len(pcts), 1),
            pass_rate=round(passed / len(rows) * 100, 1),
        )

    # 30-day trend (zero-filled)
    activity_trend: List[LearnerActivityPoint] = []
    for offset in range(29, -1, -1):
        d = (now - timedelta(days=offset)).date().isoformat()
        activity_trend.append(LearnerActivityPoint(
            date=d,
            lessons_completed=trend_lessons.get(d, 0),
            quizzes_taken=trend_quizzes.get(d, 0),
        ))

    # Top performers: students with quizzes, sorted desc by avg
    learners_with_quizzes = [l for l in learners if l.quiz_attempts > 0]
    top_sorted = sorted(
        learners_with_quizzes,
        key=lambda l: (l.quiz_avg_pct, l.quiz_attempts),
        reverse=True,
    )[:5]
    top_performers = [
        LearnerHighlight(
            student_id=l.student_id,
            full_name=l.full_name,
            avg_quiz_pct=l.quiz_avg_pct,
            avg_progress_pct=l.avg_progress_pct,
            quiz_attempts=l.quiz_attempts,
        )
        for l in top_sorted
    ]

    # Needs attention: at_risk + needs_attention, sorted by avg_progress asc
    at_risk_learners = [l for l in learners if l.risk_level == "at_risk"]
    needs_attention_learners = [l for l in learners if l.risk_level == "needs_attention"]
    flagged = sorted(
        at_risk_learners + needs_attention_learners,
        key=lambda l: (l.avg_progress_pct, l.quiz_avg_pct),
    )[:5]
    needs_attention_list = [
        LearnerHighlight(
            student_id=l.student_id,
            full_name=l.full_name,
            avg_quiz_pct=l.quiz_avg_pct,
            avg_progress_pct=l.avg_progress_pct,
            quiz_attempts=l.quiz_attempts,
        )
        for l in flagged
    ]

    return LearnerAnalyticsOut(
        learners=learners,
        total_learners=total_learners,
        active_learners_30d=active_learners_30d,
        avg_progress_pct=avg_progress_top,
        completed_count=completed_count_total,
        in_progress_count=in_progress_count_total,
        not_started_count=not_started_count_total,
        total_quiz_attempts=total_quiz_attempts,
        overall_quiz_avg_pct=overall_avg,
        overall_quiz_pass_rate=overall_pass,
        difficulty_breakdown=difficulty_breakdown,
        activity_trend=activity_trend,
        lessons_completed_30d=overall_lessons_30d,
        quizzes_taken_30d=overall_quizzes_30d,
        top_performers=top_performers,
        needs_attention=needs_attention_list,
        at_risk_count=len(at_risk_learners),
        needs_attention_count=len(needs_attention_learners),
    )

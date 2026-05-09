from __future__ import annotations
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.courses import Course
from app.models.course_progress import CourseProgress
from app.models.enrollment import Enrollment
from app.models.qcm_attempt import QCMAttempt, PASS_THRESHOLD_PCT
from app.models.user import User
from app.controller.course_controller import _batch_progress_pct, _count_course_items
from app.schemas.student_analytics import (
    CourseHighlight,
    DifficultyStat,
    StudentActivityPoint,
    StudentAnalyticsOut,
    StudentCourseAnalyticsItem,
    StudentQCMSummary,
    StudentRecentAttempt,
)

DIFFICULTIES = ("easy", "medium", "hard")


def _empty_difficulty_map() -> Dict[str, DifficultyStat]:
    return {d: DifficultyStat() for d in DIFFICULTIES}


def _summarize_attempts(attempts: List[QCMAttempt]) -> StudentQCMSummary:
    if not attempts:
        return StudentQCMSummary(by_difficulty=_empty_difficulty_map())

    pcts = [(a.score / a.total * 100) if a.total else 0.0 for a in attempts]
    passed = sum(1 for a in attempts if a.passed)
    avg = round(sum(pcts) / len(pcts), 1)
    best = round(max(pcts), 1)
    pass_rate = round(passed / len(attempts) * 100, 1)
    last = max(a.completed_at for a in attempts if a.completed_at) if attempts else None

    by_diff: Dict[str, DifficultyStat] = _empty_difficulty_map()
    grouped: Dict[str, List[QCMAttempt]] = defaultdict(list)
    for a in attempts:
        d = (a.difficulty or "").lower()
        if d in by_diff:
            grouped[d].append(a)

    for d, rows in grouped.items():
        rows_pcts = [(r.score / r.total * 100) if r.total else 0.0 for r in rows]
        rows_passed = sum(1 for r in rows if r.passed)
        by_diff[d] = DifficultyStat(
            attempts=len(rows),
            avg_score_pct=round(sum(rows_pcts) / len(rows_pcts), 1),
            pass_rate=round(rows_passed / len(rows) * 100, 1),
        )

    return StudentQCMSummary(
        attempts=len(attempts),
        passed=passed,
        avg_score_pct=avg,
        best_score_pct=best,
        pass_rate=pass_rate,
        last_attempt_at=last,
        by_difficulty=by_diff,
    )


def _compute_streaks(active_dates: set, today: datetime.date) -> tuple[int, int]:
    """Return (current_streak, longest_streak) in days based on a set of date objects."""
    if not active_dates:
        return 0, 0

    sorted_dates = sorted(active_dates, reverse=True)

    # current streak: consecutive days back from today (or yesterday if user wasn't active today)
    current = 0
    cursor = today
    if cursor not in active_dates:
        cursor = today - timedelta(days=1)
    while cursor in active_dates:
        current += 1
        cursor = cursor - timedelta(days=1)

    # longest streak: scan all dates ascending
    asc = sorted(active_dates)
    longest = 1
    run = 1
    for i in range(1, len(asc)):
        if (asc[i] - asc[i - 1]).days == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1

    return current, longest


def get_student_analytics(student_id: str, db: Session) -> StudentAnalyticsOut:
    sid = UUID(student_id)
    now = datetime.utcnow()
    today = now.date()
    since_30d = now - timedelta(days=30)

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == sid)
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )

    if not enrollments:
        empty_trend = [
            StudentActivityPoint(date=(now - timedelta(days=i)).date().isoformat())
            for i in range(29, -1, -1)
        ]
        return StudentAnalyticsOut(
            activity_trend=empty_trend,
            difficulty_breakdown=_empty_difficulty_map(),
        )

    course_ids = [e.course_id for e in enrollments]
    courses = {c.id: c for c in db.query(Course).filter(Course.id.in_(course_ids)).all()}

    # Resolve professor + category names in batch
    prof_ids = list({c.professor_id for c in courses.values()})
    professors = {
        u.id: u.full_name for u in db.query(User).filter(User.id.in_(prof_ids)).all()
    } if prof_ids else {}
    cat_ids = list({c.category_id for c in courses.values() if c.category_id})
    categories = {
        cat.id: cat.name for cat in db.query(Category).filter(Category.id.in_(cat_ids)).all()
    } if cat_ids else {}

    # Progress percentages (batched)
    progress_pct_map = _batch_progress_pct(sid, course_ids, db)

    # Per-course completed items + totals — needed for the per-course card
    progress_rows = (
        db.query(CourseProgress)
        .filter(CourseProgress.student_id == sid, CourseProgress.course_id.in_(course_ids))
        .all()
    )
    completed_count_by_course: Dict[UUID, int] = defaultdict(int)
    for p in progress_rows:
        completed_count_by_course[p.course_id] += 1

    total_items_by_course: Dict[UUID, int] = {}
    for cid in course_ids:
        sub_count, mat_count = _count_course_items(cid, db)
        total_items_by_course[cid] = sub_count + mat_count

    # All quiz attempts for this student (across enrolled courses)
    attempts = (
        db.query(QCMAttempt)
        .filter(QCMAttempt.student_id == sid)
        .order_by(QCMAttempt.completed_at.desc())
        .all()
    )
    attempts_by_course: Dict[UUID, List[QCMAttempt]] = defaultdict(list)
    for a in attempts:
        attempts_by_course[a.course_id].append(a)

    # Build per-course items
    course_items: List[StudentCourseAnalyticsItem] = []
    for e in enrollments:
        course = courses.get(e.course_id)
        if not course:
            continue
        course_attempts = attempts_by_course.get(e.course_id, [])
        course_items.append(StudentCourseAnalyticsItem(
            course_id=str(course.id),
            course_title=course.title,
            thumbnail=course.thumbnail,
            professor_name=professors.get(course.professor_id, "Unknown"),
            category_name=categories.get(course.category_id) if course.category_id else None,
            enrollment_status=e.status,
            enrolled_at=e.enrolled_at,
            progress_pct=progress_pct_map.get(e.course_id, 0.0),
            completed_items=completed_count_by_course.get(e.course_id, 0),
            total_items=total_items_by_course.get(e.course_id, 0),
            quiz=_summarize_attempts(course_attempts),
        ))

    total_completed = sum(1 for c in course_items if c.enrollment_status == "completed")
    total_not_started = sum(1 for c in course_items if c.progress_pct == 0 and c.enrollment_status != "completed")
    total_in_progress = len(course_items) - total_completed - total_not_started
    overall_progress = round(
        sum(c.progress_pct for c in course_items) / len(course_items), 1
    ) if course_items else 0.0

    # Overall quiz aggregates
    overall_summary = _summarize_attempts(attempts)
    diff_breakdown = overall_summary.by_difficulty if overall_summary.by_difficulty else _empty_difficulty_map()

    # Activity trend over last 30 days
    trend_lessons: Dict[str, int] = defaultdict(int)
    trend_quizzes: Dict[str, int] = defaultdict(int)
    active_dates: set = set()

    for p in progress_rows:
        if p.completed_at and p.completed_at >= since_30d:
            day_key = p.completed_at.date().isoformat()
            trend_lessons[day_key] += 1
            active_dates.add(p.completed_at.date())

    for a in attempts:
        if a.completed_at and a.completed_at >= since_30d:
            day_key = a.completed_at.date().isoformat()
            trend_quizzes[day_key] += 1
            active_dates.add(a.completed_at.date())

    # Streaks use ALL activity dates (not just last 30d, in case user has older streak)
    all_active_dates: set = set()
    for p in progress_rows:
        if p.completed_at:
            all_active_dates.add(p.completed_at.date())
    for a in attempts:
        if a.completed_at:
            all_active_dates.add(a.completed_at.date())

    current_streak, longest_streak = _compute_streaks(all_active_dates, today)

    activity_trend: List[StudentActivityPoint] = []
    for offset in range(29, -1, -1):
        d = (now - timedelta(days=offset)).date().isoformat()
        activity_trend.append(StudentActivityPoint(
            date=d,
            lessons_completed=trend_lessons.get(d, 0),
            quizzes_taken=trend_quizzes.get(d, 0),
        ))

    lessons_30d = sum(p.lessons_completed for p in activity_trend)
    quizzes_30d = sum(p.quizzes_taken for p in activity_trend)

    # Recent attempts (last 10)
    recent: List[StudentRecentAttempt] = []
    for a in attempts[:10]:
        course = courses.get(a.course_id)
        pct = round(a.score / a.total * 100, 1) if a.total else 0.0
        recent.append(StudentRecentAttempt(
            attempt_id=str(a.id),
            course_id=str(a.course_id),
            course_title=course.title if course else "Unknown course",
            section_id=str(a.section_id) if a.section_id else None,
            difficulty=a.difficulty,
            score=a.score,
            total=a.total,
            score_pct=pct,
            passed=a.passed,
            completed_at=a.completed_at,
        ))

    # Strongest / weakest by quiz performance
    courses_with_quizzes = [c for c in course_items if c.quiz.attempts > 0]
    strongest = None
    weakest = None
    if courses_with_quizzes:
        best = max(courses_with_quizzes, key=lambda c: c.quiz.avg_score_pct)
        worst = min(courses_with_quizzes, key=lambda c: c.quiz.avg_score_pct)
        strongest = CourseHighlight(
            course_id=best.course_id,
            course_title=best.course_title,
            avg_score_pct=best.quiz.avg_score_pct,
            attempts=best.quiz.attempts,
        )
        if worst.course_id != best.course_id:
            weakest = CourseHighlight(
                course_id=worst.course_id,
                course_title=worst.course_title,
                avg_score_pct=worst.quiz.avg_score_pct,
                attempts=worst.quiz.attempts,
            )

    return StudentAnalyticsOut(
        courses=course_items,
        total_courses=len(course_items),
        total_completed=total_completed,
        total_in_progress=total_in_progress,
        total_not_started=total_not_started,
        overall_progress_pct=overall_progress,
        total_quiz_attempts=overall_summary.attempts,
        quizzes_passed=overall_summary.passed,
        overall_quiz_avg_pct=overall_summary.avg_score_pct,
        overall_quiz_pass_rate=overall_summary.pass_rate,
        best_quiz_score_pct=overall_summary.best_score_pct,
        difficulty_breakdown=diff_breakdown,
        activity_trend=activity_trend,
        lessons_completed_30d=lessons_30d,
        quizzes_taken_30d=quizzes_30d,
        active_days_30d=len([d for d in active_dates if (today - d).days < 30]),
        current_streak_days=current_streak,
        longest_streak_days=longest_streak,
        recent_attempts=recent,
        strongest_course=strongest,
        needs_work_course=weakest,
    )

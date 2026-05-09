from __future__ import annotations
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel


class DifficultyStat(BaseModel):
    attempts: int = 0
    avg_score_pct: float = 0.0
    pass_rate: float = 0.0


class StudentQCMSummary(BaseModel):
    attempts: int = 0
    passed: int = 0
    avg_score_pct: float = 0.0
    best_score_pct: float = 0.0
    pass_rate: float = 0.0
    last_attempt_at: Optional[datetime] = None
    by_difficulty: Dict[str, DifficultyStat] = {}


class StudentCourseAnalyticsItem(BaseModel):
    course_id: str
    course_title: str
    thumbnail: Optional[str] = None
    professor_name: str
    category_name: Optional[str] = None
    enrollment_status: str
    enrolled_at: datetime
    progress_pct: float = 0.0
    completed_items: int = 0
    total_items: int = 0
    quiz: StudentQCMSummary = StudentQCMSummary()


class StudentRecentAttempt(BaseModel):
    attempt_id: str
    course_id: str
    course_title: str
    section_id: Optional[str] = None
    difficulty: str
    score: int
    total: int
    score_pct: float
    passed: bool
    completed_at: datetime


class StudentActivityPoint(BaseModel):
    date: str
    lessons_completed: int = 0
    quizzes_taken: int = 0


class CourseHighlight(BaseModel):
    course_id: str
    course_title: str
    avg_score_pct: float
    attempts: int


class StudentAnalyticsOut(BaseModel):
    # Course aggregates
    courses: List[StudentCourseAnalyticsItem] = []
    total_courses: int = 0
    total_completed: int = 0
    total_in_progress: int = 0
    total_not_started: int = 0
    overall_progress_pct: float = 0.0

    # Quiz aggregates
    total_quiz_attempts: int = 0
    quizzes_passed: int = 0
    overall_quiz_avg_pct: float = 0.0
    overall_quiz_pass_rate: float = 0.0
    best_quiz_score_pct: float = 0.0
    difficulty_breakdown: Dict[str, DifficultyStat] = {}

    # Activity / engagement (last 30 days)
    activity_trend: List[StudentActivityPoint] = []
    lessons_completed_30d: int = 0
    quizzes_taken_30d: int = 0
    active_days_30d: int = 0
    current_streak_days: int = 0
    longest_streak_days: int = 0

    # Highlights
    recent_attempts: List[StudentRecentAttempt] = []
    strongest_course: Optional[CourseHighlight] = None
    needs_work_course: Optional[CourseHighlight] = None

from __future__ import annotations
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel

from app.schemas.student_analytics import DifficultyStat


class LearnerCourseStats(BaseModel):
    course_id: str
    course_title: str
    enrollment_status: str
    enrolled_at: datetime
    progress_pct: float = 0.0
    completed_items: int = 0
    total_items: int = 0
    quiz_attempts: int = 0
    quiz_avg_pct: float = 0.0
    quiz_pass_rate: float = 0.0
    last_active_at: Optional[datetime] = None


class LearnerSummary(BaseModel):
    student_id: str
    full_name: str
    email: str
    courses_enrolled: int = 0
    courses_completed: int = 0
    courses_in_progress: int = 0
    avg_progress_pct: float = 0.0
    quiz_attempts: int = 0
    quizzes_passed: int = 0
    quiz_avg_pct: float = 0.0
    quiz_pass_rate: float = 0.0
    best_quiz_score_pct: float = 0.0
    last_active_at: Optional[datetime] = None
    active_days_30d: int = 0
    risk_level: str = "on_track"  # on_track | needs_attention | at_risk
    courses: List[LearnerCourseStats] = []


class LearnerActivityPoint(BaseModel):
    date: str
    lessons_completed: int = 0
    quizzes_taken: int = 0


class LearnerHighlight(BaseModel):
    student_id: str
    full_name: str
    avg_quiz_pct: float = 0.0
    avg_progress_pct: float = 0.0
    quiz_attempts: int = 0


class LearnerAnalyticsOut(BaseModel):
    learners: List[LearnerSummary] = []
    total_learners: int = 0
    active_learners_30d: int = 0
    avg_progress_pct: float = 0.0

    completed_count: int = 0
    in_progress_count: int = 0
    not_started_count: int = 0

    total_quiz_attempts: int = 0
    overall_quiz_avg_pct: float = 0.0
    overall_quiz_pass_rate: float = 0.0
    difficulty_breakdown: Dict[str, DifficultyStat] = {}

    activity_trend: List[LearnerActivityPoint] = []
    lessons_completed_30d: int = 0
    quizzes_taken_30d: int = 0

    top_performers: List[LearnerHighlight] = []
    needs_attention: List[LearnerHighlight] = []
    at_risk_count: int = 0
    needs_attention_count: int = 0

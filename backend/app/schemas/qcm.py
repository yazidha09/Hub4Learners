from __future__ import annotations
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class QCMQuestion(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    explanation: str


class QCMGenerateIn(BaseModel):
    course_id: str
    section_id: Optional[str] = None
    difficulty: str = Field(default="medium")  # easy | medium | hard


class QCMGenerateOut(BaseModel):
    course_id: str
    section_id: Optional[str] = None
    difficulty: str
    questions: List[QCMQuestion]


class QCMSubmitIn(BaseModel):
    course_id: str
    section_id: Optional[str] = None
    difficulty: str
    questions: List[QCMQuestion]
    answers: List[int]  # student's chosen index for each question


class QCMQuestionResult(BaseModel):
    question: str
    options: List[str]
    correct_index: int
    chosen_index: int
    is_correct: bool
    explanation: str


class QCMSubmitOut(BaseModel):
    attempt_id: str
    score: int
    total: int
    score_pct: float
    passed: bool
    pass_threshold_pct: float
    results: List[QCMQuestionResult]
    completed_at: datetime


class QCMAttemptOut(BaseModel):
    id: str
    course_id: str
    section_id: Optional[str] = None
    difficulty: str
    score: int
    total: int
    score_pct: float
    passed: bool
    completed_at: datetime

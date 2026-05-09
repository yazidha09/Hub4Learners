from __future__ import annotations
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func, Boolean
from sqlmodel import Field, SQLModel


PASS_THRESHOLD_PCT = 70.0


class QCMAttempt(SQLModel, table=True):
    __tablename__ = "qcm_attempts"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    student_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False, index=True))
    course_id: UUID = Field(sa_column=Column(ForeignKey("courses.id"), nullable=False, index=True))
    section_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("course_sections.id"), nullable=True, index=True),
    )
    difficulty: str = Field(sa_column=Column(String(16), nullable=False))
    score: int = Field(sa_column=Column(Integer, nullable=False))
    total: int = Field(sa_column=Column(Integer, nullable=False))
    passed: bool = Field(sa_column=Column(Boolean, nullable=False, default=False))
    questions_json: str = Field(sa_column=Column(Text, nullable=False))
    answers_json: str = Field(sa_column=Column(Text, nullable=False))
    completed_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

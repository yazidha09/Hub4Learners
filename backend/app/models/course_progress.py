from __future__ import annotations
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime

from sqlmodel import SQLModel, Field


class CourseProgress(SQLModel, table=True):
    __tablename__ = "course_progress"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    student_id: UUID = Field(foreign_key="users.id", index=True)
    course_id: UUID = Field(foreign_key="courses.id", index=True)
    subsection_id: Optional[UUID] = Field(
        default=None, foreign_key="course_subsections.id", nullable=True, index=True
    )
    material_id: Optional[UUID] = Field(
        default=None, foreign_key="course_materials.id", nullable=True, index=True
    )
    completed_at: datetime = Field(default_factory=datetime.utcnow)

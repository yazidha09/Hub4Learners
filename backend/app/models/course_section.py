from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func
from sqlmodel import Field, SQLModel


class CourseSection(SQLModel, table=True):
    __tablename__ = "course_sections"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    course_id: UUID = Field(sa_column=Column(ForeignKey("courses.id"), nullable=False, index=True))
    title: str = Field(sa_column=Column(String(255), nullable=False))
    order_index: int = Field(sa_column=Column(Integer, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

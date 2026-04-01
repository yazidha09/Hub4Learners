from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Enum, ForeignKey, func
from sqlmodel import Field, SQLModel

EnrollmentStatus = Enum("active", "completed", "blocked", name="enrollment_status")


class Enrollment(SQLModel, table=True):
    __tablename__ = "enrollments"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    student_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False, index=True))
    course_id: UUID = Field(sa_column=Column(ForeignKey("courses.id"), nullable=False, index=True))
    status: str = Field(sa_column=Column(EnrollmentStatus, nullable=False, default="active"))
    enrolled_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

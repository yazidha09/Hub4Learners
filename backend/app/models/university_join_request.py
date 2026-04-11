from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlmodel import Field, SQLModel


class UniversityJoinRequest(SQLModel, table=True):
    __tablename__ = "university_join_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    professor_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    university_id: UUID = Field(
        sa_column=Column(ForeignKey("universities.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    status: str = Field(
        sa_column=Column(String(20), nullable=False, server_default="pending")
    )  # pending | approved | rejected
    note: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    reviewed_by: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime, nullable=True)
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime, nullable=False, server_default=func.current_timestamp()
        )
    )

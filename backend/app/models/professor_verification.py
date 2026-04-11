from datetime import date, datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text, func
from sqlmodel import Field, SQLModel


class ProfessorVerificationRequest(SQLModel, table=True):
    __tablename__ = "professor_verification_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    professor_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    region_id: UUID = Field(
        sa_column=Column(ForeignKey("regions.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    birth_date: date = Field(sa_column=Column(Date, nullable=False))
    first_name: str = Field(sa_column=Column(String(255), nullable=False))
    father_name: str = Field(sa_column=Column(String(255), nullable=False))
    grandfather_name: str = Field(sa_column=Column(String(255), nullable=False))
    status: str = Field(default="pending", sa_column=Column(String(20), nullable=False))
    note: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    reviewed_by: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime, nullable=True)
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

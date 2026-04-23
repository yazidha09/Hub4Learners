from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class GeneratedCourse(SQLModel, table=True):
    __tablename__ = "generated_courses"

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id"), nullable=False, index=True)
    )
    pdf_filename: str = Field(
        sa_column=Column(String(255), nullable=False)
    )
    status: str = Field(
        sa_column=Column(String(20), nullable=False, server_default="processing")
    )
    difficulty: str = Field(
        sa_column=Column(String(20), nullable=False, server_default="intermediate")
    )
    result: Optional[Any] = Field(
        default=None,
        sa_column=Column(JSONB, nullable=True),
    )
    error: Optional[str] = Field(
        default=None,
        sa_column=Column(Text, nullable=True),
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime,
            nullable=False,
            server_default=func.current_timestamp(),
            onupdate=func.current_timestamp(),
        )
    )

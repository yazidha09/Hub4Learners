from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, String, Text, func
from sqlmodel import Field, SQLModel


class ChatRequest(SQLModel, table=True):
    __tablename__ = "chat_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    student_id: UUID = Field(nullable=False, index=True)
    professor_id: UUID = Field(nullable=False, index=True)
    message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(sa_column=Column(String(20), nullable=False, default="pending", index=True))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime, nullable=True)
    )

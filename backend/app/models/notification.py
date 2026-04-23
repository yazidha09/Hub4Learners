from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, JSON, String, Text, func
from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(nullable=False, index=True)
    type: str = Field(sa_column=Column(String(50), nullable=False))
    title: str = Field(sa_column=Column(String(255), nullable=False))
    body: str = Field(sa_column=Column(Text, nullable=False))
    meta: Optional[Any] = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    is_read: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    created_at: datetime = Field(
        sa_column=Column(
            DateTime, nullable=False, server_default=func.current_timestamp()
        )
    )

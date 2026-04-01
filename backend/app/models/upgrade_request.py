from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, String, Text, func
from sqlmodel import Field, SQLModel


class UpgradeRequest(SQLModel, table=True):
    __tablename__ = "upgrade_requests"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(nullable=False, index=True)
    status: str = Field(sa_column=Column(String(20), nullable=False, default="pending", index=True))
    cin_path: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    diploma_path: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    reviewer_notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime, nullable=True)
    )

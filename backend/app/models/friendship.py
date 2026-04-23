from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, String, func
from sqlmodel import Field, SQLModel


class Friendship(SQLModel, table=True):
    __tablename__ = "friendships"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    requester_id: UUID = Field(nullable=False, index=True)
    requestee_id: UUID = Field(nullable=False, index=True)
    status: str = Field(
        sa_column=Column(String(20), nullable=False, default="pending", index=True)
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )
    reviewed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime, nullable=True)
    )

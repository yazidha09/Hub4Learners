from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, String, Text, func
from sqlmodel import Field, SQLModel


class FriendMessage(SQLModel, table=True):
    __tablename__ = "friend_messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    friendship_id: UUID = Field(nullable=False, index=True)
    sender_id: UUID = Field(nullable=False, index=True)
    content: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    media_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    media_type: Optional[str] = Field(
        default=None, sa_column=Column(String(20), nullable=True)
    )  # "image" | "file"
    media_name: Optional[str] = Field(
        default=None, sa_column=Column(String(255), nullable=True)
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

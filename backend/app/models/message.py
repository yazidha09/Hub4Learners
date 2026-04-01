from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Text, func
from sqlmodel import Field, SQLModel


class Message(SQLModel, table=True):
    __tablename__ = "messages"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    chat_request_id: UUID = Field(nullable=False, index=True)
    sender_id: UUID = Field(nullable=False, index=True)
    content: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

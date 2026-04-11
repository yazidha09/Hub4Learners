from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlmodel import Field, SQLModel


class Region(SQLModel, table=True):
    __tablename__ = "regions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(255), nullable=False))
    code: Optional[str] = Field(default=None, sa_column=Column(String(50), unique=True, nullable=True))
    created_by: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

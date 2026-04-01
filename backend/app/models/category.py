from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlmodel import Field, SQLModel


class Category(SQLModel, table=True):
    __tablename__ = "categories"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), nullable=False, unique=True))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    icon: str = Field(sa_column=Column(String(50), nullable=False, default="📚"))
    order_index: int = Field(sa_column=Column(Integer, nullable=False, default=0))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

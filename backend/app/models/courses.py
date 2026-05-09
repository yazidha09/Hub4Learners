from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String, Text, func
from sqlmodel import Field, SQLModel


class Course(SQLModel, table=True):
    __tablename__ = "courses"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str = Field(sa_column=Column(String(255), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    thumbnail: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    price: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(10, 2), nullable=False))
    is_free: bool = Field(sa_column=Column(Boolean, nullable=False, default=False))
    is_subscription: bool = Field(sa_column=Column(Boolean, nullable=False, default=False))
    professor_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False, index=True))
    category_id: Optional[UUID] = Field(default=None, sa_column=Column(ForeignKey("categories.id"), nullable=True, index=True))
    is_published: bool = Field(sa_column=Column(Boolean, nullable=False, default=False))
    ai_summary: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    ai_summary_generated_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime, nullable=True)
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

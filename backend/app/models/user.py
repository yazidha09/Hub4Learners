from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, func
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    full_name: str = Field(sa_column=Column(String(255), nullable=False))
    email: str = Field(sa_column=Column(String(255), nullable=False, unique=True, index=True))
    password_hash: str = Field(sa_column=Column(Text, nullable=False))
    role: str = Field(sa_column=Column(String(50), nullable=False, index=True))
    bio: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    speciality: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))
    profile_image: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_active: bool = Field(default=True)
    is_verified: bool = Field(sa_column=Column(Boolean, nullable=False, server_default='true'), default=True)

    # Organizational hierarchy — nullable so existing rows and independent users stay valid
    university_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("universities.id", ondelete="SET NULL"), nullable=True, index=True),
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

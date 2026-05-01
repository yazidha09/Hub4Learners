from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlmodel import Field, SQLModel


class LessonBlock(SQLModel, table=True):
    __tablename__ = "lesson_blocks"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # subsection_id is the primary reference for blocks (new system)
    subsection_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("course_subsections.id"), nullable=True, index=True),
    )
    # section_id kept nullable for backward-compat (legacy/AI-generated blocks)
    section_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("course_sections.id"), nullable=True, index=True),
    )
    block_type: str = Field(sa_column=Column(String(20), nullable=False))  # text, image, video
    content: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    file_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    caption: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True))
    order_index: int = Field(sa_column=Column(Integer, nullable=False, default=0))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

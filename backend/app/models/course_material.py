from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlmodel import Field, SQLModel

MaterialType = Enum("pdf", "video", "audio", "exercise", name="material_type")


class CourseMaterial(SQLModel, table=True):
    __tablename__ = "course_materials"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    section_id: UUID = Field(sa_column=Column(ForeignKey("course_sections.id"), nullable=False, index=True))
    title: str = Field(sa_column=Column(String(255), nullable=False))
    type: str = Field(sa_column=Column(MaterialType, nullable=False))
    file_url: str = Field(sa_column=Column(Text, nullable=False))
    content_text: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    order_index: int = Field(sa_column=Column(Integer, nullable=False))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

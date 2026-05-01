from datetime import datetime
from uuid import UUID, uuid4

import sqlalchemy as sa
from sqlmodel import Column, Field, SQLModel


class Announcement(SQLModel, table=True):
    __tablename__ = "announcements"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    university_id: UUID = Field(foreign_key="universities.id", index=True)
    created_by: UUID = Field(foreign_key="users.id")
    title: str = Field(max_length=255)
    body: str = Field(sa_column=Column(sa.Text, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)

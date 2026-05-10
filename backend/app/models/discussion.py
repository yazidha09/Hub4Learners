from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func,
)
from sqlmodel import Field, SQLModel


class DiscussionPost(SQLModel, table=True):
    __tablename__ = "discussion_posts"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    course_id: UUID = Field(
        sa_column=Column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    subsection_id: UUID = Field(
        sa_column=Column(ForeignKey("course_subsections.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    author_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    parent_post_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=True, index=True),
    )
    content: str = Field(sa_column=Column(Text, nullable=False))
    is_deleted: bool = Field(
        sa_column=Column(Boolean, nullable=False, server_default="false"), default=False
    )
    edited_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime, nullable=True))
    upvote_count: int = Field(
        sa_column=Column(Integer, nullable=False, server_default="0"), default=0
    )
    reply_count: int = Field(
        sa_column=Column(Integer, nullable=False, server_default="0"), default=0
    )
    report_count: int = Field(
        sa_column=Column(Integer, nullable=False, server_default="0"), default=0
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )


class DiscussionVote(SQLModel, table=True):
    __tablename__ = "discussion_votes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_discussion_vote"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    post_id: UUID = Field(
        sa_column=Column(ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )


class DiscussionReport(SQLModel, table=True):
    __tablename__ = "discussion_reports"
    __table_args__ = (UniqueConstraint("post_id", "reporter_id", name="uq_discussion_report"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    post_id: UUID = Field(
        sa_column=Column(ForeignKey("discussion_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    reporter_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    reason: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )


class DiscussionSummary(SQLModel, table=True):
    __tablename__ = "discussion_summaries"

    subsection_id: UUID = Field(
        sa_column=Column(
            ForeignKey("course_subsections.id", ondelete="CASCADE"),
            primary_key=True,
        )
    )
    summary_md: str = Field(sa_column=Column(Text, nullable=False))
    post_count_at_gen: int = Field(
        sa_column=Column(Integer, nullable=False, server_default="0"), default=0
    )
    generated_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


SortKey = Literal["relevant", "top", "new", "old"]


class DiscussionPostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class DiscussionPostUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class DiscussionReportCreate(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=255)


class DiscussionAuthor(BaseModel):
    id: UUID
    full_name: str
    profile_image: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class DiscussionPostOut(BaseModel):
    id: UUID
    subsection_id: UUID
    parent_post_id: Optional[UUID] = None
    content: str
    is_deleted: bool
    edited_at: Optional[datetime] = None
    upvote_count: int
    reply_count: int
    has_voted: bool = False
    is_owner: bool = False
    is_instructor: bool = False
    author: DiscussionAuthor
    created_at: datetime
    replies: List["DiscussionPostOut"] = []


DiscussionPostOut.model_rebuild()


class DiscussionListOut(BaseModel):
    posts: List[DiscussionPostOut]
    total: int
    has_more: bool


class DiscussionVoteOut(BaseModel):
    post_id: UUID
    has_voted: bool
    upvote_count: int


class DiscussionSummaryOut(BaseModel):
    subsection_id: UUID
    summary_md: Optional[str] = None
    generated_at: Optional[datetime] = None
    post_count_at_gen: int = 0
    is_stale: bool = False
    can_generate: bool = False

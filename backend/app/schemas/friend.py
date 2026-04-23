from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UserSearchResult(BaseModel):
    id: UUID
    full_name: str
    role: str
    profile_image: Optional[str]
    university_name: Optional[str]

    class Config:
        from_attributes = True


class FriendRequestOut(BaseModel):
    id: UUID
    requester_id: UUID
    requester_full_name: str
    requester_profile_image: Optional[str]
    requestee_id: UUID
    requestee_full_name: str
    requestee_profile_image: Optional[str]
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class FriendOut(BaseModel):
    friendship_id: UUID
    friend_id: UUID
    full_name: str
    role: str
    profile_image: Optional[str]
    university_name: Optional[str]
    status: str


class SendFriendRequest(BaseModel):
    requestee_id: UUID


class ReviewFriendRequest(BaseModel):
    action: str  # "accept" or "block"


class FriendMessageOut(BaseModel):
    id: UUID
    friendship_id: UUID
    sender_id: UUID
    sender_full_name: str
    sender_profile_image: Optional[str]
    content: Optional[str]
    media_url: Optional[str]
    media_type: Optional[str]
    media_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SendFriendMessage(BaseModel):
    content: str

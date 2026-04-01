from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ChatRequestOut(BaseModel):
    id: UUID
    student_id: UUID
    student_full_name: str
    professor_id: UUID
    professor_full_name: str
    message: Optional[str]
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class SendChatRequest(BaseModel):
    professor_id: UUID
    message: Optional[str] = None


class ReviewChatRequest(BaseModel):
    action: str  # "accept" or "refuse"


class AutoRefuseUpdate(BaseModel):
    auto_refuse: bool


class MessageOut(BaseModel):
    id: UUID
    chat_request_id: UUID
    sender_id: UUID
    sender_full_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class SendMessage(BaseModel):
    content: str

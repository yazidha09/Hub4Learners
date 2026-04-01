from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class UpgradeRequestOut(BaseModel):
    id: UUID
    user_id: UUID
    user_full_name: str
    user_email: str
    status: str
    cin_path: Optional[str]
    diploma_path: Optional[str]
    message: Optional[str]
    reviewer_notes: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReviewRequest(BaseModel):
    action: str  # "approve" | "reject"
    reviewer_notes: Optional[str] = None

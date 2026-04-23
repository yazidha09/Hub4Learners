from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: UUID
    type: str
    title: str
    body: str
    meta: Optional[Any] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

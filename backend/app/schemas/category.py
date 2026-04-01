from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    icon: str
    order_index: int
    course_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

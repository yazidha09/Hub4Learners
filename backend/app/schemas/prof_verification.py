from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class ProfVerificationCreate(BaseModel):
    region_id: str
    birth_date: date
    first_name: str
    father_name: str
    grandfather_name: str
    note: Optional[str] = None


class ProfVerificationOut(BaseModel):
    id: str
    professor_id: str
    professor_name: Optional[str] = None
    region_id: str
    region_name: Optional[str] = None
    birth_date: date
    first_name: str
    father_name: str
    grandfather_name: str
    status: str
    note: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

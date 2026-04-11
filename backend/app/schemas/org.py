from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


# ── Region ─────────────────────────────────────────────────────────────────────

class RegionCreate(BaseModel):
    name: str
    code: Optional[str] = None


class RegionOut(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    university_count: int = 0

    class Config:
        from_attributes = True


# ── University ─────────────────────────────────────────────────────────────────

class UniversityCreate(BaseModel):
    name: str
    region_id: str


class UniversityOut(BaseModel):
    id: str
    name: str
    region_id: str
    region_name: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Admin creation payloads ────────────────────────────────────────────────────

class CreateAdminRequest(BaseModel):
    full_name: str
    email: str
    password: str
    region_id: Optional[str] = None       # required for regional_admin
    university_id: Optional[str] = None   # required for university_admin


# ── University join requests ───────────────────────────────────────────────────

class JoinRequestCreate(BaseModel):
    university_id: str
    note: Optional[str] = None


class JoinRequestOut(BaseModel):
    id: str
    professor_id: str
    professor_name: Optional[str] = None
    university_id: str
    university_name: Optional[str] = None
    status: str   # pending | approved | rejected
    note: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewJoinRequest(BaseModel):
    action: str   # 'approve' or 'reject'

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class MaterialOut(BaseModel):
    id: UUID
    section_id: UUID
    title: str
    type: str
    file_url: str
    content_text: Optional[str]
    order_index: int
    created_at: datetime

    class Config:
        from_attributes = True


class SectionOut(BaseModel):
    id: UUID
    course_id: UUID
    title: str
    order_index: int
    created_at: datetime
    materials: List[MaterialOut] = []

    class Config:
        from_attributes = True


class CourseOut(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    thumbnail: Optional[str]
    is_free: bool
    professor_id: UUID
    professor_name: str
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime
    sections: List[SectionOut] = []
    enrolled_count: int = 0

    class Config:
        from_attributes = True


class SectionCreate(BaseModel):
    title: str
    order_index: int = 0


class EnrollmentOut(BaseModel):
    id: UUID
    student_id: UUID
    course_id: UUID
    status: str
    enrolled_at: datetime

    class Config:
        from_attributes = True


class StudentOut(BaseModel):
    id: UUID
    full_name: str
    email: str
    enrolled_at: datetime
    status: str


class CourseStudentsOut(BaseModel):
    course_id: UUID
    course_title: str
    is_published: bool
    students: List[StudentOut] = []

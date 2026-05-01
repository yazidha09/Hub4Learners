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


class LessonBlockOut(BaseModel):
    id: UUID
    subsection_id: Optional[UUID] = None
    section_id: Optional[UUID] = None
    block_type: str
    content: Optional[str]
    file_url: Optional[str]
    caption: Optional[str]
    order_index: int
    created_at: datetime

    class Config:
        from_attributes = True


class SubsectionOut(BaseModel):
    id: UUID
    section_id: UUID
    title: str
    order_index: int
    created_at: datetime
    blocks: List[LessonBlockOut] = []

    class Config:
        from_attributes = True


class SubsectionCreate(BaseModel):
    title: str
    order_index: int = 0


class BlockUpdate(BaseModel):
    content: str
    caption: Optional[str] = None


class SectionOut(BaseModel):
    id: UUID
    course_id: UUID
    title: str
    order_index: int
    created_at: datetime
    materials: List[MaterialOut] = []
    blocks: List[LessonBlockOut] = []
    subsections: List[SubsectionOut] = []

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
    sections_count: int = 0
    enrolled_count: int = 0
    enrollment_status: Optional[str] = None
    progress_pct: float = 0.0

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


class MarkProgressRequest(BaseModel):
    subsection_id: Optional[str] = None
    material_id: Optional[str] = None


class CourseProgressOut(BaseModel):
    course_id: str
    completed_subsection_ids: List[str] = []
    completed_material_ids: List[str] = []
    total_items: int
    completed_items: int
    progress_pct: float


class AnalyticsReviewItem(BaseModel):
    user_name: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime


class CourseAnalyticsItem(BaseModel):
    course_id: str
    course_title: str
    thumbnail: Optional[str] = None
    category_name: Optional[str] = None
    is_published: bool
    created_at: datetime
    enrolled_count: int
    completed_count: int
    in_progress_count: int
    completion_rate: float
    avg_progress: float = 0.0
    avg_rating: float = 0.0
    rating_count: int = 0
    rating_distribution: dict = {}
    recent_reviews: List[AnalyticsReviewItem] = []
    enrollments_last_7d: int = 0
    enrollments_last_30d: int = 0
    last_enrollment_at: Optional[datetime] = None
    total_lessons: int = 0


class AnalyticsTrendPoint(BaseModel):
    date: str
    enrollments: int
    completions: int


class CourseAnalyticsOut(BaseModel):
    courses: List[CourseAnalyticsItem] = []
    total_courses: int = 0
    total_published: int = 0
    total_drafts: int = 0
    total_enrolled: int = 0
    total_completed: int = 0
    total_in_progress: int = 0
    overall_completion_rate: float = 0.0
    overall_avg_rating: float = 0.0
    total_reviews: int = 0
    overall_rating_distribution: dict = {}
    enrollments_last_7d: int = 0
    enrollments_last_30d: int = 0
    completions_last_30d: int = 0
    trend: List[AnalyticsTrendPoint] = []
    top_courses_by_enrollment: List[CourseAnalyticsItem] = []
    top_courses_by_rating: List[CourseAnalyticsItem] = []


class FeedbackCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class FeedbackOut(BaseModel):
    id: UUID
    course_id: UUID
    user_id: UUID
    user_name: str
    rating: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class UploadPDFResponse(BaseModel):
    job_id: str
    status: str
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str          # processing | completed | failed
    pdf_filename: str
    difficulty: str
    result: Optional[dict] = None
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegenerateSubsectionRequest(BaseModel):
    difficulty: Optional[str] = None   # falls back to job's original difficulty


class RegenerateSubsectionResponse(BaseModel):
    section_index: int
    subsection_index: int
    subsection_title: str
    content: str


class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str


class QuizResponse(BaseModel):
    subsection_title: str
    questions: list[QuizQuestion]

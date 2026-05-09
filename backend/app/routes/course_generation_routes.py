import asyncio
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.controller import course_generation_controller as ctrl
from app.database import get_db
from app.models.course_section import CourseSection
from app.models.course_subsection import CourseSubsection
from app.models.courses import Course
from app.models.lesson_block import LessonBlock
from app.schemas.course_generation import (
    JobStatusResponse,
    QuizResponse,
    RegenerateSubsectionRequest,
    RegenerateSubsectionResponse,
    UploadPDFResponse,
)
from app.utils.course_generator import generate_quiz, _content_prompt, _call_sync
from app.utils.rag import index_course_sync
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/course-gen", tags=["course-generation"])

_MAX_PDF_BYTES = 20 * 1024 * 1024   # 20 MB hard cap


class ImportOverrideBody(BaseModel):
    result: Optional[Dict[str, Any]] = None
_VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


# ── POST /api/course-gen/upload ───────────────────────────────────────────────

@router.post("/upload", response_model=UploadPDFResponse, status_code=202)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    difficulty: str = Form(default="intermediate"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(pdf_bytes) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF file exceeds the 20 MB limit")

    if difficulty not in _VALID_DIFFICULTIES:
        difficulty = "intermediate"

    job = ctrl.create_job(
        user_id=current_user["sub"],
        filename=file.filename or "upload.pdf",
        difficulty=difficulty,
        db=db,
    )

    background_tasks.add_task(ctrl.run_pipeline, str(job.id), pdf_bytes, difficulty)

    return UploadPDFResponse(
        job_id=str(job.id),
        status="processing",
        message="PDF uploaded. Course generation is running in the background.",
    )


# ── GET /api/course-gen/{job_id} ──────────────────────────────────────────────

@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_valid_uuid(job_id)
    job = ctrl.get_job(job_id, db)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    _assert_owner(job, current_user)

    return JobStatusResponse(
        job_id=str(job.id),
        status=job.status,
        pdf_filename=job.pdf_filename,
        difficulty=job.difficulty,
        result=job.result if job.status == "completed" else None,
        error=job.error if job.status == "failed" else None,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )


# ── POST …/sections/{s}/subsections/{ss}/regenerate ──────────────────────────

@router.post(
    "/{job_id}/sections/{section_idx}/subsections/{subsection_idx}/regenerate",
    response_model=RegenerateSubsectionResponse,
)
async def regenerate_subsection(
    job_id: str,
    section_idx: int,
    subsection_idx: int,
    body: RegenerateSubsectionRequest = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    if body is None:
        body = RegenerateSubsectionRequest()

    _assert_valid_uuid(job_id)
    job = ctrl.get_job(job_id, db)
    if not job or job.status != "completed":
        raise HTTPException(status_code=404, detail="Completed job not found")
    _assert_owner(job, current_user)

    course = job.result
    section, subsection = _get_subsection(course, section_idx, subsection_idx)

    difficulty = body.difficulty if body.difficulty in _VALID_DIFFICULTIES else job.difficulty

    # Re-format the EXISTING subsection text. The AI is format-only; we never
    # rewrite the professor's content. Strip HTML to recover plain source text,
    # then ask the polish prompt to lay it out again.
    import re as _re
    existing_html = subsection.get("content") or ""
    plain_source = _re.sub(r"<[^>]+>", " ", existing_html)
    plain_source = _re.sub(r"\s+", " ", plain_source).strip()

    prompt = _content_prompt(
        course_title=course["title"],
        section_title=section["title"],
        subsection_title=subsection["title"],
        reference_text=plain_source,
        difficulty=difficulty,
    )
    new_content = await asyncio.to_thread(_call_sync, prompt)
    new_content = new_content.strip()
    if not new_content.startswith("<"):
        new_content = f"<p>{new_content}</p>"

    # Persist updated subsection content
    course["sections"][section_idx]["subsections"][subsection_idx]["content"] = new_content
    job.result = course
    job.updated_at = datetime.utcnow()
    db.add(job)
    db.commit()

    return RegenerateSubsectionResponse(
        section_index=section_idx,
        subsection_index=subsection_idx,
        subsection_title=subsection["title"],
        content=new_content,
    )


# ── POST …/sections/{s}/subsections/{ss}/quiz ─────────────────────────────────

@router.post(
    "/{job_id}/sections/{section_idx}/subsections/{subsection_idx}/quiz",
    response_model=QuizResponse,
)
async def get_subsection_quiz(
    job_id: str,
    section_idx: int,
    subsection_idx: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _assert_valid_uuid(job_id)
    job = ctrl.get_job(job_id, db)
    if not job or job.status != "completed":
        raise HTTPException(status_code=404, detail="Completed job not found")
    _assert_owner(job, current_user)

    _, subsection = _get_subsection(job.result, section_idx, subsection_idx)

    questions = await generate_quiz(
        subsection_title=subsection["title"],
        content_html=subsection.get("content", ""),
    )

    return QuizResponse(subsection_title=subsection["title"], questions=questions)


# ── POST /api/course-gen/{job_id}/import/{course_id} ─────────────────────────

@router.post("/{job_id}/import/{course_id}")
def import_into_course(
    job_id: str,
    course_id: str,
    body: Optional[ImportOverrideBody] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    """
    Take a completed AI generation job and create real CourseSection +
    CourseMaterial rows inside an existing course.

    Each section in the generated JSON → CourseSection
    Each subsection                    → CourseMaterial (type='lesson', content_text=HTML)

    Optionally accepts a `result` body to override the stored job result
    (allows the professor to import with their edited content).
    """
    _assert_valid_uuid(job_id)
    _assert_valid_uuid(course_id)

    job = ctrl.get_job(job_id, db)
    if not job:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if job.status != "completed":
        raise HTTPException(status_code=400, detail=f"Job is not completed (status: {job.status})")
    _assert_owner(job, current_user)

    course = db.query(Course).filter(Course.id == uuid.UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != current_user["sub"]:
        raise HTTPException(status_code=403, detail="You do not own this course")

    # Use professor's edited result if provided, otherwise fall back to stored result
    generated = (body.result if body and body.result else None) or job.result
    if not generated or "sections" not in generated:
        raise HTTPException(status_code=400, detail="Job result has no sections")

    # Current max order_index so we append after existing sections
    existing_sections = (
        db.query(CourseSection)
        .filter(CourseSection.course_id == uuid.UUID(course_id))
        .all()
    )
    section_offset = len(existing_sections)

    created_sections = 0
    created_lessons = 0

    for s_i, gen_section in enumerate(generated["sections"]):
        section = CourseSection(
            course_id=uuid.UUID(course_id),
            title=gen_section["title"],
            order_index=section_offset + s_i,
        )
        db.add(section)
        db.flush()  # get section.id

        for ss_i, sub in enumerate(gen_section.get("subsections", [])):
            subsection = CourseSubsection(
                section_id=section.id,
                title=sub["title"],
                order_index=ss_i,
            )
            db.add(subsection)
            db.flush()  # get subsection.id

            content = sub.get("content", "") or ""
            if content and not content.strip().startswith("<"):
                content = f"<p>{content}</p>"

            block = LessonBlock(
                subsection_id=subsection.id,
                block_type="text",
                content=content or "<p>No content generated.</p>",
                order_index=0,
            )
            db.add(block)
            created_lessons += 1

        created_sections += 1

    db.commit()

    # Index synchronously — import is a deliberate "course is ready" event,
    # so we want the call to return only after Pinecone has the vectors.
    # Bg threads can die under uvicorn --reload; sync is the reliable path.
    indexed_chunks = 0
    index_error: Optional[str] = None
    try:
        indexed_chunks = index_course_sync(course_id)
    except Exception as exc:
        import traceback as _tb
        _tb.print_exc()
        index_error = str(exc)

    return {
        "detail": "Import successful",
        "course_id": course_id,
        "sections_created": created_sections,
        "lessons_created": created_lessons,
        "indexed_chunks": indexed_chunks,
        "index_error": index_error,
    }


# ── Private guards ────────────────────────────────────────────────────────────

def _assert_valid_uuid(value: str) -> None:
    try:
        uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")


def _assert_owner(job, current_user: dict) -> None:
    if str(job.user_id) != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")


def _get_subsection(course: dict, s_idx: int, ss_idx: int) -> tuple[dict, dict]:
    try:
        section = course["sections"][s_idx]
        subsection = section["subsections"][ss_idx]
        return section, subsection
    except (IndexError, KeyError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid section or subsection index")

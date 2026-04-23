import logging
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.generated_course import GeneratedCourse
from app.utils.course_generator import build_full_course
from app.utils.pdf_parser import parse_pdf

logger = logging.getLogger(__name__)

_VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


# ── CRUD helpers ──────────────────────────────────────────────────────────────

def create_job(
    user_id: str,
    filename: str,
    difficulty: str,
    db: Session,
) -> GeneratedCourse:
    if difficulty not in _VALID_DIFFICULTIES:
        difficulty = "intermediate"
    job = GeneratedCourse(
        user_id=uuid.UUID(user_id),
        pdf_filename=filename,
        status="processing",
        difficulty=difficulty,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(job_id: str, db: Session) -> GeneratedCourse | None:
    try:
        uid = uuid.UUID(job_id)
    except ValueError:
        return None
    return db.query(GeneratedCourse).filter(GeneratedCourse.id == uid).first()


def _update_job(job: GeneratedCourse, db: Session, **kwargs) -> GeneratedCourse:
    for key, value in kwargs.items():
        setattr(job, key, value)
    job.updated_at = datetime.utcnow()
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# ── Background pipeline ───────────────────────────────────────────────────────

async def run_pipeline(job_id: str, pdf_bytes: bytes, difficulty: str) -> None:
    """
    Full async pipeline invoked as a FastAPI BackgroundTask.
    Owns its own DB session to avoid sharing across threads.
    """
    from app.database import SessionLocal   # local import to avoid circular deps

    db = SessionLocal()
    try:
        job = db.query(GeneratedCourse).filter(
            GeneratedCourse.id == uuid.UUID(job_id)
        ).first()
        if not job:
            logger.error("Pipeline: job %s not found in DB", job_id)
            return

        chunks = parse_pdf(pdf_bytes)
        if not chunks:
            _update_job(job, db, status="failed", error="PDF contained no extractable text")
            return

        course = await build_full_course(chunks, difficulty=difficulty)
        _update_job(job, db, status="completed", result=course)
        logger.info("Job %s completed: %s", job_id, course.get("title"))

    except Exception as exc:
        logger.exception("Pipeline failed for job %s", job_id)
        try:
            job = db.query(GeneratedCourse).filter(
                GeneratedCourse.id == uuid.UUID(job_id)
            ).first()
            if job:
                _update_job(job, db, status="failed", error=str(exc))
        except Exception:
            logger.exception("Failed to mark job %s as failed", job_id)
    finally:
        db.close()

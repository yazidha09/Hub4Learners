import re
import traceback
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.courses import Course
from app.controller.qcm_controller import (
    generate_qcm,
    list_attempts,
    submit_qcm,
)
from app.schemas.qcm import (
    QCMAttemptOut,
    QCMGenerateIn,
    QCMGenerateOut,
    QCMSubmitIn,
    QCMSubmitOut,
)
from app.models.course_section import CourseSection
from app.models.course_subsection import CourseSubsection
from app.models.lesson_block import LessonBlock
from app.utils.gemini import chat_with_context, generate_course_summary
from app.utils.rag import (
    collect_course_content,
    course_index_stats,
    index_course_bg,
    index_course_sync,
    search_course,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


class HistoryTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    course_id: str
    message: str
    history: list[HistoryTurn] = []


class ChatResponse(BaseModel):
    reply: str


# ── POST /api/ai/chat ─────────────────────────────────────────────────────────

def _course_has_text_content(course_id: str, db: Session) -> bool:
    """True if the course has at least one indexable text block or material.
    Used to distinguish 'empty course' from 'course exists but isn't indexed'."""
    cid = UUID(course_id)
    text_block = (
        db.query(LessonBlock.id)
        .join(CourseSection, LessonBlock.section_id == CourseSection.id, isouter=True)
        .join(CourseSubsection, LessonBlock.subsection_id == CourseSubsection.id, isouter=True)
        .filter(LessonBlock.block_type == "text", LessonBlock.content.isnot(None))
        .filter(
            (CourseSection.course_id == cid)
            | (CourseSubsection.section_id.in_(
                db.query(CourseSection.id).filter(CourseSection.course_id == cid)
            ))
        )
        .first()
    )
    return text_block is not None


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == UUID(body.course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # RAG retrieval — log full error if Pinecone is unreachable so we can
    # diagnose, but still answer the student (falling back to no-context).
    context_chunks: list[str] = []
    try:
        context_chunks = search_course(str(course.id), body.message)
    except Exception as exc:
        print(f"[RAG] search_course FAILED for course {course.id}: {exc}")
        traceback.print_exc()

    # Self-heal: if Pinecone has nothing for this course but the DB has text
    # content, kick off a background reindex so the next message works. The
    # current message still falls through to the honest "no context" reply.
    if not context_chunks:
        try:
            stats = course_index_stats(str(course.id))
            if stats.get("vector_count", 0) == 0 and _course_has_text_content(str(course.id), db):
                print(f"[RAG] chat: course {course.id} has DB content but 0 vectors — kicking off bg reindex")
                index_course_bg(str(course.id))
        except Exception as exc:
            print(f"[RAG] chat self-heal check failed: {exc}")

    history = [{"role": t.role, "content": t.content} for t in body.history]
    reply = chat_with_context(
        course_title=course.title,
        context_chunks=context_chunks,
        history=history,
        user_message=body.message,
    )
    return ChatResponse(reply=reply)


# ── POST /api/ai/reindex/{course_id} ─────────────────────────────────────────

@router.post("/reindex/{course_id}")
def reindex_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Pull every text LessonBlock + parsed material text for this course,
    chunk + embed, and upsert the vectors into Pinecone so the AI can answer
    based on the actual course content. Synchronous — the response carries
    the success/error directly.
    """
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    try:
        n = index_course_sync(course_id)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Indexing failed: {exc}")

    return {"chunks_stored": n, "course_id": course_id}


# ── GET /api/ai/index-status/{course_id} ─────────────────────────────────────

@router.get("/index-status/{course_id}")
def index_status(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Report whether the course has any vectors in Pinecone — lets the
    frontend show 'AI ready' / 'Indexing…' instead of guessing."""
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    stats = course_index_stats(course_id)
    stats["course_id"] = course_id
    return stats


# ── QCM (AI-generated multiple choice quizzes) ───────────────────────────────

@router.post("/qcm/generate", response_model=QCMGenerateOut)
def qcm_generate(
    body: QCMGenerateIn,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return generate_qcm(
        course_id=body.course_id,
        section_id=body.section_id,
        difficulty=body.difficulty,
        db=db,
    )


@router.post("/qcm/submit", response_model=QCMSubmitOut)
def qcm_submit(
    body: QCMSubmitIn,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return submit_qcm(
        student_id=current_user["sub"],
        course_id=body.course_id,
        section_id=body.section_id,
        difficulty=body.difficulty,
        questions=body.questions,
        answers=body.answers,
        db=db,
    )


@router.get("/qcm/history", response_model=list[QCMAttemptOut])
def qcm_history(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return list_attempts(
        student_id=current_user["sub"],
        course_id=course_id,
        db=db,
    )


# ── Course summary (AI-generated markdown recap of the whole course) ─────────

class CourseSummaryOut(BaseModel):
    course_id: str
    summary: Optional[str] = None
    generated_at: Optional[datetime] = None


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _html_to_text(s: str) -> str:
    s = _HTML_TAG_RE.sub(" ", s or "")
    for ent, ch in [("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"),
                    ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")]:
        s = s.replace(ent, ch)
    return _WS_RE.sub(" ", s).strip()


def _build_summary_sections(course_id: str, db: Session) -> list[dict]:
    """Group raw course content by its source section so the LLM can mirror the
    course's own structure in the summary."""
    raw = collect_course_content(course_id, db)
    grouped: dict[str, dict] = {}
    order: list[str] = []
    for item in raw.get("items", []):
        sid = item.get("section_id") or "__intro__"
        title = item.get("section_title") or "Course Overview"
        if sid not in grouped:
            grouped[sid] = {"title": title, "items": []}
            order.append(sid)
        text = item.get("content_text") or ""
        if text.lstrip().startswith("<"):
            text = _html_to_text(text)
        text = text.strip()
        if not text:
            continue
        label = item.get("subsection_title") or "Lesson"
        grouped[sid]["items"].append({"label": label, "text": text})
    return [grouped[sid] for sid in order if grouped[sid]["items"]]


@router.get("/course-summary/{course_id}", response_model=CourseSummaryOut)
def get_course_summary(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return CourseSummaryOut(
        course_id=course_id,
        summary=course.ai_summary,
        generated_at=course.ai_summary_generated_at,
    )


@router.post("/course-summary/{course_id}", response_model=CourseSummaryOut)
def regenerate_course_summary(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Generate (or regenerate) the AI markdown recap for the course and
    persist it. Synchronous so the caller knows whether it succeeded."""
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    sections = _build_summary_sections(course_id, db)
    has_content = any(it["text"] for s in sections for it in s["items"])
    if not has_content:
        raise HTTPException(
            status_code=400,
            detail="Course has no text content yet — add lessons before generating a summary.",
        )

    try:
        markdown = generate_course_summary(
            course_title=course.title,
            course_description=course.description or "",
            sections=sections,
        )
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {exc}")

    course.ai_summary = markdown
    course.ai_summary_generated_at = datetime.utcnow()
    db.commit()
    db.refresh(course)

    return CourseSummaryOut(
        course_id=course_id,
        summary=course.ai_summary,
        generated_at=course.ai_summary_generated_at,
    )

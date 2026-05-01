from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course_section import CourseSection
from app.models.course_subsection import CourseSubsection
from app.models.courses import Course
from app.models.lesson_block import LessonBlock
from app.utils.gemini import chat_with_context
from app.utils.rag import index_course, search_course
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

@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == UUID(body.course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # RAG retrieval — silent fallback to no-context if Pinecone is unreachable
    context_chunks: list[str] = []
    try:
        context_chunks = search_course(str(course.id), body.message)
    except Exception:
        pass

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
    Pull every text LessonBlock for this course, chunk + embed them, and
    upsert the vectors into Pinecone so the AI can answer based on the
    actual course content.
    """
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # ── New hierarchy: LessonBlock → CourseSubsection → CourseSection ────────
    rows_new = (
        db.query(
            LessonBlock,
            CourseSubsection.title.label("ss_title"),
            CourseSection.title.label("s_title"),
        )
        .join(CourseSubsection, LessonBlock.subsection_id == CourseSubsection.id)
        .join(CourseSection, CourseSubsection.section_id == CourseSection.id)
        .filter(
            CourseSection.course_id == UUID(course_id),
            LessonBlock.block_type == "text",
            LessonBlock.content.isnot(None),
        )
        .all()
    )

    # ── Legacy blocks linked directly to a section (no subsection) ───────────
    rows_legacy = (
        db.query(LessonBlock, CourseSection.title.label("s_title"))
        .join(CourseSection, LessonBlock.section_id == CourseSection.id)
        .filter(
            CourseSection.course_id == UUID(course_id),
            LessonBlock.block_type == "text",
            LessonBlock.content.isnot(None),
            LessonBlock.subsection_id.is_(None),
        )
        .all()
    )

    sections_data: list[dict] = []
    for block, ss_title, s_title in rows_new:
        sections_data.append({
            "section_title": s_title,
            "subsection_title": ss_title,
            "content_text": block.content,
        })
    for block, s_title in rows_legacy:
        sections_data.append({
            "section_title": s_title,
            "subsection_title": "",
            "content_text": block.content,
        })

    try:
        n = index_course(str(course.id), sections_data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {exc}")

    return {"chunks_stored": n, "course_id": course_id}

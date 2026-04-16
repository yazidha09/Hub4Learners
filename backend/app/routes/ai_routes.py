from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.courses import Course
from app.models.course_section import CourseSection
from app.models.course_material import CourseMaterial
from app.utils.grok import chat
from app.utils.embeddings import (
    course_has_chunks,
    embed_and_store_material,
    retrieve_relevant_chunks,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class HistoryTurn(BaseModel):
    role: str      # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    course_id: str
    message: str
    history: list[HistoryTurn] = []


class ChatResponse(BaseModel):
    reply: str


# ── helpers ────────────────────────────────────────────────────────────────────

def _index_all_materials(course_id: str, db: Session) -> None:
    """
    Embed and store chunks for every PDF material in the course that has
    content_text.  Called automatically on the first chat request when no
    chunks exist yet (handles materials uploaded before RAG was set up).
    Errors are swallowed so a failed embedding never breaks the chat.
    """
    sections = (
        db.query(CourseSection)
        .filter(CourseSection.course_id == UUID(course_id))
        .order_by(CourseSection.order_index)
        .all()
    )
    for section in sections:
        materials = (
            db.query(CourseMaterial)
            .filter(CourseMaterial.section_id == section.id)
            .all()
        )
        for mat in materials:
            if mat.content_text:
                try:
                    embed_and_store_material(
                        material_id=str(mat.id),
                        course_id=course_id,
                        section_title=section.title,
                        material_title=mat.title,
                        content_text=mat.content_text,
                        db=db,
                    )
                except Exception:
                    pass


# ── endpoints ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == UUID(body.course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Auto-index on first chat if chunks are missing (e.g. pre-RAG materials)
    if not course_has_chunks(body.course_id, db):
        _index_all_materials(body.course_id, db)

    # RAG retrieval: find the most relevant chunks for this query
    chunks = retrieve_relevant_chunks(
        query=body.message,
        course_id=body.course_id,
        db=db,
        top_k=6,
    )

    history = [{"role": t.role, "content": t.content} for t in body.history]

    reply = chat(
        course_title=course.title,
        retrieved_chunks=chunks,
        history=history,
        user_message=body.message,
    )

    return ChatResponse(reply=reply)


@router.post("/reindex/{course_id}", response_model=dict)
def reindex_course(
    course_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    """
    Force re-embedding of all materials in a course.
    Useful after editing material content or when upgrading the embedding model.
    Only the course professor or an admin should call this in practice.
    """
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    _index_all_materials(course_id, db)
    return {"detail": f"Reindexing complete for course '{course.title}'"}

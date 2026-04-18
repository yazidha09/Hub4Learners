from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.courses import Course
from app.utils.gemini import chat
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


@router.post("/chat", response_model=ChatResponse)
def ai_chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    course = db.query(Course).filter(Course.id == UUID(body.course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    history = [{"role": t.role, "content": t.content} for t in body.history]

    reply = chat(
        course_title=course.title,
        history=history,
        user_message=body.message,
    )

    return ChatResponse(reply=reply)

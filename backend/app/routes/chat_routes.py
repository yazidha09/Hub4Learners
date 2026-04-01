from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.chat import AutoRefuseUpdate, ChatRequestOut, MessageOut, ReviewChatRequest, SendChatRequest, SendMessage
from app.controller.chat_controller import (
    close_chat_room,
    get_auto_refuse,
    get_incoming_requests,
    get_messages,
    get_my_requests_as_student,
    review_chat_request,
    send_chat_request,
    send_message,
    set_auto_refuse,
)
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/chat", tags=["Chat Requests"])


@router.post("/request", response_model=ChatRequestOut)
def send_request(
    body: SendChatRequest,
    current_user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    return send_chat_request(current_user["sub"], body, db)


@router.get("/my-requests", response_model=list[ChatRequestOut])
def my_requests(
    current_user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    return get_my_requests_as_student(current_user["sub"], db)


@router.get("/incoming", response_model=list[ChatRequestOut])
def incoming_requests(
    current_user: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return get_incoming_requests(current_user["sub"], db)


@router.put("/requests/{request_id}/review", response_model=ChatRequestOut)
def review_request(
    request_id: str,
    body: ReviewChatRequest,
    current_user: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return review_chat_request(current_user["sub"], request_id, body.action, db)


@router.get("/auto-refuse")
def get_auto_refuse_setting(
    current_user: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return {"auto_refuse": get_auto_refuse(current_user["sub"], db)}


@router.put("/auto-refuse")
def update_auto_refuse(
    body: AutoRefuseUpdate,
    current_user: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return {"auto_refuse": set_auto_refuse(current_user["sub"], body.auto_refuse, db)}


@router.post("/requests/{request_id}/messages", response_model=MessageOut)
def post_message(
    request_id: str,
    body: SendMessage,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return send_message(current_user["sub"], request_id, body.content, db)


@router.get("/requests/{request_id}/messages", response_model=list[MessageOut])
def list_messages(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_messages(current_user["sub"], request_id, db)


@router.put("/requests/{request_id}/close", response_model=ChatRequestOut)
def close_room(
    request_id: str,
    current_user: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return close_chat_room(current_user["sub"], request_id, db)

import asyncio

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.controller import notification_controller
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
from app.websocket_manager import manager

router = APIRouter(prefix="/chat", tags=["Chat Requests"])


@router.post("/request", response_model=ChatRequestOut)
async def send_request(
    body: SendChatRequest,
    current_user: dict = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    result = send_chat_request(current_user["sub"], body, db)
    await notification_controller.push(
        user_id=str(result.professor_id),
        type="chat_request",
        title="New Chat Request",
        body=f"{result.student_full_name} wants to chat with you",
        db=db,
        meta={"request_id": str(result.id)},
    )
    return result


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
async def review_request(
    request_id: str,
    body: ReviewChatRequest,
    current_user: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    result = review_chat_request(current_user["sub"], request_id, body.action, db)
    accepted = body.action == "accept"
    await notification_controller.push(
        user_id=str(result.student_id),
        type="chat_request_reviewed",
        title="Chat Request " + ("Accepted" if accepted else "Refused"),
        body=f"{result.professor_full_name} {'accepted' if accepted else 'refused'} your chat request",
        db=db,
        meta={"request_id": str(result.id), "action": body.action},
    )
    return result


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
async def post_message(
    request_id: str,
    body: SendMessage,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = send_message(current_user["sub"], request_id, body.content, db)
    asyncio.create_task(manager.broadcast_chat(request_id, {
        "id": str(msg.id),
        "chat_request_id": str(msg.chat_request_id),
        "sender_id": str(msg.sender_id),
        "sender_full_name": msg.sender_full_name,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
    }))
    return msg


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

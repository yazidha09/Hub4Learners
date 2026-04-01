from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.chat_request import ChatRequest
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ChatRequestOut, MessageOut, SendChatRequest


def _to_out(req: ChatRequest, db: Session) -> ChatRequestOut:
    student = db.query(User).filter(User.id == req.student_id).first()
    professor = db.query(User).filter(User.id == req.professor_id).first()
    return ChatRequestOut(
        id=req.id,
        student_id=req.student_id,
        student_full_name=student.full_name if student else "Unknown",
        professor_id=req.professor_id,
        professor_full_name=professor.full_name if professor else "Unknown",
        message=req.message,
        status=req.status,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
    )


def send_chat_request(student_id: str, body: SendChatRequest, db: Session) -> ChatRequestOut:
    student = db.query(User).filter(User.id == UUID(student_id)).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if student.role != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only students can send chat requests")

    professor = db.query(User).filter(User.id == body.professor_id, User.role == "professor").first()
    if not professor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor not found")

    existing = (
        db.query(ChatRequest)
        .filter(
            ChatRequest.student_id == UUID(student_id),
            ChatRequest.professor_id == body.professor_id,
            ChatRequest.status == "pending",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending request to this professor",
        )

    auto_refuse = getattr(professor, "auto_refuse_chat", False)
    initial_status = "refused" if auto_refuse else "pending"
    reviewed_at = datetime.now(timezone.utc) if auto_refuse else None

    req = ChatRequest(
        student_id=UUID(student_id),
        professor_id=body.professor_id,
        message=body.message,
        status=initial_status,
        reviewed_at=reviewed_at,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _to_out(req, db)


def get_my_requests_as_student(student_id: str, db: Session) -> list[ChatRequestOut]:
    requests = (
        db.query(ChatRequest)
        .filter(ChatRequest.student_id == UUID(student_id))
        .order_by(ChatRequest.created_at.desc())
        .all()
    )
    return [_to_out(r, db) for r in requests]


def get_incoming_requests(professor_id: str, db: Session) -> list[ChatRequestOut]:
    requests = (
        db.query(ChatRequest)
        .filter(ChatRequest.professor_id == UUID(professor_id))
        .order_by(ChatRequest.created_at.desc())
        .all()
    )
    return [_to_out(r, db) for r in requests]


def review_chat_request(professor_id: str, request_id: str, action: str, db: Session) -> ChatRequestOut:
    if action not in ("accept", "refuse"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be 'accept' or 'refuse'",
        )

    req = db.query(ChatRequest).filter(ChatRequest.id == UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if str(req.professor_id) != professor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your request")
    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has already been reviewed",
        )

    req.status = "accepted" if action == "accept" else "refused"
    req.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return _to_out(req, db)


def get_auto_refuse(professor_id: str, db: Session) -> bool:
    prof = db.query(User).filter(User.id == UUID(professor_id)).first()
    if not prof:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor not found")
    return bool(getattr(prof, "auto_refuse_chat", False))


def set_auto_refuse(professor_id: str, value: bool, db: Session) -> bool:
    prof = db.query(User).filter(User.id == UUID(professor_id)).first()
    if not prof:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Professor not found")
    prof.auto_refuse_chat = value
    db.commit()
    return value


def _msg_to_out(msg: Message, db: Session) -> MessageOut:
    sender = db.query(User).filter(User.id == msg.sender_id).first()
    return MessageOut(
        id=msg.id,
        chat_request_id=msg.chat_request_id,
        sender_id=msg.sender_id,
        sender_full_name=sender.full_name if sender else "Unknown",
        content=msg.content,
        created_at=msg.created_at,
    )


def _get_chat_request_for_participant(user_id: UUID, request_id: str, db: Session) -> ChatRequest:
    req = db.query(ChatRequest).filter(ChatRequest.id == UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    if user_id != req.student_id and user_id != req.professor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this chat")
    return req


def send_message(user_id: str, request_id: str, content: str, db: Session) -> MessageOut:
    uid = UUID(user_id)
    req = _get_chat_request_for_participant(uid, request_id, db)
    if req.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send messages — chat room is not active",
        )
    msg = Message(chat_request_id=UUID(request_id), sender_id=uid, content=content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_to_out(msg, db)


def get_messages(user_id: str, request_id: str, db: Session) -> list[MessageOut]:
    uid = UUID(user_id)
    _get_chat_request_for_participant(uid, request_id, db)
    messages = (
        db.query(Message)
        .filter(Message.chat_request_id == UUID(request_id))
        .order_by(Message.created_at.asc())
        .all()
    )
    return [_msg_to_out(m, db) for m in messages]


def close_chat_room(professor_id: str, request_id: str, db: Session) -> ChatRequestOut:
    req = db.query(ChatRequest).filter(ChatRequest.id == UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    if str(req.professor_id) != professor_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your chat room")
    if req.status != "accepted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Chat room is not active")
    req.status = "closed"
    db.commit()
    db.refresh(req)
    return _to_out(req, db)

import os
import shutil
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.friend_message import FriendMessage
from app.models.friendship import Friendship
from app.models.university import University
from app.models.user import User
from app.schemas.friend import (
    FriendMessageOut,
    FriendOut,
    FriendRequestOut,
    SendFriendRequest,
    UserSearchResult,
)

CHAT_MEDIA_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "uploads", "chat-media"
)
os.makedirs(CHAT_MEDIA_DIR, exist_ok=True)

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_FILE_EXT = {".pdf", ".docx", ".txt", ".zip", ".xlsx", ".pptx"}


def _user_university_name(user: User, db: Session) -> Optional[str]:
    if not user.university_id:
        return None
    uni = db.query(University).filter(University.id == user.university_id).first()
    return uni.name if uni else None


def _friendship_to_out(friendship: Friendship, db: Session) -> FriendRequestOut:
    requester = db.query(User).filter(User.id == friendship.requester_id).first()
    requestee = db.query(User).filter(User.id == friendship.requestee_id).first()
    return FriendRequestOut(
        id=friendship.id,
        requester_id=friendship.requester_id,
        requester_full_name=requester.full_name if requester else "Unknown",
        requester_profile_image=getattr(requester, "profile_image", None),
        requestee_id=friendship.requestee_id,
        requestee_full_name=requestee.full_name if requestee else "Unknown",
        requestee_profile_image=getattr(requestee, "profile_image", None),
        status=friendship.status,
        created_at=friendship.created_at,
        reviewed_at=friendship.reviewed_at,
    )


def _msg_to_out(msg: FriendMessage, db: Session) -> FriendMessageOut:
    sender = db.query(User).filter(User.id == msg.sender_id).first()
    return FriendMessageOut(
        id=msg.id,
        friendship_id=msg.friendship_id,
        sender_id=msg.sender_id,
        sender_full_name=sender.full_name if sender else "Unknown",
        sender_profile_image=getattr(sender, "profile_image", None),
        content=msg.content,
        media_url=msg.media_url,
        media_type=msg.media_type,
        media_name=msg.media_name,
        created_at=msg.created_at,
    )


def _get_friendship_for_participant(user_id: UUID, friendship_id: str, db: Session) -> Friendship:
    f = db.query(Friendship).filter(Friendship.id == UUID(friendship_id)).first()
    if not f:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if user_id != f.requester_id and user_id != f.requestee_id:
        raise HTTPException(status_code=403, detail="Not a participant in this friendship")
    return f


# ── Search ────────────────────────────────────────────────────────────────────

def search_users(query: str, current_user_id: str, db: Session) -> list[UserSearchResult]:
    if len(query.strip()) < 2:
        return []
    uid = UUID(current_user_id)
    pattern = f"%{query.strip()}%"
    users = (
        db.query(User)
        .filter(
            User.id != uid,
            User.is_active,
            User.role.in_(["student", "professor"]),
            User.full_name.ilike(pattern),
        )
        .limit(20)
        .all()
    )
    return [
        UserSearchResult(
            id=u.id,
            full_name=u.full_name,
            role=u.role,
            profile_image=getattr(u, "profile_image", None),
            university_name=_user_university_name(u, db),
        )
        for u in users
    ]


# ── Friend Requests ───────────────────────────────────────────────────────────

def send_friend_request(requester_id: str, body: SendFriendRequest, db: Session) -> FriendRequestOut:
    rid = UUID(requester_id)
    if rid == body.requestee_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    requestee = db.query(User).filter(User.id == body.requestee_id).first()
    if not requestee:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(Friendship)
        .filter(
            or_(
                (Friendship.requester_id == rid) & (Friendship.requestee_id == body.requestee_id),
                (Friendship.requester_id == body.requestee_id) & (Friendship.requestee_id == rid),
            )
        )
        .first()
    )
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=409, detail="Already friends")
        if existing.status == "pending":
            raise HTTPException(status_code=409, detail="Friend request already sent")
        if existing.status == "blocked":
            raise HTTPException(status_code=403, detail="Cannot send request")

    f = Friendship(
        requester_id=rid,
        requestee_id=body.requestee_id,
        status="pending",
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return _friendship_to_out(f, db)


def get_incoming_requests(user_id: str, db: Session) -> list[FriendRequestOut]:
    uid = UUID(user_id)
    friendships = (
        db.query(Friendship)
        .filter(Friendship.requestee_id == uid, Friendship.status == "pending")
        .order_by(Friendship.created_at.desc())
        .all()
    )
    return [_friendship_to_out(f, db) for f in friendships]


def get_sent_requests(user_id: str, db: Session) -> list[FriendRequestOut]:
    uid = UUID(user_id)
    friendships = (
        db.query(Friendship)
        .filter(Friendship.requester_id == uid, Friendship.status == "pending")
        .order_by(Friendship.created_at.desc())
        .all()
    )
    return [_friendship_to_out(f, db) for f in friendships]


def review_friend_request(user_id: str, friendship_id: str, action: str, db: Session) -> FriendRequestOut:
    if action not in ("accept", "block"):
        raise HTTPException(status_code=400, detail="action must be 'accept' or 'block'")

    uid = UUID(user_id)
    f = db.query(Friendship).filter(Friendship.id == UUID(friendship_id)).first()
    if not f:
        raise HTTPException(status_code=404, detail="Request not found")
    if f.requestee_id != uid:
        raise HTTPException(status_code=403, detail="Not your request to review")
    if f.status != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    f.status = "accepted" if action == "accept" else "blocked"
    f.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(f)
    return _friendship_to_out(f, db)


def cancel_friend_request(user_id: str, friendship_id: str, db: Session):
    uid = UUID(user_id)
    f = db.query(Friendship).filter(Friendship.id == UUID(friendship_id)).first()
    if not f:
        raise HTTPException(status_code=404, detail="Request not found")
    if f.requester_id != uid:
        raise HTTPException(status_code=403, detail="Not your request")
    if f.status != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    db.delete(f)
    db.commit()


def unfriend(user_id: str, friendship_id: str, db: Session):
    uid = UUID(user_id)
    f = db.query(Friendship).filter(Friendship.id == UUID(friendship_id)).first()
    if not f:
        raise HTTPException(status_code=404, detail="Friendship not found")
    if uid != f.requester_id and uid != f.requestee_id:
        raise HTTPException(status_code=403, detail="Not your friendship")
    if f.status != "accepted":
        raise HTTPException(status_code=400, detail="Not an active friendship")
    db.delete(f)
    db.commit()


def list_friends(user_id: str, db: Session) -> list[FriendOut]:
    uid = UUID(user_id)
    friendships = (
        db.query(Friendship)
        .filter(
            Friendship.status == "accepted",
            or_(Friendship.requester_id == uid, Friendship.requestee_id == uid),
        )
        .order_by(Friendship.reviewed_at.desc())
        .all()
    )
    result = []
    for f in friendships:
        friend_id = f.requestee_id if f.requester_id == uid else f.requester_id
        friend = db.query(User).filter(User.id == friend_id).first()
        if not friend:
            continue
        result.append(
            FriendOut(
                friendship_id=f.id,
                friend_id=friend.id,
                full_name=friend.full_name,
                role=friend.role,
                profile_image=getattr(friend, "profile_image", None),
                university_name=_user_university_name(friend, db),
                status=f.status,
            )
        )
    return result


# ── Messages ──────────────────────────────────────────────────────────────────

def get_friend_messages(user_id: str, friendship_id: str, db: Session) -> list[FriendMessageOut]:
    uid = UUID(user_id)
    f = _get_friendship_for_participant(uid, friendship_id, db)
    if f.status != "accepted":
        raise HTTPException(status_code=400, detail="Not an active friendship")
    msgs = (
        db.query(FriendMessage)
        .filter(FriendMessage.friendship_id == f.id)
        .order_by(FriendMessage.created_at.asc())
        .all()
    )
    return [_msg_to_out(m, db) for m in msgs]


def send_text_message(user_id: str, friendship_id: str, content: str, db: Session) -> FriendMessageOut:
    uid = UUID(user_id)
    f = _get_friendship_for_participant(uid, friendship_id, db)
    if f.status != "accepted":
        raise HTTPException(status_code=400, detail="Not an active friendship")
    msg = FriendMessage(
        friendship_id=f.id,
        sender_id=uid,
        content=content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_to_out(msg, db)


def send_media_message(
    user_id: str,
    friendship_id: str,
    file: UploadFile,
    caption: Optional[str],
    db: Session,
) -> FriendMessageOut:
    uid = UUID(user_id)
    f = _get_friendship_for_participant(uid, friendship_id, db)
    if f.status != "accepted":
        raise HTTPException(status_code=400, detail="Not an active friendship")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext in ALLOWED_IMAGE_EXT:
        media_type = "image"
    elif ext in ALLOWED_FILE_EXT:
        media_type = "file"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: images and {', '.join(ALLOWED_FILE_EXT)}",
        )

    filename = f"cm_{uuid4().hex}{ext}"
    dest = os.path.join(CHAT_MEDIA_DIR, filename)
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)

    media_url = f"/uploads/chat-media/{filename}"
    msg = FriendMessage(
        friendship_id=f.id,
        sender_id=uid,
        content=caption if caption else None,
        media_url=media_url,
        media_type=media_type,
        media_name=file.filename,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_to_out(msg, db)

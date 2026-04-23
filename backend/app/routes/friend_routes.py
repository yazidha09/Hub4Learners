import asyncio
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.controller import notification_controller
from app.database import get_db
from app.models.friendship import Friendship
from app.websocket_manager import manager
from app.schemas.friend import (
    FriendMessageOut,
    FriendOut,
    FriendRequestOut,
    ReviewFriendRequest,
    SendFriendMessage,
    SendFriendRequest,
    UserSearchResult,
)
from app.controller.friend_controller import (
    cancel_friend_request,
    get_friend_messages,
    get_incoming_requests,
    get_sent_requests,
    list_friends,
    review_friend_request,
    search_users,
    send_friend_request,
    send_media_message,
    send_text_message,
    unfriend,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/friends", tags=["Friends"])


@router.get("/search", response_model=list[UserSearchResult])
def search(
    q: str = "",
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return search_users(q, current_user["sub"], db)


@router.post("/request", response_model=FriendRequestOut)
async def add_friend(
    body: SendFriendRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = send_friend_request(current_user["sub"], body, db)
    await notification_controller.push(
        user_id=str(result.requestee_id),
        type="friend_request",
        title="Friend Request",
        body=f"{result.requester_full_name} sent you a friend request",
        db=db,
        meta={"friendship_id": str(result.id)},
    )
    return result


@router.get("/requests/incoming", response_model=list[FriendRequestOut])
def incoming(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_incoming_requests(current_user["sub"], db)


@router.get("/requests/sent", response_model=list[FriendRequestOut])
def sent(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_sent_requests(current_user["sub"], db)


@router.put("/requests/{friendship_id}/review", response_model=FriendRequestOut)
async def review(
    friendship_id: str,
    body: ReviewFriendRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = review_friend_request(current_user["sub"], friendship_id, body.action, db)
    accepted = body.action == "accept"
    await notification_controller.push(
        user_id=str(result.requester_id),
        type="friend_request_reviewed",
        title="Friend Request " + ("Accepted" if accepted else "Declined"),
        body=(
            f"{result.requestee_full_name} accepted your friend request"
            if accepted
            else f"{result.requestee_full_name} declined your friend request"
        ),
        db=db,
        meta={"friendship_id": str(result.id), "action": body.action},
    )
    return result


@router.delete("/requests/{friendship_id}")
def cancel(
    friendship_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cancel_friend_request(current_user["sub"], friendship_id, db)
    return {"ok": True}


@router.get("/list", response_model=list[FriendOut])
def friends_list(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_friends(current_user["sub"], db)


@router.delete("/{friendship_id}")
def do_unfriend(
    friendship_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unfriend(current_user["sub"], friendship_id, db)
    return {"ok": True}


@router.get("/{friendship_id}/messages", response_model=list[FriendMessageOut])
def get_messages(
    friendship_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_friend_messages(current_user["sub"], friendship_id, db)


@router.post("/{friendship_id}/messages", response_model=FriendMessageOut)
async def post_message(
    friendship_id: str,
    body: SendFriendMessage,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = send_text_message(current_user["sub"], friendship_id, body.content, db)
    payload = {
        "id": str(msg.id),
        "friendship_id": str(msg.friendship_id),
        "sender_id": str(msg.sender_id),
        "sender_full_name": msg.sender_full_name,
        "sender_profile_image": msg.sender_profile_image,
        "content": msg.content,
        "media_url": None,
        "media_type": None,
        "media_name": None,
        "created_at": msg.created_at.isoformat(),
    }
    asyncio.create_task(manager.broadcast_friend(friendship_id, payload))

    f = db.query(Friendship).filter(Friendship.id == UUID(friendship_id)).first()
    if f:
        other_id = (
            str(f.requestee_id)
            if str(f.requester_id) == current_user["sub"]
            else str(f.requester_id)
        )
        await notification_controller.push(
            user_id=other_id,
            type="friend_message",
            title="New Message",
            body=f"{msg.sender_full_name}: {msg.content[:60] if msg.content else 'sent you a message'}",
            db=db,
            meta={"friendship_id": friendship_id},
        )
    return msg


@router.post("/{friendship_id}/messages/media", response_model=FriendMessageOut)
async def post_media(
    friendship_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = send_media_message(current_user["sub"], friendship_id, file, caption, db)
    payload = {
        "id": str(msg.id),
        "friendship_id": str(msg.friendship_id),
        "sender_id": str(msg.sender_id),
        "sender_full_name": msg.sender_full_name,
        "sender_profile_image": msg.sender_profile_image,
        "content": msg.content,
        "media_url": msg.media_url,
        "media_type": msg.media_type,
        "media_name": msg.media_name,
        "created_at": msg.created_at.isoformat(),
    }
    asyncio.create_task(manager.broadcast_friend(friendship_id, payload))

    f = db.query(Friendship).filter(Friendship.id == UUID(friendship_id)).first()
    if f:
        other_id = (
            str(f.requestee_id)
            if str(f.requester_id) == current_user["sub"]
            else str(f.requester_id)
        )
        await notification_controller.push(
            user_id=other_id,
            type="friend_message",
            title="New Message",
            body=f"{msg.sender_full_name} sent you a {'photo' if msg.media_type == 'image' else 'file'}",
            db=db,
            meta={"friendship_id": friendship_id},
        )
    return msg

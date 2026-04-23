from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.websocket_manager import manager


async def push(
    user_id: str,
    type: str,
    title: str,
    body: str,
    db: Session,
    meta: Optional[dict] = None,
) -> Notification:
    notif = Notification(
        user_id=UUID(user_id),
        type=type,
        title=title,
        body=body,
        meta=meta,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    await manager.notify_user(user_id, {
        "id": str(notif.id),
        "type": type,
        "title": title,
        "body": body,
        "meta": meta,
        "is_read": False,
        "created_at": notif.created_at.isoformat(),
    })
    return notif


def get_notifications(user_id: str, db: Session) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == UUID(user_id))
        .order_by(Notification.created_at.desc())
        .limit(100)
        .all()
    )


def mark_one_read(user_id: str, notif_id: str, db: Session) -> bool:
    n = (
        db.query(Notification)
        .filter(
            Notification.id == UUID(notif_id),
            Notification.user_id == UUID(user_id),
        )
        .first()
    )
    if not n:
        return False
    n.is_read = True
    db.commit()
    return True


def mark_all_read(user_id: str, db: Session) -> int:
    updated = (
        db.query(Notification)
        .filter(
            Notification.user_id == UUID(user_id),
            Notification.is_read == False,  # noqa: E712
        )
        .update({"is_read": True})
    )
    db.commit()
    return updated


def delete_notification(user_id: str, notif_id: str, db: Session) -> bool:
    deleted = (
        db.query(Notification)
        .filter(
            Notification.id == UUID(notif_id),
            Notification.user_id == UUID(user_id),
        )
        .delete()
    )
    db.commit()
    return deleted > 0


def delete_all_notifications(user_id: str, db: Session) -> int:
    deleted = (
        db.query(Notification)
        .filter(Notification.user_id == UUID(user_id))
        .delete()
    )
    db.commit()
    return deleted

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.controller import notification_controller
from app.database import get_db
from app.schemas.notification import NotificationOut
from app.utils.security import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return notification_controller.get_notifications(current_user["sub"], db)


@router.put("/read-all")
def read_all(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = notification_controller.mark_all_read(current_user["sub"], db)
    return {"updated": count}


@router.put("/{notif_id}/read")
def read_one(
    notif_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = notification_controller.mark_one_read(current_user["sub"], notif_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.delete("/clear-all")
def clear_all(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = notification_controller.delete_all_notifications(current_user["sub"], db)
    return {"deleted": count}


@router.delete("/{notif_id}")
def delete_one(
    notif_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok = notification_controller.delete_notification(current_user["sub"], notif_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

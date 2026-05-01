from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.controller import notification_controller
from app.database import get_db
from app.models.announcement import Announcement
from app.models.user import User
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementCreate(BaseModel):
    title: str
    body: str


class AnnouncementOut(BaseModel):
    id: str
    university_id: str
    created_by: str
    title: str
    body: str
    recipient_count: int
    created_at: str


@router.post("", response_model=AnnouncementOut)
async def create_announcement(
    payload: AnnouncementCreate,
    actor: dict = Depends(require_role("university_admin")),
    db: Session = Depends(get_db),
):
    univ_id = actor.get("university_id")
    if not univ_id:
        raise HTTPException(400, "You are not assigned to a university")

    ann = Announcement(
        university_id=UUID(univ_id),
        created_by=UUID(actor["sub"]),
        title=payload.title,
        body=payload.body,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)

    recipients = db.query(User).filter(User.university_id == UUID(univ_id)).all()
    for user in recipients:
        await notification_controller.push(
            user_id=str(user.id),
            type="announcement",
            title=payload.title,
            body=payload.body,
            db=db,
            meta={"announcement_id": str(ann.id)},
        )

    return AnnouncementOut(
        id=str(ann.id),
        university_id=str(ann.university_id),
        created_by=str(ann.created_by),
        title=ann.title,
        body=ann.body,
        recipient_count=len(recipients),
        created_at=ann.created_at.isoformat(),
    )


@router.get("", response_model=list[AnnouncementOut])
def list_announcements(
    actor: dict = Depends(require_role("university_admin")),
    db: Session = Depends(get_db),
):
    univ_id = actor.get("university_id")
    if not univ_id:
        return []

    anns = (
        db.query(Announcement)
        .filter(Announcement.university_id == UUID(univ_id))
        .order_by(Announcement.created_at.desc())
        .all()
    )
    recipient_count = (
        db.query(User).filter(User.university_id == UUID(univ_id)).count()
    )
    return [
        AnnouncementOut(
            id=str(a.id),
            university_id=str(a.university_id),
            created_by=str(a.created_by),
            title=a.title,
            body=a.body,
            recipient_count=recipient_count,
            created_at=a.created_at.isoformat(),
        )
        for a in anns
    ]


@router.get("/my", response_model=list[AnnouncementOut])
def get_my_announcements(
    actor: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    univ_id = actor.get("university_id")
    if not univ_id:
        return []

    anns = (
        db.query(Announcement)
        .filter(Announcement.university_id == UUID(univ_id))
        .order_by(Announcement.created_at.desc())
        .all()
    )
    return [
        AnnouncementOut(
            id=str(a.id),
            university_id=str(a.university_id),
            created_by=str(a.created_by),
            title=a.title,
            body=a.body,
            recipient_count=0,
            created_at=a.created_at.isoformat(),
        )
        for a in anns
    ]

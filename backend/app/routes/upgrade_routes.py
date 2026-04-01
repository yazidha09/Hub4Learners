from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.upgrade import ReviewRequest, UpgradeRequestOut
from app.controller.upgrade_controller import (
    get_my_upgrade_request,
    list_upgrade_requests,
    review_upgrade_request,
    submit_upgrade_request,
)
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/upgrade", tags=["Upgrade Requests"])


@router.post("/request", response_model=UpgradeRequestOut)
def request_upgrade(
    cin: UploadFile = File(...),
    diploma: Optional[UploadFile] = File(default=None),
    message: Optional[str] = Form(default=None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return submit_upgrade_request(current_user["sub"], cin, diploma, message, db)


@router.get("/my-request", response_model=Optional[UpgradeRequestOut])
def my_request(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_my_upgrade_request(current_user["sub"], db)


@router.get("/requests", response_model=list[UpgradeRequestOut])
def all_requests(
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return list_upgrade_requests(db)


@router.put("/requests/{request_id}/review", response_model=UpgradeRequestOut)
def review_request(
    request_id: str,
    review: ReviewRequest,
    current_user: dict = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    return review_upgrade_request(request_id, review, db)

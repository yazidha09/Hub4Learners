import os
import shutil
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.upgrade_request import UpgradeRequest
from app.models.user import User
from app.schemas.upgrade import UpgradeRequestOut, ReviewRequest

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "upgrade_docs")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}


def _save_file(file: UploadFile, user_id: str, doc_type: str) -> str:
    """Save an uploaded file and return its relative path."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{doc_type} must be a JPG, PNG, or PDF file",
        )
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{user_id}_{doc_type}_{uuid4().hex}{ext}"
    full_path = os.path.join(UPLOAD_DIR, filename)
    with open(full_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return f"upgrade_docs/{filename}"


def submit_upgrade_request(
    user_id: str,
    cin_file: Optional[UploadFile],
    diploma_file: Optional[UploadFile],
    message: Optional[str],
    db: Session,
) -> UpgradeRequestOut:
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only students can request a professor upgrade",
        )
    if cin_file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CIN card document is required",
        )

    existing = (
        db.query(UpgradeRequest)
        .filter(UpgradeRequest.user_id == UUID(user_id), UpgradeRequest.status == "pending")
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending upgrade request",
        )

    cin_path = _save_file(cin_file, user_id, "cin")
    diploma_path = _save_file(diploma_file, user_id, "diploma") if (diploma_file and diploma_file.filename) else None

    req = UpgradeRequest(
        user_id=UUID(user_id),
        status="pending",
        cin_path=cin_path,
        diploma_path=diploma_path,
        message=message,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return UpgradeRequestOut(
        id=req.id,
        user_id=req.user_id,
        user_full_name=user.full_name,
        user_email=user.email,
        status=req.status,
        cin_path=req.cin_path,
        diploma_path=req.diploma_path,
        message=req.message,
        reviewer_notes=req.reviewer_notes,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
    )


def get_my_upgrade_request(user_id: str, db: Session) -> Optional[UpgradeRequestOut]:
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    req = (
        db.query(UpgradeRequest)
        .filter(UpgradeRequest.user_id == UUID(user_id))
        .order_by(UpgradeRequest.created_at.desc())
        .first()
    )
    if not req:
        return None

    return UpgradeRequestOut(
        id=req.id,
        user_id=req.user_id,
        user_full_name=user.full_name,
        user_email=user.email,
        status=req.status,
        cin_path=req.cin_path,
        diploma_path=req.diploma_path,
        message=req.message,
        reviewer_notes=req.reviewer_notes,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
    )


def list_upgrade_requests(db: Session) -> list[UpgradeRequestOut]:
    requests = db.query(UpgradeRequest).order_by(UpgradeRequest.created_at.desc()).all()
    result = []
    for req in requests:
        user = db.query(User).filter(User.id == req.user_id).first()
        result.append(
            UpgradeRequestOut(
                id=req.id,
                user_id=req.user_id,
                user_full_name=user.full_name if user else "Unknown",
                user_email=user.email if user else "Unknown",
                status=req.status,
                cin_path=req.cin_path,
                diploma_path=req.diploma_path,
                message=req.message,
                reviewer_notes=req.reviewer_notes,
                created_at=req.created_at,
                reviewed_at=req.reviewed_at,
            )
        )
    return result


def review_upgrade_request(
    request_id: str,
    review: ReviewRequest,
    db: Session,
) -> UpgradeRequestOut:
    if review.action not in ("approve", "reject"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="action must be 'approve' or 'reject'",
        )

    req = db.query(UpgradeRequest).filter(UpgradeRequest.id == UUID(request_id)).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has already been reviewed",
        )

    req.status = "approved" if review.action == "approve" else "rejected"
    req.reviewer_notes = review.reviewer_notes
    req.reviewed_at = datetime.utcnow()

    if review.action == "approve":
        user = db.query(User).filter(User.id == req.user_id).first()
        if user:
            user.role = "professor"

    db.commit()
    db.refresh(req)

    user = db.query(User).filter(User.id == req.user_id).first()
    return UpgradeRequestOut(
        id=req.id,
        user_id=req.user_id,
        user_full_name=user.full_name if user else "Unknown",
        user_email=user.email if user else "Unknown",
        status=req.status,
        cin_path=req.cin_path,
        diploma_path=req.diploma_path,
        message=req.message,
        reviewer_notes=req.reviewer_notes,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
    )

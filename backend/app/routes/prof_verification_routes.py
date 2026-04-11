from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.prof_verification import ProfVerificationCreate, ProfVerificationOut
from app.controller.prof_verification_controller import (
    submit_verification,
    list_verifications,
    review_verification,
    cancel_verification,
)
from app.utils.security import require_role

router = APIRouter(prefix="/prof-verification", tags=["Professor Verification"])


@router.post("", response_model=ProfVerificationOut)
def submit(
    data: ProfVerificationCreate,
    actor: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return submit_verification(actor, data, db)


@router.get("", response_model=List[ProfVerificationOut])
def list_reqs(
    actor: dict = Depends(require_role("professor", "regional_admin", "super_admin")),
    db: Session = Depends(get_db),
):
    return list_verifications(actor, db)


@router.post("/{request_id}/review", response_model=ProfVerificationOut)
def review(
    request_id: str,
    action: str,
    actor: dict = Depends(require_role("regional_admin", "super_admin")),
    db: Session = Depends(get_db),
):
    return review_verification(actor, request_id, action, db)


@router.delete("/{request_id}")
def cancel(
    request_id: str,
    actor: dict = Depends(require_role("professor")),
    db: Session = Depends(get_db),
):
    return cancel_verification(actor, request_id, db)

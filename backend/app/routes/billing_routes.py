from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.controller import billing_controller
from app.database import get_db
from app.utils.security import get_current_user


router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/pro-status")
def pro_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return billing_controller.get_pro_status(current_user["sub"], db)


@router.post("/subscribe")
def subscribe_to_pro(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return billing_controller.create_pro_subscription_checkout(current_user["sub"], db)


@router.post("/subscribe/confirm")
def confirm_pro_subscription(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    session_id = payload.get("session_id") if isinstance(payload, dict) else None
    return billing_controller.confirm_pro_subscription(
        current_user["sub"], session_id or "", db,
    )

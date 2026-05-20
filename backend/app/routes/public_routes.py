from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.controller import admin_controller
from app.database import get_db

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    return admin_controller.get_public_stats(db)

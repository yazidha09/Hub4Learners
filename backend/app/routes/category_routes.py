from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.controller import category_controller
from app.database import get_db
from app.schemas.category import CategoryOut
from app.utils.security import require_role

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: str = "📚"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return category_controller.list_categories(db)


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: str, db: Session = Depends(get_db)):
    return category_controller.get_category(category_id, db)


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=CategoryOut)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return category_controller.create_category(body.name, body.description, body.icon, db)


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: str,
    body: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return category_controller.update_category(category_id, body.name, body.description, body.icon, db)


@router.delete("/{category_id}")
def delete_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return category_controller.delete_category(category_id, db)

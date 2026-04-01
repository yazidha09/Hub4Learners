from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.controller import admin_controller
from app.database import get_db
from app.schemas.course import CourseOut
from app.utils.security import require_role

router = APIRouter(prefix="/admin", tags=["admin"])


class ChangeRoleRequest(BaseModel):
    role: str


# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.get_platform_stats(db)


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.list_users(db, role=role, search=search)


@router.put("/users/{user_id}/role")
def change_role(
    user_id: str,
    body: ChangeRoleRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.change_user_role(current_user["sub"], user_id, body.role, db)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.delete_user(current_user["sub"], user_id, db)


# ── Courses ───────────────────────────────────────────────────────────────────

@router.get("/courses", response_model=List[CourseOut])
def list_all_courses(
    category_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.list_all_courses(db, category_id=category_id)


@router.patch("/courses/{course_id}/publish", response_model=CourseOut)
def toggle_publish(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.admin_toggle_publish(course_id, db)


@router.delete("/courses/{course_id}")
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return admin_controller.delete_course(course_id, db)

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.controller import admin_controller
from app.database import get_db
from app.schemas.course import CourseOut
from app.utils.security import require_min_rank, require_role

router = APIRouter(prefix="/admin", tags=["admin"])


class ChangeRoleRequest(BaseModel):
    role: str


# ── Stats (super_admin only) ───────────────────────────────────────────────────

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("super_admin")),
):
    return admin_controller.get_platform_stats(db)


# ── Users (any admin tier) ─────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return admin_controller.list_users(current_user, db, role=role, search=search)


@router.put("/users/{user_id}/role")
def change_role(
    user_id: str,
    body: ChangeRoleRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return admin_controller.change_user_role(current_user, user_id, body.role, db)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return admin_controller.delete_user(current_user, user_id, db)


# ── Courses ────────────────────────────────────────────────────────────────────
# university_admin: list + toggle publish (scoped to their professors)
# regional_admin+:  all of the above + delete

@router.get("/courses", response_model=List[CourseOut])
def list_all_courses(
    category_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return admin_controller.list_all_courses(current_user, db, category_id=category_id)


@router.patch("/courses/{course_id}/publish", response_model=CourseOut)
def toggle_publish(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return admin_controller.admin_toggle_publish(course_id, db)


@router.delete("/courses/{course_id}")
def delete_course(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("regional_admin")),
):
    return admin_controller.delete_course(course_id, db)

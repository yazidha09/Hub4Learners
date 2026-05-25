from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.controller import org_controller
from app.database import get_db
from app.schemas.org import (
    AssignUserUniversity,
    CreateAdminRequest,
    JoinRequestCreate,
    JoinRequestOut,
    ReviewJoinRequest,
    UniversityCreate,
    UniversityOut,
)
from app.utils.security import require_min_rank, require_role, get_current_user

router = APIRouter(prefix="/org", tags=["Organization"])


# ── Universities (super_admin) ─────────────────────────────────────────────────

@router.get("/universities", response_model=List[UniversityOut])
def list_universities(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),  # any authenticated user
):
    return org_controller.list_universities(current_user, db)


@router.post("/universities", response_model=UniversityOut)
def create_university(
    data: UniversityCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("super_admin")),
):
    return org_controller.create_university(current_user, data, db)


@router.delete("/universities/{university_id}")
def delete_university(
    university_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("super_admin")),
):
    return org_controller.delete_university(current_user, university_id, db)


# ── Admin creation (super_admin) ──────────────────────────────────────────────

@router.post("/admins/university")
def create_university_admin(
    data: CreateAdminRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("super_admin")),
):
    return org_controller.create_university_admin(current_user, data, db)


# ── Professor creation (university_admin) ─────────────────────────────────────

@router.post("/professors")
def create_professor(
    data: CreateAdminRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return org_controller.create_professor(current_user, data, db)


# ── Professor assignment ───────────────────────────────────────────────────────

@router.post("/universities/{university_id}/professors/{professor_id}")
def assign_professor(
    university_id: str,
    professor_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_min_rank("university_admin")),
):
    return org_controller.assign_professor_to_university(current_user, professor_id, university_id, db)


# ── User-to-university reassignment (super_admin) ─────────────────────────────

@router.put("/users/{user_id}/university")
def assign_user_university(
    user_id: str,
    data: AssignUserUniversity,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("super_admin")),
):
    return org_controller.assign_user_university(current_user, user_id, data, db)


# ── University join requests ──────────────────────────────────────────────────

@router.post("/join-requests", response_model=JoinRequestOut)
def submit_join_request(
    data: JoinRequestCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return org_controller.submit_join_request(current_user, data, db)


@router.get("/join-requests", response_model=List[JoinRequestOut])
def list_join_requests(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return org_controller.list_join_requests(current_user, db)


@router.put("/join-requests/{request_id}/review", response_model=JoinRequestOut)
def review_join_request(
    request_id: str,
    data: ReviewJoinRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("university_admin")),
):
    return org_controller.review_join_request(current_user, request_id, data.action, db)


@router.delete("/join-requests/{request_id}")
def cancel_join_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return org_controller.cancel_join_request(current_user, request_id, db)

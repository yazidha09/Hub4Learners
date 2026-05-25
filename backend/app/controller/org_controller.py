from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.university import University
from app.models.university_join_request import UniversityJoinRequest
from app.models.user import User
from app.schemas.org import (
    AssignUserUniversity,
    CreateAdminRequest,
    JoinRequestCreate,
    JoinRequestOut,
    UniversityCreate,
    UniversityOut,
)
from app.utils.security import hash_password, ROLE_RANK


# ── Helpers ────────────────────────────────────────────────────────────────────

def _university_out(uni: University) -> UniversityOut:
    return UniversityOut(
        id=str(uni.id),
        name=uni.name,
        created_by=str(uni.created_by) if uni.created_by else None,
        created_at=uni.created_at,
    )


# ── Universities ───────────────────────────────────────────────────────────────

def list_universities(actor: dict, db: Session) -> List[UniversityOut]:
    unis = db.query(University).order_by(University.name).all()
    return [_university_out(u) for u in unis]


def create_university(actor: dict, data: UniversityCreate, db: Session) -> UniversityOut:
    uni = University(name=data.name, created_by=UUID(actor["sub"]))
    db.add(uni)
    db.commit()
    db.refresh(uni)
    return _university_out(uni)


def delete_university(actor: dict, university_id: str, db: Session) -> dict:
    uni = db.query(University).filter(University.id == UUID(university_id)).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    # Unlink all users from this university before deleting
    db.query(User).filter(User.university_id == uni.id).update({"university_id": None})
    db.delete(uni)
    db.commit()
    return {"detail": "University deleted"}


# ── Admin creation ────────────────────────────────────────────────────────────

def create_university_admin(actor: dict, data: CreateAdminRequest, db: Session) -> dict:
    """super_admin creates a university_admin and assigns them a university."""
    if not data.university_id:
        raise HTTPException(status_code=400, detail="university_id is required")

    uni = db.query(University).filter(University.id == UUID(data.university_id)).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role="university_admin",
        university_id=UUID(data.university_id),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "full_name": user.full_name, "email": user.email, "role": user.role}


def create_professor(actor: dict, data: CreateAdminRequest, db: Session) -> dict:
    """Creates a professor account. university_admin auto-assigns to their own university."""
    # university_admin: always use their own university from JWT
    if actor["role"] == "university_admin":
        university_id = actor.get("university_id")
        if not university_id:
            raise HTTPException(status_code=403, detail="You are not assigned to a university")
    else:
        university_id = data.university_id
        if not university_id:
            raise HTTPException(status_code=400, detail="university_id is required")

    uni = db.query(University).filter(University.id == UUID(university_id)).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
        role="professor",
        is_verified=True,
        university_id=UUID(university_id),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "full_name": user.full_name, "email": user.email, "role": user.role}


def assign_user_university(actor: dict, user_id: str, data: AssignUserUniversity, db: Session) -> dict:
    """super_admin assigns/reassigns any non-super_admin user to a university (or clears it)."""
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Can't manage peers or higher — protects super_admins from being reassigned
    actor_rank = ROLE_RANK.get(actor["role"], -1)
    if ROLE_RANK.get(user.role, -1) >= actor_rank:
        raise HTTPException(status_code=403, detail="Cannot modify a user with equal or higher rank")

    new_uni_id: Optional[UUID] = None
    if data.university_id:
        uni = db.query(University).filter(University.id == UUID(data.university_id)).first()
        if not uni:
            raise HTTPException(status_code=404, detail="University not found")
        new_uni_id = uni.id
    elif user.role == "university_admin":
        # A university_admin without a university would be unable to manage anyone
        raise HTTPException(status_code=400, detail="university_id is required for a university_admin")

    user.university_id = new_uni_id
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "university_id": str(user.university_id) if user.university_id else None,
    }


def assign_professor_to_university(actor: dict, professor_id: str, university_id: str, db: Session) -> dict:
    """university_admin assigns an independent professor to their university."""
    prof = db.query(User).filter(User.id == UUID(professor_id)).first()
    if not prof:
        raise HTTPException(status_code=404, detail="User not found")
    if prof.role != "professor":
        raise HTTPException(status_code=400, detail="User is not a professor")

    uni = db.query(University).filter(University.id == UUID(university_id)).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    # university_admin can only act on their own university
    if actor["role"] == "university_admin":
        if actor.get("university_id") != university_id:
            raise HTTPException(status_code=403, detail="University is not yours")

    prof.university_id = UUID(university_id)
    db.commit()
    db.refresh(prof)
    return {"id": str(prof.id), "full_name": prof.full_name, "university_id": university_id}


# ── University join requests ───────────────────────────────────────────────────

def _join_request_out(req: UniversityJoinRequest, db: Session) -> JoinRequestOut:
    prof = db.query(User).filter(User.id == req.professor_id).first()
    uni = db.query(University).filter(University.id == req.university_id).first()
    return JoinRequestOut(
        id=str(req.id),
        professor_id=str(req.professor_id),
        professor_name=prof.full_name if prof else None,
        university_id=str(req.university_id),
        university_name=uni.name if uni else None,
        status=req.status,
        note=req.note,
        reviewed_by=str(req.reviewed_by) if req.reviewed_by else None,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )


def submit_join_request(actor: dict, data: JoinRequestCreate, db: Session) -> JoinRequestOut:
    """Professor submits a request to join a university."""
    uni = db.query(University).filter(University.id == UUID(data.university_id)).first()
    if not uni:
        raise HTTPException(status_code=404, detail="University not found")

    # Block duplicate pending requests for the same university
    existing = db.query(UniversityJoinRequest).filter(
        UniversityJoinRequest.professor_id == UUID(actor["sub"]),
        UniversityJoinRequest.university_id == UUID(data.university_id),
        UniversityJoinRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending request for this university",
        )

    req = UniversityJoinRequest(
        professor_id=UUID(actor["sub"]),
        university_id=UUID(data.university_id),
        status="pending",
        note=data.note,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _join_request_out(req, db)


def list_join_requests(actor: dict, db: Session) -> List[JoinRequestOut]:
    """Professor sees their own requests; university_admin sees pending requests for their university."""
    if actor["role"] == "professor":
        reqs = (
            db.query(UniversityJoinRequest)
            .filter(UniversityJoinRequest.professor_id == UUID(actor["sub"]))
            .order_by(UniversityJoinRequest.created_at.desc())
            .all()
        )
    elif actor["role"] == "university_admin":
        uni_id = actor.get("university_id")
        if not uni_id:
            return []
        reqs = (
            db.query(UniversityJoinRequest)
            .filter(
                UniversityJoinRequest.university_id == UUID(uni_id),
                UniversityJoinRequest.status == "pending",
            )
            .order_by(UniversityJoinRequest.created_at.asc())
            .all()
        )
    else:
        raise HTTPException(status_code=403, detail="Not allowed")
    return [_join_request_out(r, db) for r in reqs]


def review_join_request(actor: dict, request_id: str, action: str, db: Session) -> JoinRequestOut:
    """university_admin approves or rejects a professor join request."""
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    req = db.query(UniversityJoinRequest).filter(
        UniversityJoinRequest.id == UUID(request_id)
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if str(req.university_id) != actor.get("university_id"):
        raise HTTPException(status_code=403, detail="This request is not for your university")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    req.status = "approved" if action == "approve" else "rejected"
    req.reviewed_by = UUID(actor["sub"])
    req.reviewed_at = datetime.now(timezone.utc)

    if action == "approve":
        prof = db.query(User).filter(User.id == req.professor_id).first()
        if prof:
            prof.university_id = req.university_id
            prof.is_verified = True

        # Auto-reject any other pending requests from the same professor
        db.query(UniversityJoinRequest).filter(
            UniversityJoinRequest.professor_id == req.professor_id,
            UniversityJoinRequest.id != req.id,
            UniversityJoinRequest.status == "pending",
        ).update({"status": "rejected"})

    db.commit()
    db.refresh(req)
    return _join_request_out(req, db)


def cancel_join_request(actor: dict, request_id: str, db: Session) -> dict:
    """Professor cancels their own pending request."""
    req = db.query(UniversityJoinRequest).filter(
        UniversityJoinRequest.id == UUID(request_id)
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if str(req.professor_id) != actor["sub"]:
        raise HTTPException(status_code=403, detail="Not your request")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    db.delete(req)
    db.commit()
    return {"detail": "Request cancelled"}

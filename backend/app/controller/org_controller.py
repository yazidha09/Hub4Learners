from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.region import Region
from app.models.university import University
from app.models.university_join_request import UniversityJoinRequest
from app.models.user import User
from app.schemas.org import (
    CreateAdminRequest,
    JoinRequestCreate,
    JoinRequestOut,
    RegionCreate,
    RegionOut,
    UniversityCreate,
    UniversityOut,
)
from app.utils.security import hash_password, ROLE_RANK


# ── Helpers ────────────────────────────────────────────────────────────────────

def _region_out(region: Region, db: Session) -> RegionOut:
    count = db.query(University).filter(University.region_id == region.id).count()
    return RegionOut(
        id=str(region.id),
        name=region.name,
        code=region.code,
        created_by=str(region.created_by) if region.created_by else None,
        created_at=region.created_at,
        university_count=count,
    )


def _university_out(uni: University, db: Session) -> UniversityOut:
    region = db.query(Region).filter(Region.id == uni.region_id).first()
    return UniversityOut(
        id=str(uni.id),
        name=uni.name,
        region_id=str(uni.region_id),
        region_name=region.name if region else None,
        created_by=str(uni.created_by) if uni.created_by else None,
        created_at=uni.created_at,
    )


# ── Regions ────────────────────────────────────────────────────────────────────

def list_regions(db: Session) -> List[RegionOut]:
    regions = db.query(Region).order_by(Region.name).all()
    return [_region_out(r, db) for r in regions]


def create_region(actor: dict, data: RegionCreate, db: Session) -> RegionOut:
    if data.code:
        existing = db.query(Region).filter(Region.code == data.code).first()
        if existing:
            raise HTTPException(status_code=409, detail="Region code already exists")

    region = Region(name=data.name, code=data.code, created_by=UUID(actor["sub"]))
    db.add(region)
    db.commit()
    db.refresh(region)
    return _region_out(region, db)


def delete_region(actor: dict, region_id: str, db: Session) -> dict:
    region = db.query(Region).filter(Region.id == UUID(region_id)).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    # RESTRICT: check for universities first
    uni_count = db.query(University).filter(University.region_id == region.id).count()
    if uni_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete region with {uni_count} university(ies). Remove them first.",
        )
    db.delete(region)
    db.commit()
    return {"detail": "Region deleted"}


# ── Universities ───────────────────────────────────────────────────────────────

def list_universities(actor: dict, db: Session, region_id: str | None = None) -> List[UniversityOut]:
    query = db.query(University)

    if region_id:
        query = query.filter(University.region_id == UUID(region_id))

    unis = query.order_by(University.name).all()
    return [_university_out(u, db) for u in unis]


def create_university(actor: dict, data: UniversityCreate, db: Session) -> UniversityOut:
    region = db.query(Region).filter(Region.id == UUID(data.region_id)).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    uni = University(name=data.name, region_id=UUID(data.region_id), created_by=UUID(actor["sub"]))
    db.add(uni)
    db.commit()
    db.refresh(uni)
    return _university_out(uni, db)


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
        region_id=uni.region_id,
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
        region_id=uni.region_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": str(user.id), "full_name": user.full_name, "email": user.email, "role": user.role}


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
    prof.region_id = uni.region_id
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
            uni = db.query(University).filter(University.id == req.university_id).first()
            prof.region_id = uni.region_id if uni else None
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

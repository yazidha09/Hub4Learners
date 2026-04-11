from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.professor_verification import ProfessorVerificationRequest
from app.models.region import Region
from app.models.user import User
from app.schemas.prof_verification import ProfVerificationCreate, ProfVerificationOut


def _out(req: ProfessorVerificationRequest, db: Session) -> ProfVerificationOut:
    prof = db.query(User).filter(User.id == req.professor_id).first()
    region = db.query(Region).filter(Region.id == req.region_id).first()
    return ProfVerificationOut(
        id=str(req.id),
        professor_id=str(req.professor_id),
        professor_name=prof.full_name if prof else None,
        region_id=str(req.region_id),
        region_name=region.name if region else None,
        birth_date=req.birth_date,
        first_name=req.first_name,
        father_name=req.father_name,
        grandfather_name=req.grandfather_name,
        status=req.status,
        note=req.note,
        reviewed_by=str(req.reviewed_by) if req.reviewed_by else None,
        reviewed_at=req.reviewed_at,
        created_at=req.created_at,
    )


def submit_verification(actor: dict, data: ProfVerificationCreate, db: Session) -> ProfVerificationOut:
    region = db.query(Region).filter(Region.id == UUID(data.region_id)).first()
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")

    # Block duplicate pending requests
    existing = db.query(ProfessorVerificationRequest).filter(
        ProfessorVerificationRequest.professor_id == UUID(actor["sub"]),
        ProfessorVerificationRequest.status == "pending",
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You already have a pending verification request")

    req = ProfessorVerificationRequest(
        professor_id=UUID(actor["sub"]),
        region_id=UUID(data.region_id),
        birth_date=data.birth_date,
        first_name=data.first_name,
        father_name=data.father_name,
        grandfather_name=data.grandfather_name,
        note=data.note,
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return _out(req, db)


def list_verifications(actor: dict, db: Session) -> List[ProfVerificationOut]:
    if actor["role"] == "professor":
        reqs = (
            db.query(ProfessorVerificationRequest)
            .filter(ProfessorVerificationRequest.professor_id == UUID(actor["sub"]))
            .order_by(ProfessorVerificationRequest.created_at.desc())
            .all()
        )
    elif actor["role"] in ("regional_admin", "super_admin"):
        query = db.query(ProfessorVerificationRequest)
        if actor["role"] == "regional_admin":
            region_id = actor.get("region_id")
            if not region_id:
                return []
            query = query.filter(
                ProfessorVerificationRequest.region_id == UUID(region_id),
                ProfessorVerificationRequest.status == "pending",
            )
        reqs = query.order_by(ProfessorVerificationRequest.created_at.asc()).all()
    else:
        raise HTTPException(status_code=403, detail="Not allowed")
    return [_out(r, db) for r in reqs]


def review_verification(actor: dict, request_id: str, action: str, db: Session) -> ProfVerificationOut:
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    req = db.query(ProfessorVerificationRequest).filter(
        ProfessorVerificationRequest.id == UUID(request_id)
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if actor["role"] == "regional_admin":
        if str(req.region_id) != actor.get("region_id"):
            raise HTTPException(status_code=403, detail="This request is not in your region")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already reviewed")

    req.status = "approved" if action == "approve" else "rejected"
    req.reviewed_by = UUID(actor["sub"])
    req.reviewed_at = datetime.now(timezone.utc)

    if action == "approve":
        prof = db.query(User).filter(User.id == req.professor_id).first()
        if prof:
            prof.is_verified = True
            prof.region_id = req.region_id

    db.commit()
    db.refresh(req)
    return _out(req, db)


def cancel_verification(actor: dict, request_id: str, db: Session) -> dict:
    req = db.query(ProfessorVerificationRequest).filter(
        ProfessorVerificationRequest.id == UUID(request_id)
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

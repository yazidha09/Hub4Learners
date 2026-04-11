from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.region import Region
from app.models.university import University
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut, UpdateProfileRequest
from app.utils.security import hash_password, verify_password, create_access_token


def _build_user_out(user: User, db: Session) -> UserOut:
    university_name = None
    region_name = None
    if user.university_id:
        uni = db.query(University).filter(University.id == user.university_id).first()
        university_name = uni.name if uni else None
    if user.region_id:
        region = db.query(Region).filter(Region.id == user.region_id).first()
        region_name = region.name if region else None
    return UserOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_verified=user.is_verified,
        bio=user.bio,
        profile_image=user.profile_image,
        university_id=str(user.university_id) if user.university_id else None,
        region_id=str(user.region_id) if user.region_id else None,
        university_name=university_name,
        region_name=region_name,
    )


def _build_token(user: User) -> str:
    return create_access_token({
        "sub":           str(user.id),
        "role":          user.role,
        "is_verified":   user.is_verified,
        "university_id": str(user.university_id) if user.university_id else None,
        "region_id":     str(user.region_id)     if user.region_id     else None,
    })


def register_user(data: RegisterRequest, db: Session) -> TokenResponse:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    role = data.role if data.role in ("student", "professor") else "student"
    user = User(
        full_name=f"{data.first_name} {data.last_name}",
        email=data.email,
        password_hash=hash_password(data.password),
        role=role,
        is_verified=(role == "student"),  # professors must get verified first
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(access_token=_build_token(user))


def login_user(data: LoginRequest, db: Session) -> TokenResponse:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    return TokenResponse(access_token=_build_token(user))


def get_user_by_id(user_id: str, db: Session) -> UserOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _build_user_out(user, db)


def update_user_profile(user_id: str, data: UpdateProfileRequest, db: Session) -> UserOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.new_password:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Current password is required to set a new password")
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = hash_password(data.new_password)

    if data.email and data.email != user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = data.email

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.bio is not None:
        user.bio = data.bio

    # University self-assignment — professors must use the join-request flow
    if data.university_id is not None:
        if user.role == "professor":
            raise HTTPException(
                status_code=400,
                detail="Professors must request university affiliation via the join-request flow",
            )
        if data.university_id == "" or data.university_id.lower() == "null":
            user.university_id = None
            user.region_id = None
        else:
            from uuid import UUID as _UUID
            uni = db.query(University).filter(University.id == _UUID(data.university_id)).first()
            if not uni:
                raise HTTPException(status_code=404, detail="University not found")
            user.university_id = uni.id
            user.region_id = uni.region_id

    db.commit()
    db.refresh(user)
    return _build_user_out(user, db)

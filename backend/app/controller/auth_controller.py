from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut, UpdateProfileRequest
from app.utils.security import hash_password, verify_password, create_access_token


def register_user(data: RegisterRequest, db: Session) -> TokenResponse:
    # Check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        full_name=f"{data.first_name} {data.last_name}",
        email=data.email,
        password_hash=hash_password(data.password),
        role="student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


def login_user(data: LoginRequest, db: Session) -> TokenResponse:
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


def get_user_by_id(user_id: str, db: Session) -> UserOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        bio=user.bio,
        profile_image=user.profile_image,
    )


def update_user_profile(user_id: str, data: UpdateProfileRequest, db: Session) -> UserOut:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # If changing password, verify current password
    if data.new_password:
        if not data.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is required to set a new password",
            )
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )
        user.password_hash = hash_password(data.new_password)

    # If changing email, check uniqueness
    if data.email and data.email != user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )
        user.email = data.email

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.bio is not None:
        user.bio = data.bio

    db.commit()
    db.refresh(user)

    return UserOut(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        bio=user.bio,
        profile_image=user.profile_image,
    )

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut, UpdateProfileRequest
from app.controller.auth_controller import register_user, login_user, get_user_by_id, update_user_profile
from app.utils.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    return register_user(data, db)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return login_user(data, db)


@router.get("/me", response_model=UserOut)
def me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_user_by_id(current_user["sub"], db)


@router.put("/profile", response_model=UserOut)
def update_profile(
    data: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_user_profile(current_user["sub"], data, db)

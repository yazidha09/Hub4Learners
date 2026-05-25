from typing import Optional

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: str = "student"   # "student" or "professor"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_verified: bool = True
    bio: Optional[str] = None
    speciality: Optional[str] = None
    profile_image: Optional[str] = None
    university_id: Optional[str] = None
    university_name: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    speciality: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None
    university_id: Optional[str] = None   # set to "" or "null" to unlink

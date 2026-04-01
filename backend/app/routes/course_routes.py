from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.controller import course_controller
from app.database import get_db
from app.schemas.course import CourseOut, CourseStudentsOut, EnrollmentOut, MaterialOut, SectionCreate, SectionOut
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/courses", tags=["courses"])


# ── Professor routes ──────────────────────────────────────────────────────────

@router.post("", response_model=CourseOut)
async def create_course(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    is_free: bool = Form(True),
    category_id: Optional[str] = Form(None),
    thumbnail: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.create_course(
        professor_id=current_user["sub"],
        title=title,
        description=description,
        is_free=is_free,
        category_id=category_id,
        thumbnail_file=thumbnail,
        db=db,
    )


@router.get("/my", response_model=List[CourseOut])
def get_my_courses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.get_my_courses(current_user["sub"], db)


@router.post("/{course_id}/sections", response_model=SectionOut)
def add_section(
    course_id: str,
    data: SectionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.add_section(current_user["sub"], course_id, data, db)


@router.post("/{course_id}/sections/{section_id}/materials", response_model=MaterialOut)
async def upload_material(
    course_id: str,
    section_id: str,
    title: str = Form(...),
    mat_type: str = Form(...),
    order_index: int = Form(0),
    content_text: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.upload_material(
        professor_id=current_user["sub"],
        course_id=course_id,
        section_id=section_id,
        title=title,
        mat_type=mat_type,
        order_index=order_index,
        content_text=content_text,
        file=file,
        db=db,
    )


@router.get("/my/students", response_model=List[CourseStudentsOut])
def get_my_students(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.get_my_students(current_user["sub"], db)


@router.patch("/{course_id}/publish", response_model=CourseOut)
def toggle_publish(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("professor")),
):
    return course_controller.toggle_publish(current_user["sub"], course_id, db)


# ── Student / public routes ───────────────────────────────────────────────────
# NOTE: specific paths (/enrolled) must come before the /{course_id} wildcard.

@router.get("/enrolled", response_model=List[CourseOut])
def get_enrolled_courses(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.get_enrolled_courses(current_user["sub"], db)


@router.get("", response_model=List[CourseOut])
def list_courses(category_id: Optional[str] = None, db: Session = Depends(get_db)):
    return course_controller.list_published_courses(db, category_id=category_id)


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: str, db: Session = Depends(get_db)):
    return course_controller.get_course_detail(course_id, db)


@router.post("/{course_id}/enroll", response_model=EnrollmentOut)
def enroll(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.enroll_student(current_user["sub"], course_id, db)


@router.delete("/{course_id}/enroll")
def unenroll(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return course_controller.unenroll_student(current_user["sub"], course_id, db)

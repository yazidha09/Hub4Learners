import os
import shutil
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.courses import Course
from app.models.course_section import CourseSection
from app.models.course_material import CourseMaterial
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.course import (
    CourseOut, SectionOut, SectionCreate, MaterialOut, EnrollmentOut,
    StudentOut, CourseStudentsOut,
)

THUMBNAILS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "thumbnails")
MATERIALS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "materials")

THUMBNAIL_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MATERIAL_EXTS = {
    "pdf":      {".pdf"},
    "video":    {".mp4", ".webm", ".mov", ".avi"},
    "audio":    {".mp3", ".wav", ".ogg", ".m4a"},
    "exercise": {".pdf", ".docx", ".zip", ".txt"},
}


def _save_file(file: UploadFile, dest_dir: str, allowed_exts: set, prefix: str) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '{ext}' not allowed. Accepted: {', '.join(sorted(allowed_exts))}",
        )
    os.makedirs(dest_dir, exist_ok=True)
    filename = f"{prefix}_{uuid4().hex}{ext}"
    with open(os.path.join(dest_dir, filename), "wb") as f:
        shutil.copyfileobj(file.file, f)
    return filename


def _build_section_out(section: CourseSection, db: Session) -> SectionOut:
    materials_raw = (
        db.query(CourseMaterial)
        .filter(CourseMaterial.section_id == section.id)
        .order_by(CourseMaterial.order_index)
        .all()
    )
    materials = [
        MaterialOut(
            id=m.id,
            section_id=m.section_id,
            title=m.title,
            type=m.type,
            file_url=m.file_url,
            content_text=m.content_text,
            order_index=m.order_index,
            created_at=m.created_at,
        )
        for m in materials_raw
    ]
    return SectionOut(
        id=section.id,
        course_id=section.course_id,
        title=section.title,
        order_index=section.order_index,
        created_at=section.created_at,
        materials=materials,
    )


def _build_course_out(course: Course, db: Session) -> CourseOut:
    professor = db.query(User).filter(User.id == course.professor_id).first()
    category = None
    if course.category_id:
        category = db.query(Category).filter(Category.id == course.category_id).first()
    sections_raw = (
        db.query(CourseSection)
        .filter(CourseSection.course_id == course.id)
        .order_by(CourseSection.order_index)
        .all()
    )
    sections = [_build_section_out(s, db) for s in sections_raw]
    enrolled_count = db.query(Enrollment).filter(Enrollment.course_id == course.id).count()
    return CourseOut(
        id=course.id,
        title=course.title,
        description=course.description,
        thumbnail=course.thumbnail,
        is_free=course.is_free,
        professor_id=course.professor_id,
        professor_name=professor.full_name if professor else "Unknown",
        category_id=course.category_id,
        category_name=category.name if category else None,
        is_published=course.is_published,
        created_at=course.created_at,
        updated_at=course.updated_at,
        sections=sections,
        enrolled_count=enrolled_count,
    )


def create_course(
    professor_id: str,
    title: str,
    description: Optional[str],
    is_free: bool,
    category_id: Optional[str],
    thumbnail_file: Optional[UploadFile],
    db: Session,
) -> CourseOut:
    thumbnail_path: Optional[str] = None
    if thumbnail_file and thumbnail_file.filename:
        filename = _save_file(thumbnail_file, THUMBNAILS_DIR, THUMBNAIL_EXTS, professor_id)
        thumbnail_path = f"thumbnails/{filename}"

    if category_id:
        cat = db.query(Category).filter(Category.id == UUID(category_id)).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category")

    course = Course(
        title=title,
        description=description,
        is_free=is_free,
        is_subscription=False,
        professor_id=UUID(professor_id),
        category_id=UUID(category_id) if category_id else None,
        is_published=False,
        thumbnail=thumbnail_path,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _build_course_out(course, db)


def get_my_courses(professor_id: str, db: Session) -> List[CourseOut]:
    courses = (
        db.query(Course)
        .filter(Course.professor_id == UUID(professor_id))
        .order_by(Course.created_at.desc())
        .all()
    )
    return [_build_course_out(c, db) for c in courses]


def add_section(
    professor_id: str,
    course_id: str,
    data: SectionCreate,
    db: Session,
) -> SectionOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    section = CourseSection(
        course_id=UUID(course_id),
        title=data.title,
        order_index=data.order_index,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return _build_section_out(section, db)


def upload_material(
    professor_id: str,
    course_id: str,
    section_id: str,
    title: str,
    mat_type: str,
    order_index: int,
    content_text: Optional[str],
    file: UploadFile,
    db: Session,
) -> MaterialOut:
    if mat_type not in MATERIAL_EXTS:
        raise HTTPException(status_code=400, detail=f"Invalid type '{mat_type}'")

    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    section = db.query(CourseSection).filter(CourseSection.id == UUID(section_id)).first()
    if not section or str(section.course_id) != course_id:
        raise HTTPException(status_code=404, detail="Section not found")

    filename = _save_file(file, MATERIALS_DIR, MATERIAL_EXTS[mat_type], f"{section_id}_{mat_type}")
    file_url = f"materials/{filename}"

    material = CourseMaterial(
        section_id=UUID(section_id),
        title=title,
        type=mat_type,
        file_url=file_url,
        content_text=content_text,
        order_index=order_index,
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    return MaterialOut(
        id=material.id,
        section_id=material.section_id,
        title=material.title,
        type=material.type,
        file_url=material.file_url,
        content_text=material.content_text,
        order_index=material.order_index,
        created_at=material.created_at,
    )


def delete_course(professor_id: str, course_id: str, db: Session) -> dict:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    cid = str(course.id)

    # 1. course_materials (FK → course_sections, no CASCADE on the ORM model)
    sections = db.query(CourseSection).filter(CourseSection.course_id == UUID(cid)).all()
    for section in sections:
        db.query(CourseMaterial).filter(CourseMaterial.section_id == section.id).delete()

    # 3. course_sections (FK → courses, no CASCADE on the ORM model)
    db.query(CourseSection).filter(CourseSection.course_id == UUID(cid)).delete()

    # 4. enrollments (FK → courses, no CASCADE on the ORM model)
    db.query(Enrollment).filter(Enrollment.course_id == UUID(cid)).delete()

    # 5. finally the course itself
    db.delete(course)
    db.commit()
    return {"detail": "Course deleted successfully"}


def toggle_publish(professor_id: str, course_id: str, db: Session) -> CourseOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if str(course.professor_id) != professor_id:
        raise HTTPException(status_code=403, detail="Not your course")

    # Block publishing for unverified professors
    if not course.is_published:
        prof = db.query(User).filter(User.id == UUID(professor_id)).first()
        if prof and not prof.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Your account must be verified before you can publish courses. Submit a verification request to your region admin.",
            )

    course.is_published = not course.is_published
    db.commit()
    db.refresh(course)
    return _build_course_out(course, db)


def list_published_courses(db: Session, category_id: Optional[str] = None) -> List[CourseOut]:
    query = db.query(Course).filter(
        Course.is_published == True, Course.is_free == True  # noqa: E712
    )
    if category_id:
        query = query.filter(Course.category_id == UUID(category_id))
    courses = query.order_by(Course.created_at.desc()).all()
    return [_build_course_out(c, db) for c in courses]


def get_course_detail(course_id: str, db: Session) -> CourseOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return _build_course_out(course, db)


def enroll_student(student_id: str, course_id: str, db: Session) -> EnrollmentOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.is_published:
        raise HTTPException(status_code=400, detail="Course is not published")
    if not course.is_free:
        raise HTTPException(status_code=400, detail="Paid courses are not available yet")
    if str(course.professor_id) == student_id:
        raise HTTPException(status_code=400, detail="You cannot enroll in your own course")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id), Enrollment.course_id == UUID(course_id))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled")

    enrollment = Enrollment(
        student_id=UUID(student_id),
        course_id=UUID(course_id),
        status="active",
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return EnrollmentOut(
        id=enrollment.id,
        student_id=enrollment.student_id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        enrolled_at=enrollment.enrolled_at,
    )


def get_my_students(professor_id: str, db: Session) -> List[CourseStudentsOut]:
    courses = (
        db.query(Course)
        .filter(Course.professor_id == UUID(professor_id))
        .order_by(Course.created_at.desc())
        .all()
    )
    result = []
    for course in courses:
        enrollments = (
            db.query(Enrollment)
            .filter(Enrollment.course_id == course.id)
            .order_by(Enrollment.enrolled_at.desc())
            .all()
        )
        students = []
        for e in enrollments:
            user = db.query(User).filter(User.id == e.student_id).first()
            if user:
                students.append(StudentOut(
                    id=user.id,
                    full_name=user.full_name,
                    email=user.email,
                    enrolled_at=e.enrolled_at,
                    status=e.status,
                ))
        result.append(CourseStudentsOut(
            course_id=course.id,
            course_title=course.title,
            is_published=course.is_published,
            students=students,
        ))
    return result


def unenroll_student(student_id: str, course_id: str, db: Session) -> dict:
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id), Enrollment.course_id == UUID(course_id))
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this course")
    db.delete(enrollment)
    db.commit()
    return {"detail": "Unenrolled successfully"}


def get_enrolled_courses(student_id: str, db: Session) -> List[CourseOut]:
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id))
        .all()
    )
    result = []
    for e in enrollments:
        course = db.query(Course).filter(Course.id == e.course_id).first()
        if course:
            result.append(_build_course_out(course, db))
    return result

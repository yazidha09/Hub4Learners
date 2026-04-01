from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.courses import Course
from app.models.course_section import CourseSection
from app.models.course_material import CourseMaterial
from app.models.enrollment import Enrollment
from app.models.category import Category
from app.schemas.course import CourseOut
from app.controller.course_controller import _build_course_out

VALID_ROLES = {"student", "professor", "admin"}


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_platform_stats(db: Session) -> dict:
    total_users = db.query(User).count()
    total_students = db.query(User).filter(User.role == "student").count()
    total_professors = db.query(User).filter(User.role == "professor").count()
    total_admins = db.query(User).filter(User.role == "admin").count()
    total_courses = db.query(Course).count()
    published_courses = db.query(Course).filter(Course.is_published == True).count()  # noqa: E712
    total_enrollments = db.query(Enrollment).count()
    return {
        "total_users": total_users,
        "total_students": total_students,
        "total_professors": total_professors,
        "total_admins": total_admins,
        "total_courses": total_courses,
        "published_courses": published_courses,
        "total_enrollments": total_enrollments,
    }


# ── Users ─────────────────────────────────────────────────────────────────────

def list_users(
    db: Session,
    role: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    query = db.query(User)
    if role and role in VALID_ROLES:
        query = query.filter(User.role == role)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(pattern)) | (User.email.ilike(pattern))
        )
    users = query.order_by(User.created_at.desc()).all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


def change_user_role(
    admin_id: str,
    user_id: str,
    new_role: str,
    db: Session,
) -> dict:
    if new_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{new_role}'")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == admin_id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user.role = new_role
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def delete_user(admin_id: str, user_id: str, db: Session) -> dict:
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == admin_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


# ── Courses ───────────────────────────────────────────────────────────────────

def list_all_courses(
    db: Session,
    category_id: Optional[str] = None,
) -> List[CourseOut]:
    query = db.query(Course)
    if category_id:
        query = query.filter(Course.category_id == UUID(category_id))
    courses = query.order_by(Course.created_at.desc()).all()
    return [_build_course_out(c, db) for c in courses]


def admin_toggle_publish(course_id: str, db: Session) -> CourseOut:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.is_published = not course.is_published
    db.commit()
    db.refresh(course)
    return _build_course_out(course, db)


def delete_course(course_id: str, db: Session) -> dict:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # delete materials, sections, enrollments first
    sections = db.query(CourseSection).filter(CourseSection.course_id == course.id).all()
    for s in sections:
        db.query(CourseMaterial).filter(CourseMaterial.section_id == s.id).delete()
    db.query(CourseSection).filter(CourseSection.course_id == course.id).delete()
    db.query(Enrollment).filter(Enrollment.course_id == course.id).delete()
    db.delete(course)
    db.commit()
    return {"detail": "Course deleted"}

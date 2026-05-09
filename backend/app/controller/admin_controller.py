from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.courses import Course
from app.models.course_section import CourseSection
from app.models.course_subsection import CourseSubsection
from app.models.course_material import CourseMaterial
from app.models.course_progress import CourseProgress
from app.models.course_feedback import CourseFeedback
from app.models.lesson_block import LessonBlock
from app.models.enrollment import Enrollment
from app.models.category import Category
from app.schemas.course import CourseOut
from app.controller.course_controller import _build_course_out
from app.utils.security import VALID_ROLES, ROLE_RANK


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_platform_stats(db: Session) -> dict:
    total_users = db.query(User).count()
    total_students = db.query(User).filter(User.role == "student").count()
    total_professors = db.query(User).filter(User.role == "professor").count()
    total_university_admins = db.query(User).filter(User.role == "university_admin").count()
    total_super_admins = db.query(User).filter(User.role == "super_admin").count()
    total_courses = db.query(Course).count()
    published_courses = db.query(Course).filter(Course.is_published == True).count()  # noqa: E712
    total_enrollments = db.query(Enrollment).count()
    return {
        "total_users": total_users,
        "total_students": total_students,
        "total_professors": total_professors,
        "total_university_admins": total_university_admins,
        "total_super_admins": total_super_admins,
        # kept for frontend backward compat
        "total_admins": total_university_admins + total_super_admins,
        "total_courses": total_courses,
        "published_courses": published_courses,
        "total_enrollments": total_enrollments,
    }


# ── Users ─────────────────────────────────────────────────────────────────────

def list_users(
    actor: dict,
    db: Session,
    role: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    query = db.query(User)

    # Scope by org: university_admin only sees users from their university
    if actor["role"] == "university_admin":
        uni_id = actor.get("university_id")
        if uni_id:
            query = query.filter(User.university_id == UUID(uni_id))
        else:
            return []

    # Only show users with rank strictly below the actor (can't manage peers/superiors)
    actor_rank = ROLE_RANK.get(actor["role"], -1)
    manageable_roles = [r for r, rank in ROLE_RANK.items() if rank < actor_rank]
    query = query.filter(User.role.in_(manageable_roles))

    if role and role in VALID_ROLES:
        query = query.filter(User.role == role)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(pattern)) | (User.email.ilike(pattern))
        )

    users = query.order_by(User.created_at.desc()).all()
    return [_user_dict(u) for u in users]


def _user_dict(u: User) -> dict:
    return {
        "id": str(u.id),
        "full_name": u.full_name,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "university_id": str(u.university_id) if u.university_id else None,
        "region_id": str(u.region_id) if u.region_id else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def change_user_role(
    actor: dict,
    user_id: str,
    new_role: str,
    db: Session,
) -> dict:
    if new_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role '{new_role}'")

    actor_rank = ROLE_RANK.get(actor["role"], -1)
    target_rank = ROLE_RANK.get(new_role, -1)

    # Cannot assign a role >= own rank (prevents privilege escalation)
    if target_rank >= actor_rank:
        raise HTTPException(status_code=403, detail="Cannot assign a role equal to or above your own")

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == actor["sub"]:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # Rank of the target user must be below actor's rank
    if ROLE_RANK.get(user.role, -1) >= actor_rank:
        raise HTTPException(status_code=403, detail="Cannot modify a user with equal or higher rank")

    # Org scope enforcement
    if actor["role"] == "university_admin":
        if str(user.university_id) != actor.get("university_id"):
            raise HTTPException(status_code=403, detail="User is not in your university")

    user.role = new_role
    db.commit()
    db.refresh(user)
    return _user_dict(user)


def delete_user(actor: dict, user_id: str, db: Session) -> dict:
    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == actor["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    actor_rank = ROLE_RANK.get(actor["role"], -1)
    if ROLE_RANK.get(user.role, -1) >= actor_rank:
        raise HTTPException(status_code=403, detail="Cannot delete a user with equal or higher rank")

    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}


# ── Courses ───────────────────────────────────────────────────────────────────

def list_all_courses(
    actor: dict,
    db: Session,
    category_id: Optional[str] = None,
) -> List[CourseOut]:
    query = db.query(Course)

    # university_admin only sees courses from professors in their university
    if actor["role"] == "university_admin":
        uni_id = actor.get("university_id")
        if uni_id:
            query = query.join(User, User.id == Course.professor_id).filter(
                User.university_id == UUID(uni_id)
            )
        else:
            return []

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

    # Must delete progress first — it has FKs to subsections and materials
    db.query(CourseProgress).filter(CourseProgress.course_id == course.id).delete()

    sections = db.query(CourseSection).filter(CourseSection.course_id == course.id).all()
    for s in sections:
        db.query(CourseMaterial).filter(CourseMaterial.section_id == s.id).delete()
        db.query(LessonBlock).filter(LessonBlock.section_id == s.id, LessonBlock.subsection_id == None).delete()
        subsections = db.query(CourseSubsection).filter(CourseSubsection.section_id == s.id).all()
        for sub in subsections:
            db.query(LessonBlock).filter(LessonBlock.subsection_id == sub.id).delete()
        db.query(CourseSubsection).filter(CourseSubsection.section_id == s.id).delete()
    db.query(CourseSection).filter(CourseSection.course_id == course.id).delete()
    db.query(CourseFeedback).filter(CourseFeedback.course_id == course.id).delete()
    db.query(Enrollment).filter(Enrollment.course_id == course.id).delete()
    db.delete(course)
    db.commit()
    return {"detail": "Course deleted"}

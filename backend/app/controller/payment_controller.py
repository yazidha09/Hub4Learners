from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.controller import course_controller
from app.models.courses import Course
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.course import EnrollmentOut
from app.utils import stripe_client


FRONTEND_BASE_URL = "http://localhost:5173"


def create_checkout_session(student_id: str, course_id: str, db: Session) -> dict:
    course = db.query(Course).filter(Course.id == UUID(course_id)).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.is_published:
        raise HTTPException(status_code=400, detail="Course is not published")
    if course.is_free:
        raise HTTPException(status_code=400, detail="This course is free — enroll directly.")
    if str(course.professor_id) == student_id:
        raise HTTPException(status_code=400, detail="You cannot enroll in your own course")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.student_id == UUID(student_id), Enrollment.course_id == UUID(course_id))
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already enrolled")

    student = db.query(User).filter(User.id == UUID(student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    thumbnail_url = (
        f"http://localhost:8000/uploads/{course.thumbnail}" if course.thumbnail else None
    )
    success_url = (
        f"{FRONTEND_BASE_URL}/payment/success"
        f"?session_id={{CHECKOUT_SESSION_ID}}&course_id={course_id}"
    )
    cancel_url = f"{FRONTEND_BASE_URL}/payment/cancel?course_id={course_id}"

    try:
        session = stripe_client.create_checkout_session(
            course_id=str(course.id),
            course_title=course.title,
            course_thumbnail_url=thumbnail_url,
            price_usd=float(course.price),
            student_id=student_id,
            student_email=student.email,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stripe error: {exc}")

    return {"session_id": session.id, "url": session.url}


def confirm_session(student_id: str, session_id: str, db: Session) -> EnrollmentOut:
    """Verify a Stripe Checkout session was paid, then enroll the student."""
    try:
        session = stripe_client.retrieve_session(session_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not verify session: {exc}")

    if session.payment_status != "paid":
        raise HTTPException(
            status_code=402,
            detail=f"Payment not completed (status: {session.payment_status}).",
        )

    def _read_meta(obj, key):
        if obj is None:
            return None
        # Stripe SDK 15.x StripeObject: prefer the private _data dict, then
        # fall back to subscripting (raises KeyError) or attribute access.
        data = getattr(obj, "_data", None)
        if isinstance(data, dict) and key in data:
            return data[key]
        try:
            return obj[key]
        except (KeyError, TypeError):
            return None

    meta_student_id = _read_meta(session.metadata, "student_id")
    course_id = _read_meta(session.metadata, "course_id")
    if not meta_student_id or not course_id:
        raise HTTPException(status_code=400, detail="Session metadata missing course/student info.")
    if meta_student_id != student_id:
        raise HTTPException(status_code=403, detail="This session does not belong to you.")

    existing = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == UUID(student_id),
            Enrollment.course_id == UUID(course_id),
        )
        .first()
    )
    if existing:
        return EnrollmentOut(
            id=existing.id,
            student_id=existing.student_id,
            course_id=existing.course_id,
            status=existing.status,
            enrolled_at=existing.enrolled_at,
        )

    return course_controller.enroll_student(student_id, course_id, db, allow_paid=True)

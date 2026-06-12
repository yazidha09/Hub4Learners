from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.controller import notification_controller, payment_controller
from app.database import get_db
from app.models.courses import Course
from app.models.user import User
from app.schemas.course import EnrollmentOut
from app.utils import stripe_client
from app.utils.security import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/config")
def get_payment_config():
    """Return the publishable key so the frontend can talk to Stripe."""
    return {"publishable_key": stripe_client.get_publishable_key() or ""}


@router.post("/checkout/{course_id}")
def create_checkout(
    course_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return payment_controller.create_checkout_session(current_user["sub"], course_id, db)


@router.post("/confirm")
async def confirm_payment(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    session_id = payload.get("session_id")
    if not session_id:
        return {"detail": "session_id is required"}, 400
    enrollment = payment_controller.confirm_session(current_user["sub"], session_id, db)

    course = db.query(Course).filter(Course.id == enrollment.course_id).first()
    student = db.query(User).filter(User.id == UUID(current_user["sub"])).first()
    if course and student:
        try:
            await notification_controller.push(
                user_id=str(course.professor_id),
                type="enrollment",
                title="New Paid Enrollment",
                body=f"{student.full_name} purchased your course \"{course.title}\"",
                db=db,
                meta={"course_id": str(course.id), "student_id": current_user["sub"]},
            )
        except Exception:
            pass
        try:
            await notification_controller.push(
                user_id=current_user["sub"],
                type="enrollment_confirmed",
                title="Enrollment Successful",
                body=f"You purchased \"{course.title}\"",
                db=db,
                meta={"course_id": str(course.id)},
            )
        except Exception:
            pass
    return enrollment

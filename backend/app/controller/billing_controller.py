"""Pro-subscription billing.

We deliberately use Stripe Checkout in `payment` mode (one-off charge) rather
than `subscription` mode so the flow works without webhooks: the user pays,
Stripe redirects back with `session_id`, we verify the session, then bump
`users.pro_until` forward by 30 days. Re-subscribing while still Pro extends
from the current expiry instead of overwriting it.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.utils import stripe_client
from app.utils.pro import PRO_MONTHLY_PRICE_USD, PRO_PERIOD_DAYS, is_pro_user


FRONTEND_BASE_URL = "http://localhost:5173"


def _get_user(user_id: str, db: Session) -> User:
    try:
        uid = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid user id")
    user = db.query(User).filter(User.id == uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_pro_status(user_id: str, db: Session) -> dict:
    user = _get_user(user_id, db)
    return {
        "is_pro": is_pro_user(user),
        "pro_until": user.pro_until.isoformat() if user.pro_until else None,
        "period_days": PRO_PERIOD_DAYS,
        "price_usd": PRO_MONTHLY_PRICE_USD,
    }


def create_pro_subscription_checkout(user_id: str, db: Session) -> dict:
    user = _get_user(user_id, db)

    success_url = (
        f"{FRONTEND_BASE_URL}/payment/success"
        f"?session_id={{CHECKOUT_SESSION_ID}}&kind=pro"
    )
    cancel_url = f"{FRONTEND_BASE_URL}/payment/cancel?kind=pro"

    try:
        session = stripe_client.create_pro_subscription_session(
            user_id=str(user.id),
            user_email=user.email,
            price_usd=PRO_MONTHLY_PRICE_USD,
            period_days=PRO_PERIOD_DAYS,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Stripe error: {exc}")

    return {"session_id": session.id, "url": session.url}


def _read_meta(obj, key):
    if obj is None:
        return None
    data = getattr(obj, "_data", None)
    if isinstance(data, dict) and key in data:
        return data[key]
    try:
        return obj[key]
    except (KeyError, TypeError):
        return None


def confirm_pro_subscription(user_id: str, session_id: str, db: Session) -> dict:
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    try:
        session = stripe_client.retrieve_session(session_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not verify session: {exc}")

    if session.payment_status != "paid":
        raise HTTPException(
            status_code=402,
            detail=f"Payment not completed (status: {session.payment_status}).",
        )

    kind = _read_meta(session.metadata, "kind")
    meta_user_id = _read_meta(session.metadata, "user_id")
    period_days_raw = _read_meta(session.metadata, "period_days") or PRO_PERIOD_DAYS

    if kind != "pro_subscription":
        raise HTTPException(status_code=400, detail="This session is not a Pro subscription.")
    if not meta_user_id or meta_user_id != user_id:
        raise HTTPException(status_code=403, detail="This session does not belong to you.")

    try:
        period_days = int(period_days_raw)
    except (TypeError, ValueError):
        period_days = PRO_PERIOD_DAYS

    user = _get_user(user_id, db)
    # If still Pro, extend from current expiry. Otherwise start from now.
    base = user.pro_until if (user.pro_until and user.pro_until > datetime.utcnow()) else datetime.utcnow()
    user.pro_until = base + timedelta(days=period_days)
    db.commit()
    db.refresh(user)

    return {
        "is_pro": True,
        "pro_until": user.pro_until.isoformat(),
        "added_days": period_days,
    }

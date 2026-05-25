"""Pro-subscription helpers — single source of truth for paywall gating.

The Pro tier is implemented as a `pro_until` datetime on the User row. Each
successful Stripe payment extends it by 30 days; NULL or a past date means
the user is on the free tier.

The HTTPException raised by `require_pro` uses 402 Payment Required so the
frontend can distinguish "you're not logged in / not allowed" (401/403) from
"you need to upgrade" (402) and show the right upsell.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User


PRO_PERIOD_DAYS = 30
PRO_MONTHLY_PRICE_USD = 9.99


def is_pro_user(user: Optional[User]) -> bool:
    if user is None or user.pro_until is None:
        return False
    return user.pro_until > datetime.utcnow()


def is_pro_user_id(user_id: str | UUID, db: Session) -> bool:
    """Convenience lookup when the caller only has the JWT sub claim."""
    try:
        uid = UUID(str(user_id))
    except (ValueError, TypeError):
        return False
    user = db.query(User).filter(User.id == uid).first()
    return is_pro_user(user)


def require_pro(user_id: str | UUID, db: Session, *, feature: str = "this feature") -> None:
    """Raise 402 Payment Required if the user is not Pro."""
    if not is_pro_user_id(user_id, db):
        raise HTTPException(
            status_code=402,
            detail=f"Pro subscription required to use {feature}.",
        )

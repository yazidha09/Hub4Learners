"""
Gamification API surface.

  GET    /gamification/profile             — XP / level / streak summary for current user
  GET    /gamification/profile/{user_id}   — public-ish summary of any user
  GET    /gamification/xp/logs             — XP audit log (history)
  POST   /gamification/daily-login         — claim daily-login XP (idempotent per day)

  GET    /gamification/achievements        — full catalog with unlock status
  POST   /gamification/achievements/seen   — mark all unlocked-but-unseen as seen

  GET    /gamification/badges              — full catalog with unlock + equipped status
  POST   /gamification/badges/equip        — equip / unequip a badge

  GET    /gamification/leaderboard         — leaderboard with metric/period/pagination
"""
from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.controller.gamification import (
    achievements_service,
    badges_service,
    leaderboard_service,
    profile_service,
    xp_service,
)
from app.database import get_db
from app.schemas.gamification import (
    AchievementOut,
    BadgeOut,
    EquipBadgeIn,
    GamificationProfile,
    LeaderboardOut,
    XPGainOut,
    XPLogOut,
)
from app.utils.security import get_current_user

router = APIRouter(prefix="/gamification", tags=["Gamification"])


# ── Profile ──────────────────────────────────────────────────────────────────
@router.get("/profile", response_model=GamificationProfile)
def my_profile(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return profile_service.get_profile(current_user["sub"], db)


@router.get("/profile/{user_id}", response_model=GamificationProfile)
def user_profile(
    user_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user id")
    return profile_service.get_profile(user_id, db)


# ── XP ───────────────────────────────────────────────────────────────────────
@router.get("/xp/logs", response_model=List[XPLogOut])
def xp_logs(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return xp_service.get_xp_logs(current_user["sub"], db, limit=limit)


@router.post("/daily-login", response_model=XPGainOut)
def claim_daily_login(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Idempotent — anti-cheat (cooldown + same-source-id) ensures it can only
    be claimed once per UTC day."""
    today_id = f"login-{current_user['sub']}-{__import__('datetime').date.today().isoformat()}"
    return xp_service.award_xp(
        user_id=current_user["sub"],
        source_type="daily_login",
        source_id=today_id,
        description="Daily login bonus",
        update_streak=False,  # logging in alone does not extend a learning streak
        db=db,
    )


# ── Achievements ─────────────────────────────────────────────────────────────
@router.get("/achievements", response_model=List[AchievementOut])
def list_achievements(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return achievements_service.list_for_user(UUID(current_user["sub"]), db)


@router.post("/achievements/seen")
def mark_achievements_seen(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    n = achievements_service.mark_seen(UUID(current_user["sub"]), db)
    return {"marked": n}


# ── Badges ───────────────────────────────────────────────────────────────────
@router.get("/badges", response_model=List[BadgeOut])
def list_badges(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return badges_service.list_for_user(UUID(current_user["sub"]), db)


@router.get("/badges/{user_id}", response_model=List[BadgeOut])
def list_badges_for_user(
    user_id: str,
    db: Session = Depends(get_db),
    _: dict = Depends(get_current_user),
):
    try:
        uid = UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user id")
    return badges_service.list_for_user(uid, db)


@router.post("/badges/equip", response_model=List[BadgeOut])
def equip_badge(
    body: EquipBadgeIn,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return badges_service.equip_badge(current_user["sub"], body.badge_id, db)


# ── Leaderboard ──────────────────────────────────────────────────────────────
@router.get("/leaderboard", response_model=LeaderboardOut)
def leaderboard(
    metric: str = Query("xp", pattern="^(xp|streak|courses)$"),
    period: str = Query("all_time", pattern="^(daily|weekly|all_time)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    return leaderboard_service.get_leaderboard(
        metric=metric,
        period=period,
        db=db,
        page=page,
        page_size=page_size,
        me_user_id=current_user["sub"],
    )

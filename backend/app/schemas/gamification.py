from __future__ import annotations

from datetime import datetime, date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


# ── XP ───────────────────────────────────────────────────────────────────────
class XPLogOut(BaseModel):
    id: UUID
    amount: int
    source_type: str
    source_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class XPGainOut(BaseModel):
    """Response returned by every XP-awarding endpoint so the frontend can
    animate gain → level-up → unlock notifications in one response."""
    awarded_xp: int
    total_xp: int
    level: int
    previous_level: int
    leveled_up: bool
    level_progress_pct: float
    xp_to_next_level: int
    xp_into_level: int
    level_span: int
    new_achievements: List["AchievementOut"] = []
    new_badges: List["BadgeOut"] = []


# ── Level / Streak / Profile ────────────────────────────────────────────────
class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_activity_date: Optional[date] = None
    is_active_today: bool


class GamificationProfile(BaseModel):
    user_id: UUID
    full_name: Optional[str] = None
    profile_image: Optional[str] = None
    total_xp: int
    level: int
    level_progress_pct: float
    xp_into_level: int
    xp_to_next_level: int
    level_span: int
    streak: StreakOut
    equipped_badge: Optional["BadgeOut"] = None
    achievements_unlocked: int
    achievements_total: int
    badges_unlocked: int
    badges_total: int


# ── Achievements ─────────────────────────────────────────────────────────────
class AchievementOut(BaseModel):
    id: UUID
    code: str
    title: str
    description: str
    icon: str
    xp_reward: int
    category: str
    unlocked: bool = False
    unlocked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Badges ───────────────────────────────────────────────────────────────────
class BadgeOut(BaseModel):
    id: UUID
    code: str
    title: str
    description: str
    icon: str
    rarity: str
    unlocked: bool = False
    unlocked_at: Optional[datetime] = None
    equipped: bool = False

    class Config:
        from_attributes = True


class EquipBadgeIn(BaseModel):
    badge_id: Optional[str] = None  # None = unequip


# ── Leaderboard ──────────────────────────────────────────────────────────────
class LeaderboardEntry(BaseModel):
    rank: int
    user_id: UUID
    full_name: str
    profile_image: Optional[str] = None
    level: int
    total_xp: int
    period_xp: int
    current_streak: int
    completed_courses: int
    equipped_badge: Optional[BadgeOut] = None


class LeaderboardOut(BaseModel):
    metric: str          # "xp" | "streak" | "courses"
    period: str          # "daily" | "weekly" | "all_time"
    page: int
    page_size: int
    total: int
    entries: List[LeaderboardEntry]
    me: Optional[LeaderboardEntry] = None


# Resolve forward refs
XPGainOut.model_rebuild()
GamificationProfile.model_rebuild()

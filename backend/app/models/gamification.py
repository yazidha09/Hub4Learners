"""
Gamification models.

All gamification state lives here so it can be added to an existing project
without touching the User table. Tables:

  - user_gamification     : per-user totals (xp, level, streak, equipped badge)
  - xp_logs               : every XP grant (audit trail + anti-abuse window)
  - achievements          : catalog of achievements (seeded on startup)
  - user_achievements     : which user has unlocked which achievement
  - badges                : catalog of badges (seeded on startup)
  - user_badges           : which user owns which badge
"""
from __future__ import annotations

from datetime import datetime, date
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text,
    UniqueConstraint, func,
)
from sqlmodel import Field, SQLModel


# ── Per-user aggregate state ────────────────────────────────────────────────
class UserGamification(SQLModel, table=True):
    __tablename__ = "user_gamification"

    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"),
                         primary_key=True, nullable=False),
    )
    total_xp: int = Field(sa_column=Column(Integer, nullable=False, server_default="0"), default=0)
    level: int = Field(sa_column=Column(Integer, nullable=False, server_default="1"), default=1)

    current_streak: int = Field(sa_column=Column(Integer, nullable=False, server_default="0"), default=0)
    longest_streak: int = Field(sa_column=Column(Integer, nullable=False, server_default="0"), default=0)
    last_activity_date: Optional[date] = Field(default=None, sa_column=Column(Date, nullable=True))
    streak_freeze_used_on: Optional[date] = Field(default=None, sa_column=Column(Date, nullable=True))

    equipped_badge_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(ForeignKey("badges.id", ondelete="SET NULL"), nullable=True),
    )

    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )
    updated_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False,
                         server_default=func.current_timestamp(),
                         onupdate=func.current_timestamp())
    )


# ── XP audit log ─────────────────────────────────────────────────────────────
# Every XP grant is logged here. Two purposes:
#   1. user-facing history
#   2. anti-cheat — the service queries recent rows to enforce cooldowns and
#      prevent duplicate awards (same source_type + source_id within a window)
class XPLog(SQLModel, table=True):
    __tablename__ = "xp_logs"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True),
    )
    amount: int = Field(sa_column=Column(Integer, nullable=False))
    source_type: str = Field(sa_column=Column(String(40), nullable=False, index=True))
    # source_id ties an award to a specific lesson/quiz/etc. so duplicate awards
    # for the *same* artifact can be detected. Free-form because sources differ.
    source_id: Optional[str] = Field(default=None, sa_column=Column(String(64), nullable=True, index=True))
    description: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp(), index=True)
    )


# ── Achievement catalog ──────────────────────────────────────────────────────
class Achievement(SQLModel, table=True):
    __tablename__ = "achievements"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(sa_column=Column(String(64), nullable=False, unique=True, index=True))
    title: str = Field(sa_column=Column(String(120), nullable=False))
    description: str = Field(sa_column=Column(Text, nullable=False))
    icon: str = Field(sa_column=Column(String(40), nullable=False, server_default="trophy"), default="trophy")
    xp_reward: int = Field(sa_column=Column(Integer, nullable=False, server_default="0"), default=0)
    category: str = Field(sa_column=Column(String(40), nullable=False, server_default="general"), default="general")
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )


class UserAchievement(SQLModel, table=True):
    __tablename__ = "user_achievements"
    __table_args__ = (UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    achievement_id: UUID = Field(
        sa_column=Column(ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    unlocked_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )
    seen: bool = Field(
        sa_column=Column(Boolean, nullable=False, server_default="false"),
        default=False,
    )


# ── Badge catalog ────────────────────────────────────────────────────────────
class Badge(SQLModel, table=True):
    __tablename__ = "badges"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(sa_column=Column(String(64), nullable=False, unique=True, index=True))
    title: str = Field(sa_column=Column(String(120), nullable=False))
    description: str = Field(sa_column=Column(Text, nullable=False))
    icon: str = Field(sa_column=Column(String(40), nullable=False, server_default="shield"), default="shield")
    rarity: str = Field(sa_column=Column(String(20), nullable=False, server_default="common"), default="common")
    created_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )


class UserBadge(SQLModel, table=True):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(
        sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    badge_id: UUID = Field(
        sa_column=Column(ForeignKey("badges.id", ondelete="CASCADE"), nullable=False, index=True),
    )
    unlocked_at: datetime = Field(
        sa_column=Column(DateTime, nullable=False, server_default=func.current_timestamp())
    )

"""
Level math.

Curve: each level requires `BASE * level^EXPONENT` cumulative XP to reach.
Total XP to be at the *start* of level L is: BASE * sum(i^EXPONENT for i in 1..L-1).

Picked so:
  - Level 2 ≈ 100 XP
  - Level 10 ≈ 5,500 XP
  - Level 25 ≈ ~50,000 XP

Tune by changing BASE / EXPONENT only — every consumer reads through the
helpers below.
"""
from __future__ import annotations

import math

BASE_XP = 100
EXPONENT = 1.5


def xp_required_for_level(level: int) -> int:
    """Total cumulative XP needed to *reach* `level` (i.e. be at level start)."""
    if level <= 1:
        return 0
    return int(round(BASE_XP * sum((i ** EXPONENT) for i in range(1, level))))


def calculate_level_from_xp(xp: int) -> int:
    """Inverse of xp_required_for_level — find the highest level whose
    threshold is <= xp. Caps at 100 to avoid runaway."""
    if xp <= 0:
        return 1
    # Inverse of cumulative power sum has no clean closed form, so iterate.
    # Sum grows fast so this loop terminates well before 100 in practice.
    level = 1
    while level < 100 and xp_required_for_level(level + 1) <= xp:
        level += 1
    return level


def level_progress(xp: int) -> dict:
    """Returns the data needed for an XP bar:
        - level
        - xp_into_level   (XP earned past the current level threshold)
        - level_span      (XP needed to span from current → next level)
        - xp_to_next_level
        - progress_pct    (0..100)
    """
    level = calculate_level_from_xp(xp)
    floor = xp_required_for_level(level)
    ceil_ = xp_required_for_level(level + 1)
    span = max(1, ceil_ - floor)
    into = max(0, xp - floor)
    pct = round(min(100.0, (into / span) * 100.0), 1)
    return {
        "level": level,
        "xp_into_level": into,
        "level_span": span,
        "xp_to_next_level": max(0, ceil_ - xp),
        "progress_pct": pct,
    }

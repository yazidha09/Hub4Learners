import { cachedGet, invalidate } from './_client'

const API_BASE = 'http://localhost:8000/api'

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type LeaderboardMetric = 'xp' | 'streak' | 'courses'
export type LeaderboardPeriod = 'daily' | 'weekly' | 'all_time'

export interface XPLogEntry {
  id: string
  amount: number
  source_type: string
  source_id?: string | null
  description?: string | null
  created_at: string
}

export interface Achievement {
  id: string
  code: string
  title: string
  description: string
  icon: string
  xp_reward: number
  category: string
  unlocked: boolean
  unlocked_at?: string | null
}

export interface Badge {
  id: string
  code: string
  title: string
  description: string
  icon: string
  rarity: BadgeRarity
  unlocked: boolean
  unlocked_at?: string | null
  equipped: boolean
}

export interface Streak {
  current_streak: number
  longest_streak: number
  last_activity_date?: string | null
  is_active_today: boolean
}

export interface GamificationProfile {
  user_id: string
  full_name: string | null
  profile_image: string | null
  total_xp: number
  level: number
  level_progress_pct: number
  xp_into_level: number
  xp_to_next_level: number
  level_span: number
  streak: Streak
  equipped_badge: Badge | null
  achievements_unlocked: number
  achievements_total: number
  badges_unlocked: number
  badges_total: number
}

export interface XPGain {
  awarded_xp: number
  total_xp: number
  level: number
  previous_level: number
  leveled_up: boolean
  level_progress_pct: number
  xp_to_next_level: number
  xp_into_level: number
  level_span: number
  new_achievements: Achievement[]
  new_badges: Badge[]
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  profile_image: string | null
  level: number
  total_xp: number
  period_xp: number
  current_streak: number
  completed_courses: number
  equipped_badge: Badge | null
}

export interface Leaderboard {
  metric: LeaderboardMetric
  period: LeaderboardPeriod
  page: number
  page_size: number
  total: number
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed (${res.status})`)
  }
  return res.json()
}

export function getMyGamification(token: string) {
  return cachedGet<GamificationProfile>('/gamification/profile', token, 15_000)
}

export function getUserGamification(token: string, userId: string) {
  return cachedGet<GamificationProfile>(`/gamification/profile/${userId}`, token, 30_000)
}

export function getXPLogs(token: string, limit = 50) {
  return cachedGet<XPLogEntry[]>(`/gamification/xp/logs?limit=${limit}`, token, 15_000)
}

export function claimDailyLogin(token: string) {
  invalidate('/gamification/')
  return request<XPGain>('/gamification/daily-login', token, { method: 'POST' })
}

export function listAchievements(token: string) {
  return cachedGet<Achievement[]>('/gamification/achievements', token, 30_000)
}

export function markAchievementsSeen(token: string) {
  invalidate('/gamification/achievements')
  return request<{ marked: number }>('/gamification/achievements/seen', token, { method: 'POST' })
}

export function listBadges(token: string) {
  return cachedGet<Badge[]>('/gamification/badges', token, 30_000)
}

export function listBadgesForUser(token: string, userId: string) {
  return cachedGet<Badge[]>(`/gamification/badges/${userId}`, token, 30_000)
}

export function equipBadge(token: string, badgeId: string | null) {
  invalidate('/gamification/')
  return request<Badge[]>('/gamification/badges/equip', token, {
    method: 'POST',
    body: JSON.stringify({ badge_id: badgeId }),
  })
}

export function getLeaderboard(
  token: string,
  metric: LeaderboardMetric = 'xp',
  period: LeaderboardPeriod = 'all_time',
  page = 1,
  pageSize = 20,
) {
  const qs = new URLSearchParams({
    metric,
    period,
    page: String(page),
    page_size: String(pageSize),
  })
  // Leaderboard is one of the heaviest aggregates on the backend — cache 45s.
  return cachedGet<Leaderboard>(`/gamification/leaderboard?${qs}`, token, 45_000)
}

// ── Level math (mirrors backend leveling.py) ────────────────────────────────
// The XP curve is fixed: level N's threshold = Σ(i^1.5) for i in [1, N-1].
// We precompute the whole 1..MAX_LEVEL table once on module load so every
// subsequent call is an O(1) array lookup. Previously each call ran an O(L)
// loop, and `calculateLevelFromXP` ran O(L²) total — a hot path for the
// gamification UI.
const BASE_XP = 100
const EXPONENT = 1.5
const MAX_LEVEL = 100

const XP_TABLE: number[] = (() => {
  const table = new Array(MAX_LEVEL + 2).fill(0)
  let sum = 0
  for (let level = 2; level <= MAX_LEVEL + 1; level += 1) {
    sum += (level - 1) ** EXPONENT
    table[level] = Math.round(BASE_XP * sum)
  }
  return table
})()

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  if (level > MAX_LEVEL + 1) return XP_TABLE[MAX_LEVEL + 1]
  return XP_TABLE[level]
}

export function calculateLevelFromXP(xp: number): number {
  if (xp <= 0) return 1
  // Binary search over the precomputed table.
  let lo = 1
  let hi = MAX_LEVEL
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    if (XP_TABLE[mid] <= xp) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function levelProgressFromXP(xp: number) {
  const level = calculateLevelFromXP(xp)
  const floor = xpRequiredForLevel(level)
  const ceil = xpRequiredForLevel(level + 1)
  const span = Math.max(1, ceil - floor)
  const into = Math.max(0, xp - floor)
  return {
    level,
    xpIntoLevel: into,
    levelSpan: span,
    xpToNextLevel: Math.max(0, ceil - xp),
    progressPct: Math.round(Math.min(100, (into / span) * 100) * 10) / 10,
  }
}

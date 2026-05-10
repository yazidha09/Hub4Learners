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
  return request<GamificationProfile>('/gamification/profile', token)
}

export function getUserGamification(token: string, userId: string) {
  return request<GamificationProfile>(`/gamification/profile/${userId}`, token)
}

export function getXPLogs(token: string, limit = 50) {
  return request<XPLogEntry[]>(`/gamification/xp/logs?limit=${limit}`, token)
}

export function claimDailyLogin(token: string) {
  return request<XPGain>('/gamification/daily-login', token, { method: 'POST' })
}

export function listAchievements(token: string) {
  return request<Achievement[]>('/gamification/achievements', token)
}

export function markAchievementsSeen(token: string) {
  return request<{ marked: number }>('/gamification/achievements/seen', token, { method: 'POST' })
}

export function listBadges(token: string) {
  return request<Badge[]>('/gamification/badges', token)
}

export function listBadgesForUser(token: string, userId: string) {
  return request<Badge[]>(`/gamification/badges/${userId}`, token)
}

export function equipBadge(token: string, badgeId: string | null) {
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
  return request<Leaderboard>(`/gamification/leaderboard?${qs}`, token)
}

// ── Level math (mirrors backend leveling.py) ────────────────────────────────
const BASE_XP = 100
const EXPONENT = 1.5

export function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0
  let sum = 0
  for (let i = 1; i < level; i++) sum += i ** EXPONENT
  return Math.round(BASE_XP * sum)
}

export function calculateLevelFromXP(xp: number): number {
  if (xp <= 0) return 1
  let level = 1
  while (level < 100 && xpRequiredForLevel(level + 1) <= xp) level += 1
  return level
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

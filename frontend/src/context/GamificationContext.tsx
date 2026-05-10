import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react'
import {
  getMyGamification,
  type Achievement,
  type Badge,
  type GamificationProfile,
} from '../api/gamification'
import { useAuth } from './AuthContext'

/* ── Toast queue items ───────────────────────────────────────────────────── */

export type GamificationToast =
  | { kind: 'level_up'; level: number; previousLevel: number; id: string }
  | { kind: 'achievement'; achievement: Achievement; id: string }
  | { kind: 'badge'; badge: Badge; id: string }
  | { kind: 'streak_milestone'; days: number; id: string }
  | { kind: 'xp_gain'; amount: number; id: string }

interface GamificationContextValue {
  profile: GamificationProfile | null
  loading: boolean
  refresh: () => Promise<GamificationProfile | null>
  /** Diff a previous profile snapshot against the latest and queue toasts. */
  surface: (gain: {
    leveled_up?: boolean
    level?: number
    previous_level?: number
    new_achievements?: Achievement[]
    new_badges?: Badge[]
    awarded_xp?: number
  }) => void
  toasts: GamificationToast[]
  dismissToast: (id: string) => void
}

const GamificationContext = createContext<GamificationContextValue | undefined>(undefined)

const STREAK_MILESTONES = new Set([3, 7, 14, 30, 60, 100, 365])

let _toastSeq = 0
const nextId = () => `gt-${Date.now()}-${++_toastSeq}`

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const [profile, setProfile] = useState<GamificationProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [toasts, setToasts] = useState<GamificationToast[]>([])
  const previousProfileRef = useRef<GamificationProfile | null>(null)

  const refresh = useCallback(async (): Promise<GamificationProfile | null> => {
    if (!token) return null
    setLoading(true)
    try {
      const next = await getMyGamification(token)

      // Diff against the previous profile to auto-surface changes that
      // happened server-side without going through `surface()`.
      const prev = previousProfileRef.current
      if (prev) {
        if (next.level > prev.level) {
          enqueue({ kind: 'level_up', level: next.level, previousLevel: prev.level, id: nextId() })
        }
        if (
          next.streak.current_streak > prev.streak.current_streak &&
          STREAK_MILESTONES.has(next.streak.current_streak)
        ) {
          enqueue({ kind: 'streak_milestone', days: next.streak.current_streak, id: nextId() })
        }
      }
      previousProfileRef.current = next
      setProfile(next)
      return next
    } catch {
      return null
    } finally {
      setLoading(false)
    }
  }, [token])

  const enqueue = useCallback((t: GamificationToast) => {
    setToasts(prev => [...prev, t])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  /** Caller has an XPGain payload from a backend response — fan it out as toasts. */
  const surface = useCallback(
    (gain: {
      leveled_up?: boolean
      level?: number
      previous_level?: number
      new_achievements?: Achievement[]
      new_badges?: Badge[]
      awarded_xp?: number
    }) => {
      if (gain.awarded_xp && gain.awarded_xp > 0) {
        enqueue({ kind: 'xp_gain', amount: gain.awarded_xp, id: nextId() })
      }
      if (gain.leveled_up && gain.level) {
        enqueue({
          kind: 'level_up',
          level: gain.level,
          previousLevel: gain.previous_level ?? gain.level - 1,
          id: nextId(),
        })
      }
      for (const a of gain.new_achievements ?? []) {
        enqueue({ kind: 'achievement', achievement: a, id: nextId() })
      }
      for (const b of gain.new_badges ?? []) {
        enqueue({ kind: 'badge', badge: b, id: nextId() })
      }
      // Refresh in the background so the XP bar / streak update everywhere.
      void refresh()
    },
    [enqueue, refresh],
  )

  // Initial load + refresh whenever the user/token changes.
  useEffect(() => {
    if (!token || !user) {
      setProfile(null)
      previousProfileRef.current = null
      return
    }
    void refresh()
  }, [token, user, refresh])

  return (
    <GamificationContext.Provider
      value={{ profile, loading, refresh, surface, toasts, dismissToast }}
    >
      {children}
    </GamificationContext.Provider>
  )
}

export function useGamification() {
  const ctx = useContext(GamificationContext)
  if (!ctx) throw new Error('useGamification must be used within GamificationProvider')
  return ctx
}

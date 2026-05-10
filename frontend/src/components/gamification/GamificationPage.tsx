import { useEffect } from 'react'
import { markAchievementsSeen } from '../../api/gamification'
import { useAuth } from '../../context/AuthContext'
import AchievementsPanel from './AchievementsPanel'
import BadgeShowcase from './BadgeShowcase'
import LeaderboardPanel from './Leaderboard'
import ProfileStats from './ProfileStats'

/**
 * Full gamification view — drop into any dashboard as a tab content.
 */
export default function GamificationPage() {
  const { token } = useAuth()

  useEffect(() => {
    if (!token) return
    markAchievementsSeen(token).catch(() => {})
  }, [token])

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1280px] mx-auto space-y-5">
      <header>
        <h1 className="text-[1.5rem] font-extrabold text-[#0C0C0F] tracking-tight">
          Your Hero Stats
        </h1>
        <p className="text-[0.82rem] text-[#94A3B8]">
          Earn XP, level up, build streaks, and unlock achievements as you learn.
        </p>
      </header>

      <ProfileStats />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BadgeShowcase />
        <AchievementsPanel />
      </div>

      <LeaderboardPanel />
    </div>
  )
}

import { useGamification } from '../../context/GamificationContext'
import LevelCard from './LevelCard'
import StreakWidget from './StreakWidget'

/**
 * Drop-in component for a dashboard "stats" section. Shows the level card +
 * streak widget side by side; degrades gracefully on first render.
 */
export default function ProfileStats() {
  const { profile } = useGamification()

  if (!profile) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton h="h-44" />
        <Skeleton h="h-32" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <LevelCard profile={profile} />
      <StreakWidget streak={profile.streak} />
    </div>
  )
}

function Skeleton({ h }: { h: string }) {
  return <div className={`${h} rounded-2xl bg-white border border-[#E5E7EB] animate-pulse`} />
}

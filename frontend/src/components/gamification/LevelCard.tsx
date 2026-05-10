import type { GamificationProfile } from '../../api/gamification'
import { GamificationIcon } from './icons'
import XPBar from './XPBar'

export default function LevelCard({ profile }: { profile: GamificationProfile }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0C0C0F] via-[#1A1A22] to-[#0C0C0F] p-5 shadow-[0_8px_32px_rgba(255,85,51,0.18)] border border-white/5">
      {/* Decorative glows */}
      <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-[#FF5533]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-12 h-36 w-36 rounded-full bg-[#FF7755]/20 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5533] to-[#FF7755] text-white shadow-lg shadow-[#FF5533]/40">
            <span className="text-2xl font-black tabular-nums">{profile.level}</span>
          </div>
          {profile.equipped_badge && (
            <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-full bg-white/95 ring-2 ring-[#0C0C0F] flex items-center justify-center">
              <GamificationIcon name={profile.equipped_badge.icon} size={16} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[0.6rem] font-bold tracking-[0.16em] uppercase text-[#FF7755]/70">
              Hero Stats
            </span>
            <span className="text-[0.65rem] text-white/40">
              · {profile.total_xp.toLocaleString()} XP total
            </span>
          </div>
          <div className="mt-0.5 truncate text-[0.95rem] font-bold text-white">
            {profile.full_name ?? 'Adventurer'}
          </div>
          <div className="mt-2">
            <XPBar
              level={profile.level}
              xpIntoLevel={profile.xp_into_level}
              levelSpan={profile.level_span}
              xpToNext={profile.xp_to_next_level}
              pct={profile.level_progress_pct}
            />
          </div>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
        <Stat label="Streak" value={profile.streak.current_streak} suffix="d" highlight={profile.streak.is_active_today} />
        <Stat label="Achievements" value={`${profile.achievements_unlocked}/${profile.achievements_total}`} />
        <Stat label="Badges" value={`${profile.badges_unlocked}/${profile.badges_total}`} />
      </div>
    </div>
  )
}

function Stat({
  label, value, suffix, highlight,
}: { label: string; value: number | string; suffix?: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-[0.95rem] font-bold tabular-nums ${highlight ? 'text-[#FF5533]' : 'text-white'}`}>
        {value}{suffix ?? ''}
      </div>
      <div className="text-[0.6rem] font-semibold tracking-wider uppercase text-white/40 mt-0.5">
        {label}
      </div>
    </div>
  )
}

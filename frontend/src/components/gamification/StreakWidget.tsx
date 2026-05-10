import type { Streak } from '../../api/gamification'

/**
 * Animated fire streak widget. The flame intensifies with longer streaks.
 */
export default function StreakWidget({
  streak, compact = false,
}: { streak: Streak; compact?: boolean }) {
  const active = streak.is_active_today
  const days = streak.current_streak

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        active
          ? 'bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 border-orange-200'
          : 'bg-white border-[#E5E7EB]'
      } ${compact ? 'p-3' : 'p-5'} shadow-sm`}
    >
      {active && (
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-orange-400/20 blur-2xl pointer-events-none" />
      )}

      <div className="relative flex items-center gap-3">
        <div className="relative shrink-0">
          <Flame active={active} size={compact ? 38 : 56} intensity={Math.min(1, days / 14)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.6rem] font-bold tracking-[0.14em] uppercase text-[#94A3B8]">
            Current Streak
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`${compact ? 'text-2xl' : 'text-3xl'} font-black tabular-nums ${
              active ? 'text-orange-600' : 'text-[#0C0C0F]'
            }`}>
              {days}
            </span>
            <span className="text-[0.78rem] font-semibold text-[#94A3B8]">
              {days === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="text-[0.7rem] text-[#94A3B8] mt-0.5">
            Best: <span className="font-semibold text-[#0C0C0F]">{streak.longest_streak}</span> · {active ? 'Active today 🔥' : 'Learn today to keep it going'}
          </div>
        </div>
      </div>
    </div>
  )
}

function Flame({ active, size, intensity }: { active: boolean; size: number; intensity: number }) {
  const opacity = active ? 1 : 0.35
  const flicker = active ? 'animate-[flameFlicker_1.3s_ease-in-out_infinite]' : ''
  return (
    <div
      className={`relative ${flicker}`}
      style={{ width: size, height: size, opacity }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <defs>
          <linearGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={active ? '#FF3300' : '#A0AEC0'} />
            <stop offset="55%" stopColor={active ? '#FF7733' : '#CBD5E1'} />
            <stop offset="100%" stopColor={active ? '#FFD700' : '#E2E8F0'} />
          </linearGradient>
        </defs>
        <path
          d="M32 4 C 22 18, 14 22, 14 36 C 14 50, 24 60, 32 60 C 40 60, 50 50, 50 36 C 50 26, 42 22, 38 14 C 34 22, 28 22, 32 4 Z"
          fill="url(#flameGrad)"
        />
        <path
          d="M32 22 C 28 28, 24 32, 24 40 C 24 48, 28 52, 32 52 C 36 52, 40 48, 40 40 C 40 32, 36 28, 32 22 Z"
          fill={active ? '#FFFAE0' : '#F1F5F9'}
          opacity={0.6 + intensity * 0.4}
        />
      </svg>
      <style>{`
        @keyframes flameFlicker {
          0%,100% { transform: scale(1) translateY(0); }
          25% { transform: scale(1.05, 0.97) translateY(-1px); }
          50% { transform: scale(0.97, 1.04) translateY(0); }
          75% { transform: scale(1.03, 0.99) translateY(-0.5px); }
        }
      `}</style>
    </div>
  )
}

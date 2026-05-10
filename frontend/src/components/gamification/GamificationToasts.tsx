import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useGamification, type GamificationToast } from '../../context/GamificationContext'
import { GamificationIcon, RARITY_STYLES } from './icons'

const AUTO_DISMISS_MS = 5500

/**
 * Listens to the gamification context's toast queue and renders animated
 * popups for level-ups, achievement unlocks, badge unlocks, streak milestones
 * and XP gains. Mount once at the app root.
 */
export default function GamificationToasts() {
  const { toasts, dismissToast } = useGamification()

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(t =>
      setTimeout(() => dismissToast(t.id), AUTO_DISMISS_MS),
    )
    return () => { timers.forEach(clearTimeout) }
  }, [toasts, dismissToast])

  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[10000] flex flex-col gap-3 max-w-sm w-[min(92vw,360px)]"
      style={{ pointerEvents: 'none' }}
    >
      {toasts.slice(-4).map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard toast={t} onClose={() => dismissToast(t.id)} />
        </div>
      ))}
      <style>{`
        @keyframes gtSlideIn {
          0% { transform: translateY(20px) scale(0.96); opacity: 0; }
          60% { transform: translateY(-3px) scale(1.01); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes gtPulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(255,85,51,0.35); }
          50% { box-shadow: 0 8px 40px rgba(255,85,51,0.6); }
        }
        @keyframes gtConfetti {
          0% { transform: translateY(-4px) rotate(0deg); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(80px) rotate(540deg); opacity: 0; }
        }
        @keyframes gtSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body,
  )
}

function ToastCard({ toast, onClose }: { toast: GamificationToast; onClose: () => void }) {
  switch (toast.kind) {
    case 'level_up':       return <LevelUpToast level={toast.level} previousLevel={toast.previousLevel} onClose={onClose} />
    case 'achievement':    return <AchievementToast title={toast.achievement.title} desc={toast.achievement.description} icon={toast.achievement.icon} xp={toast.achievement.xp_reward} onClose={onClose} />
    case 'badge':          return <BadgeToast title={toast.badge.title} desc={toast.badge.description} icon={toast.badge.icon} rarity={toast.badge.rarity} onClose={onClose} />
    case 'streak_milestone': return <StreakToast days={toast.days} onClose={onClose} />
    case 'xp_gain':        return <XPToast amount={toast.amount} onClose={onClose} />
  }
}

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white/80 transition border-none cursor-pointer"
      aria-label="Dismiss"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

function LevelUpToast({ level, previousLevel, onClose }: { level: number; previousLevel: number; onClose: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF5533] via-[#FF7755] to-[#FFAA66] p-5 text-white shadow-[0_8px_32px_rgba(255,85,51,0.4)]"
      style={{ animation: 'gtSlideIn 0.45s cubic-bezier(0.34,1.56,0.64,1), gtPulse 1.6s ease-in-out infinite' }}
    >
      <CloseBtn onClose={onClose} />
      {/* Confetti */}
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className="absolute w-1.5 h-2 rounded"
          style={{
            background: ['#FFE600', '#FFFFFF', '#FFB347', '#FF99CC'][i % 4],
            left: `${10 + i * 11}%`,
            top: 0,
            animation: `gtConfetti 1.4s ${i * 80}ms ease-in forwards`,
          }}
        />
      ))}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm ring-2 ring-white/40">
          <span className="text-2xl font-black tabular-nums">{level}</span>
        </div>
        <div>
          <div className="text-[0.6rem] font-bold tracking-[0.16em] uppercase text-white/80">Level Up!</div>
          <div className="text-base font-extrabold leading-tight">You reached level {level}</div>
          <div className="text-[0.72rem] text-white/85">From level {previousLevel} → {level}. Keep going!</div>
        </div>
      </div>
    </div>
  )
}

function AchievementToast({ title, desc, icon, xp, onClose }: { title: string; desc: string; icon: string; xp: number; onClose: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0C0C0F] to-[#1E1E2A] p-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-[#FF5533]/30"
      style={{ animation: 'gtSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <CloseBtn onClose={onClose} />
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500"
            style={{ animation: 'gtSpin 6s linear infinite' }}
          >
            <GamificationIcon name={icon} size={24} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.6rem] font-bold tracking-[0.16em] uppercase text-amber-400">Achievement Unlocked</div>
          <div className="text-[0.92rem] font-extrabold leading-tight">{title}</div>
          <div className="text-[0.72rem] text-white/70 mt-0.5 leading-snug">{desc}</div>
          {xp > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#FF5533]/20 px-2 py-0.5 text-[0.65rem] font-bold text-[#FF5533]">
              +{xp} XP
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BadgeToast({ title, desc, icon, rarity, onClose }: { title: string; desc: string; icon: string; rarity: string; onClose: () => void }) {
  const r = RARITY_STYLES[rarity] ?? RARITY_STYLES.common
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${r.bg} p-4 ${r.text} shadow-xl ${r.glow} border border-white/40`}
      style={{ animation: 'gtSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <CloseBtn onClose={onClose} />
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg ${r.ring}`}>
          <GamificationIcon name={icon} size={24} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-[0.6rem] font-bold tracking-[0.16em] uppercase ${r.text}`}>
            {r.label} Badge Unlocked
          </div>
          <div className="text-[0.92rem] font-extrabold leading-tight">{title}</div>
          <div className="text-[0.72rem] opacity-80 mt-0.5 leading-snug">{desc}</div>
        </div>
      </div>
    </div>
  )
}

function StreakToast({ days, onClose }: { days: number; onClose: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-red-500 p-4 text-white shadow-[0_8px_32px_rgba(255,85,51,0.45)]"
      style={{ animation: 'gtSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <CloseBtn onClose={onClose} />
      <div className="flex items-center gap-3">
        <div className="text-3xl">🔥</div>
        <div>
          <div className="text-[0.6rem] font-bold tracking-[0.16em] uppercase text-white/80">Streak Milestone</div>
          <div className="text-base font-extrabold leading-tight">{days}-day streak!</div>
          <div className="text-[0.72rem] text-white/85">You're on fire — keep showing up.</div>
        </div>
      </div>
    </div>
  )
}

function XPToast({ amount, onClose }: { amount: number; onClose: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-white/95 backdrop-blur-md border border-[#FF5533]/30 p-3 pl-4 shadow-lg flex items-center gap-2.5"
      style={{ animation: 'gtSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      <button
        onClick={onClose}
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-slate-300 hover:text-slate-600 bg-transparent border-none cursor-pointer"
        aria-label="Dismiss"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF5533] to-[#FF7755] text-white text-base font-bold">⚡</div>
      <div>
        <div className="text-[0.78rem] font-bold text-[#0C0C0F]">+{amount} XP earned</div>
        <div className="text-[0.66rem] text-[#94A3B8]">Nice work — keep learning</div>
      </div>
    </div>
  )
}

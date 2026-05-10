import { useEffect, useState } from 'react'
import {
  equipBadge as equipBadgeApi,
  listBadges,
  type Badge,
} from '../../api/gamification'
import { useAuth } from '../../context/AuthContext'
import { GamificationIcon, RARITY_STYLES } from './icons'

export default function BadgeShowcase({
  onChange,
  readOnly = false,
}: { onChange?: () => void; readOnly?: boolean }) {
  const { token } = useAuth()
  const [badges, setBadges] = useState<Badge[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unlocked'>('all')

  useEffect(() => {
    if (!token) return
    listBadges(token).then(setBadges).catch(() => setBadges([]))
  }, [token])

  const handleEquip = async (b: Badge) => {
    if (!token || !b.unlocked || readOnly) return
    setLoading(true)
    try {
      const target = b.equipped ? null : b.id
      const next = await equipBadgeApi(token, target)
      setBadges(next)
      onChange?.()
    } finally {
      setLoading(false)
    }
  }

  const filtered = (badges ?? []).filter(b => filter === 'all' || b.unlocked)
  const unlockedCount = (badges ?? []).filter(b => b.unlocked).length
  const total = (badges ?? []).length

  return (
    <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[1rem] font-bold text-[#0C0C0F]">Badge Showcase</h3>
          <p className="text-[0.7rem] text-[#94A3B8]">
            {unlockedCount} of {total} unlocked · click an unlocked badge to equip it
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-[#F1F3F5] p-1">
          {(['all', 'unlocked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-[0.7rem] font-semibold rounded-md transition-colors border-none cursor-pointer capitalize ${
                filter === f ? 'bg-white text-[#0C0C0F] shadow-sm' : 'bg-transparent text-[#94A3B8]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {!badges ? (
        <div className="py-8 text-center text-[0.78rem] text-[#94A3B8]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-[0.78rem] text-[#94A3B8]">No badges yet — keep learning to earn them!</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map(b => {
            const r = RARITY_STYLES[b.rarity] ?? RARITY_STYLES.common
            return (
              <button
                key={b.id}
                onClick={() => handleEquip(b)}
                disabled={!b.unlocked || loading || readOnly}
                title={b.unlocked ? `${b.title} — ${b.description}` : `Locked: ${b.description}`}
                className={`relative group p-3 rounded-xl text-left transition-all border-none cursor-pointer
                  ${b.unlocked ? `${r.bg} ${r.ring} hover:scale-[1.03] hover:shadow-lg ${r.glow}` : 'bg-slate-50 ring-1 ring-slate-200 opacity-60'}
                  ${b.equipped ? 'ring-4 ring-offset-2 ring-[#FF5533]' : ''}
                  ${readOnly ? 'cursor-default' : ''}`}
              >
                {b.equipped && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-[#FF5533] text-white text-[0.55rem] font-bold tracking-wider uppercase">
                    Equipped
                  </span>
                )}
                <div className="flex items-center justify-center h-12 mb-2">
                  <GamificationIcon name={b.icon} size={36} />
                </div>
                <div className={`text-[0.78rem] font-bold leading-tight ${b.unlocked ? r.text : 'text-slate-500'}`}>
                  {b.title}
                </div>
                <div className={`text-[0.62rem] font-bold tracking-[0.12em] uppercase mt-1 ${b.unlocked ? r.text : 'text-slate-400'}`}>
                  {r.label}
                </div>
                {!b.unlocked && (
                  <div className="text-[0.65rem] text-slate-400 mt-1 line-clamp-2">{b.description}</div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

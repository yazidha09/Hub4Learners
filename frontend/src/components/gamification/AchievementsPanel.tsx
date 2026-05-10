import { useEffect, useMemo, useState } from 'react'
import { listAchievements, type Achievement } from '../../api/gamification'
import { useAuth } from '../../context/AuthContext'
import { GamificationIcon } from './icons'

const CATEGORY_ORDER = ['learning', 'quiz', 'streak', 'xp', 'level', 'course', 'topic', 'habit']

export default function AchievementsPanel() {
  const { token } = useAuth()
  const [items, setItems] = useState<Achievement[] | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    if (!token) return
    listAchievements(token).then(setItems).catch(() => setItems([]))
  }, [token])

  const categories = useMemo(() => {
    const set = new Set<string>(['all'])
    ;(items ?? []).forEach(a => set.add(a.category))
    return Array.from(set).sort((a, b) => {
      if (a === 'all') return -1
      if (b === 'all') return 1
      const ai = CATEGORY_ORDER.indexOf(a)
      const bi = CATEGORY_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  }, [items])

  const filtered = (items ?? []).filter(a => filter === 'all' || a.category === filter)
  const unlockedCount = (items ?? []).filter(a => a.unlocked).length

  return (
    <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-[1rem] font-bold text-[#0C0C0F]">Achievements</h3>
          <p className="text-[0.7rem] text-[#94A3B8]">
            {unlockedCount} of {items?.length ?? 0} unlocked
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-[#F1F3F5] p-1">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`px-2.5 py-1 text-[0.68rem] font-semibold rounded-md transition-colors border-none cursor-pointer capitalize ${
                filter === c ? 'bg-white text-[#0C0C0F] shadow-sm' : 'bg-transparent text-[#94A3B8]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {!items ? (
        <div className="py-8 text-center text-[0.78rem] text-[#94A3B8]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-[0.78rem] text-[#94A3B8]">No achievements in this category.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {filtered.map(a => (
            <div
              key={a.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition ${
                a.unlocked
                  ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl shrink-0 ${
                  a.unlocked
                    ? 'bg-gradient-to-br from-amber-300 to-orange-500 shadow-md'
                    : 'bg-slate-200'
                } ${a.unlocked ? '' : 'grayscale'}`}
              >
                <GamificationIcon name={a.icon} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[0.82rem] font-bold leading-tight ${a.unlocked ? 'text-[#0C0C0F]' : 'text-slate-500'}`}>
                    {a.title}
                  </span>
                  {a.xp_reward > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold tracking-wider uppercase shrink-0 ${
                      a.unlocked ? 'bg-[#FF5533]/10 text-[#FF5533]' : 'bg-slate-200 text-slate-400'
                    }`}>
                      +{a.xp_reward} XP
                    </span>
                  )}
                </div>
                <p className={`text-[0.7rem] leading-snug mt-0.5 ${a.unlocked ? 'text-slate-600' : 'text-slate-400'}`}>
                  {a.description}
                </p>
                {a.unlocked && a.unlocked_at && (
                  <p className="text-[0.62rem] text-orange-700 mt-1 font-medium">
                    Unlocked · {new Date(a.unlocked_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

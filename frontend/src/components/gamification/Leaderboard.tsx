import { useEffect, useState } from 'react'
import {
  getLeaderboard, type Leaderboard, type LeaderboardEntry,
  type LeaderboardMetric, type LeaderboardPeriod,
} from '../../api/gamification'
import { useAuth } from '../../context/AuthContext'
import { GamificationIcon, RARITY_STYLES } from './icons'

const METRICS: { id: LeaderboardMetric; label: string; valueOf: (e: LeaderboardEntry) => string }[] = [
  { id: 'xp', label: 'XP', valueOf: e => `${e.period_xp.toLocaleString()} XP` },
  { id: 'streak', label: 'Streak', valueOf: e => `${e.current_streak} day${e.current_streak === 1 ? '' : 's'}` },
  { id: 'courses', label: 'Courses', valueOf: e => `${e.completed_courses} done` },
]

const PERIODS: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'daily', label: 'Today' },
  { id: 'weekly', label: 'This Week' },
  { id: 'all_time', label: 'All Time' },
]

const PAGE_SIZE = 10

export default function LeaderboardPanel() {
  const { token, user } = useAuth()
  const [metric, setMetric] = useState<LeaderboardMetric>('xp')
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Leaderboard | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getLeaderboard(token, metric, period, page, PAGE_SIZE)
      .then(setData)
      .finally(() => setLoading(false))
  }, [token, metric, period, page])

  useEffect(() => { setPage(1) }, [metric, period])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const valueFn = METRICS.find(m => m.id === metric)!.valueOf

  return (
    <div className="rounded-2xl bg-white border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-[1.05rem] font-bold text-[#0C0C0F] flex items-center gap-2">
            <span>🏆</span> Leaderboard
          </h3>
          <p className="text-[0.7rem] text-[#94A3B8]">See how you rank against other learners</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-0.5 rounded-lg bg-[#F1F3F5] p-1">
            {METRICS.map(m => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`px-2.5 py-1 text-[0.68rem] font-semibold rounded-md transition-colors border-none cursor-pointer ${
                  metric === m.id ? 'bg-white text-[#0C0C0F] shadow-sm' : 'bg-transparent text-[#94A3B8]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 rounded-lg bg-[#F1F3F5] p-1">
            {PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 text-[0.68rem] font-semibold rounded-md transition-colors border-none cursor-pointer ${
                  period === p.id ? 'bg-white text-[#0C0C0F] shadow-sm' : 'bg-transparent text-[#94A3B8]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-12 text-center text-[0.78rem] text-[#94A3B8]">Loading rankings…</div>
      ) : !data || data.entries.length === 0 ? (
        <div className="py-12 text-center text-[0.78rem] text-[#94A3B8]">No entries yet. Be the first!</div>
      ) : (
        <>
          <ol className="flex flex-col gap-1.5">
            {data.entries.map(e => (
              <Row key={e.user_id} entry={e} valueText={valueFn(e)} isMe={e.user_id === user?.id} />
            ))}
          </ol>

          {/* Sticky "me" row when not on visible page */}
          {data.me && !data.entries.some(e => e.user_id === data.me!.user_id) && (
            <div className="mt-3 pt-3 border-t border-dashed border-[#E5E7EB]">
              <div className="text-[0.6rem] font-bold tracking-[0.14em] uppercase text-[#94A3B8] mb-1.5">
                Your rank
              </div>
              <Row entry={data.me} valueText={valueFn(data.me)} isMe />
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[0.72rem]">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#0C0C0F] disabled:opacity-40 hover:bg-[#F1F3F5] cursor-pointer disabled:cursor-not-allowed bg-white"
              >
                ← Prev
              </button>
              <span className="text-[#94A3B8] tabular-nums">
                Page {page} / {totalPages} · {data.total} learners
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[#0C0C0F] disabled:opacity-40 hover:bg-[#F1F3F5] cursor-pointer disabled:cursor-not-allowed bg-white"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Row({
  entry, valueText, isMe,
}: { entry: LeaderboardEntry; valueText: string; isMe: boolean }) {
  const rankBg =
    entry.rank === 1 ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-white' :
    entry.rank === 2 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-white' :
    entry.rank === 3 ? 'bg-gradient-to-br from-orange-300 to-amber-600 text-white' :
                       'bg-[#F1F3F5] text-[#0C0C0F]'

  return (
    <li
      className={`flex items-center gap-3 p-2.5 pl-2 rounded-xl transition ${
        isMe
          ? 'bg-gradient-to-r from-[#FF5533]/10 to-transparent ring-1 ring-[#FF5533]/30'
          : 'hover:bg-[#F8F9FB]'
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg font-black tabular-nums ${rankBg} text-[0.85rem]`}>
        {entry.rank}
      </div>
      <div className="w-9 h-9 rounded-full bg-[#0C0C0F] text-white flex items-center justify-center text-[0.7rem] font-semibold uppercase shrink-0 overflow-hidden">
        {entry.profile_image ? (
          <img src={entry.profile_image} alt="" className="h-full w-full object-cover" />
        ) : (
          entry.full_name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[0.82rem] font-semibold truncate ${isMe ? 'text-[#FF5533]' : 'text-[#0C0C0F]'}`}>
            {entry.full_name} {isMe && <span className="text-[0.65rem] font-bold text-[#FF5533]">(you)</span>}
          </span>
          {entry.equipped_badge && (
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] ${
                RARITY_STYLES[entry.equipped_badge.rarity]?.bg ?? ''
              }`}
              title={`${entry.equipped_badge.title} (${entry.equipped_badge.rarity})`}
            >
              <GamificationIcon name={entry.equipped_badge.icon} size={12} />
            </span>
          )}
        </div>
        <div className="text-[0.66rem] text-[#94A3B8]">
          Level {entry.level} · {entry.total_xp.toLocaleString()} XP total
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[0.85rem] font-bold text-[#0C0C0F] tabular-nums">{valueText}</div>
      </div>
    </li>
  )
}

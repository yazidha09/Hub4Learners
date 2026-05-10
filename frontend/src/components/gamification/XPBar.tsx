import { useEffect, useRef, useState } from 'react'

/**
 * Animated XP bar. Animates whenever `value` changes — the bar smoothly
 * fills from the previous percentage to the new one (or wraps if it crossed
 * a level boundary).
 */
export default function XPBar({
  level,
  xpIntoLevel,
  levelSpan,
  xpToNext,
  pct,
  compact = false,
}: {
  level: number
  xpIntoLevel: number
  levelSpan: number
  xpToNext: number
  pct: number
  compact?: boolean
}) {
  const [displayPct, setDisplayPct] = useState(pct)
  const [pulse, setPulse] = useState(false)
  const prevPctRef = useRef(pct)

  useEffect(() => {
    if (prevPctRef.current !== pct) {
      setPulse(true)
      const t1 = setTimeout(() => setDisplayPct(pct), 30)
      const t2 = setTimeout(() => setPulse(false), 900)
      prevPctRef.current = pct
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [pct])

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-center justify-between text-[0.7rem]">
        <span className="font-bold tracking-wider uppercase text-[#FF5533]">
          Level {level}
        </span>
        <span className="font-medium text-[#94A3B8] tabular-nums">
          {xpIntoLevel.toLocaleString()} / {levelSpan.toLocaleString()} XP
        </span>
      </div>
      <div
        className={`relative h-2.5 w-full overflow-hidden rounded-full bg-[#E5E7EB] ${
          pulse ? 'ring-2 ring-[#FF5533]/40' : ''
        } transition-all duration-300`}
      >
        <div
          className="h-full bg-gradient-to-r from-[#FF5533] via-[#FF7755] to-[#FFAA77] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, displayPct)}%` }}
        />
        {pulse && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{ animation: 'xpShimmer 0.9s ease-out' }}
          />
        )}
      </div>
      {!compact && (
        <div className="text-[0.65rem] text-[#94A3B8] text-right">
          {xpToNext.toLocaleString()} XP to level {level + 1}
        </div>
      )}
      <style>{`
        @keyframes xpShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

/**
 * Tiny icon resolver for achievement/badge "icon" strings.
 * Returns an emoji fallback so we don't take an icon-pack dependency.
 * Swap this file's body with lucide-react etc. later if desired.
 */
const ICON_MAP: Record<string, string> = {
  trophy: '🏆',
  book: '📖',
  books: '📚',
  graduate: '🎓',
  diploma: '🎓',
  check: '✅',
  target: '🎯',
  star: '⭐',
  flame: '🔥',
  bolt: '⚡',
  shield: '🛡️',
  scroll: '📜',
  brain: '🧠',
  crown: '👑',
  phoenix: '🔥',
  spark: '✨',
  code: '💻',
  sun: '☀️',
  moon: '🌙',
  diamond: '💎',
}

export function GamificationIcon({
  name,
  className = '',
  size = 24,
}: {
  name: string
  className?: string
  size?: number
}) {
  const ch = ICON_MAP[name] ?? '🏅'
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
      aria-hidden
    >
      {ch}
    </span>
  )
}

export const RARITY_STYLES: Record<
  string,
  { bg: string; ring: string; text: string; label: string; glow: string }
> = {
  common: {
    bg: 'bg-gradient-to-br from-slate-100 to-slate-200',
    ring: 'ring-1 ring-slate-300',
    text: 'text-slate-700',
    label: 'Common',
    glow: 'shadow-slate-300/30',
  },
  rare: {
    bg: 'bg-gradient-to-br from-sky-100 to-blue-200',
    ring: 'ring-2 ring-sky-400',
    text: 'text-sky-800',
    label: 'Rare',
    glow: 'shadow-sky-400/40',
  },
  epic: {
    bg: 'bg-gradient-to-br from-violet-100 to-purple-200',
    ring: 'ring-2 ring-violet-500',
    text: 'text-violet-800',
    label: 'Epic',
    glow: 'shadow-violet-500/40',
  },
  legendary: {
    bg: 'bg-gradient-to-br from-amber-100 via-orange-200 to-rose-200',
    ring: 'ring-2 ring-amber-500',
    text: 'text-amber-800',
    label: 'Legendary',
    glow: 'shadow-amber-500/50',
  },
}

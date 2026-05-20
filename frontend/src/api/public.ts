import { cachedGet } from './_client'

export interface PublicStats {
  students: number
  courses: number
  subjects: number
  avg_rating: number | null
}

export function getPublicStats(): Promise<PublicStats> {
  // Cache for 60s — these numbers move slowly and the same payload is read
  // by HomePage, LoginPage, and RegisterPage on every visit.
  return cachedGet<PublicStats>('/public/stats', undefined, 60_000)
}

// Format an integer as a compact "12k+" / "1.2k+" / "950+" display string.
export function formatCount(n: number): string {
  if (n < 1000) return `${n}+`
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k+`
  return `${Math.floor(n / 1000)}k+`
}

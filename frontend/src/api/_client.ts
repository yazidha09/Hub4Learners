// Shared HTTP utilities for the API layer.
//
// - `dedupGet` collapses parallel calls to the same GET into a single fetch.
//   StrictMode mounts effects twice in dev, and multiple components often
//   read the same endpoint on mount — without dedup that's 2-4x the traffic.
// - `cachedGet` adds a short TTL on top of dedup so navigating back to a
//   page within a few seconds reuses the previous response instead of
//   re-fetching. Mutations call `invalidate` to clear stale entries.
//
// Sensitive endpoints (auth, profile) should NOT use these helpers.

export const API_BASE = 'http://localhost:8000/api'

type Entry<T> = { value: T; expiresAt: number }

const inflight = new Map<string, Promise<unknown>>()
const cache = new Map<string, Entry<unknown>>()

function buildHeaders(token?: string, extra?: HeadersInit): HeadersInit {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  }
}

async function rawFetch<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: buildHeaders(token, init?.headers),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function rawRequest<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  return rawFetch<T>(path, token, init)
}

function keyFor(path: string, token?: string): string {
  // Token is part of the key so cached entries can't leak across users.
  return `${token ? 't' : 'a'}:${token ?? ''}:${path}`
}

export function dedupGet<T>(path: string, token?: string): Promise<T> {
  const key = keyFor(path, token)
  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) return existing
  const p = rawFetch<T>(path, token).finally(() => {
    // Clear as soon as it settles so the next call gets a fresh response.
    inflight.delete(key)
  })
  inflight.set(key, p)
  return p
}

export function cachedGet<T>(path: string, token?: string, ttlMs = 15_000): Promise<T> {
  const key = keyFor(path, token)
  const now = Date.now()
  const hit = cache.get(key) as Entry<T> | undefined
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.value)

  const inflightHit = inflight.get(key) as Promise<T> | undefined
  if (inflightHit) return inflightHit

  const p = rawFetch<T>(path, token)
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, p)
  return p
}

export function invalidate(prefix: string): void {
  // Match against the path segment of the cache key. Prefix-based so callers
  // can wipe `/courses/${id}` and its subresources in one shot.
  // We also drop matching `inflight` entries: otherwise a GET that started
  // BEFORE the mutation can be re-shared by the post-mutation refresh and
  // hand back pre-mutation data (then re-cache it).
  const matches = (key: string): boolean => {
    const colonIdx = key.indexOf(':', 2)
    const path = key.slice(colonIdx + 1)
    return path.startsWith(prefix)
  }
  for (const key of Array.from(cache.keys())) {
    if (matches(key)) cache.delete(key)
  }
  for (const key of Array.from(inflight.keys())) {
    if (matches(key)) inflight.delete(key)
  }
}

export function invalidateAll(): void {
  cache.clear()
}

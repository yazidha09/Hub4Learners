const API_BASE = 'http://localhost:8000/api'

export interface ProStatus {
  is_pro: boolean
  pro_until: string | null
  period_days: number
  price_usd: number
}

export interface ProCheckoutSession {
  session_id: string
  url: string
}

export interface ProConfirmResult {
  is_pro: boolean
  pro_until: string
  added_days: number
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export function getProStatus(token: string): Promise<ProStatus> {
  return request<ProStatus>('/billing/pro-status', token)
}

export function subscribeToPro(token: string): Promise<ProCheckoutSession> {
  return request<ProCheckoutSession>('/billing/subscribe', token, { method: 'POST' })
}

export function confirmProSubscription(token: string, sessionId: string): Promise<ProConfirmResult> {
  return request<ProConfirmResult>('/billing/subscribe/confirm', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })
}

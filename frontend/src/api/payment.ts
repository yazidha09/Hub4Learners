import type { EnrollmentOut } from './course'

const API_BASE = 'http://localhost:8000/api'

export interface CheckoutSession {
  session_id: string
  url: string
}

export interface PaymentConfig {
  publishable_key: string
}

async function request<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getPaymentConfig(): Promise<PaymentConfig> {
  return request<PaymentConfig>('/payments/config')
}

export function createCheckoutSession(token: string, courseId: string): Promise<CheckoutSession> {
  return request<CheckoutSession>(`/payments/checkout/${courseId}`, token, { method: 'POST' })
}

export function confirmPayment(token: string, sessionId: string): Promise<EnrollmentOut> {
  return request<EnrollmentOut>('/payments/confirm', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })
}

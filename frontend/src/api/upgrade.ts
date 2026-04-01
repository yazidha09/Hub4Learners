const API_BASE = 'http://localhost:8000/api'

export interface UpgradeRequestOut {
  id: string
  user_id: string
  user_full_name: string
  user_email: string
  status: 'pending' | 'approved' | 'rejected'
  cin_path: string | null
  diploma_path: string | null
  message: string | null
  reviewer_notes: string | null
  created_at: string
  reviewed_at: string | null
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export function submitUpgradeRequest(token: string, formData: FormData): Promise<UpgradeRequestOut> {
  return request<UpgradeRequestOut>(`${API_BASE}/upgrade/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
}

export function getMyUpgradeRequest(token: string): Promise<UpgradeRequestOut | null> {
  return request<UpgradeRequestOut | null>(`${API_BASE}/upgrade/my-request`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function listUpgradeRequests(token: string): Promise<UpgradeRequestOut[]> {
  return request<UpgradeRequestOut[]>(`${API_BASE}/upgrade/requests`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function reviewUpgradeRequest(
  token: string,
  id: string,
  action: 'approve' | 'reject',
  reviewer_notes?: string,
): Promise<UpgradeRequestOut> {
  return request<UpgradeRequestOut>(`${API_BASE}/upgrade/requests/${id}/review`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, reviewer_notes: reviewer_notes || null }),
  })
}

const API_BASE = 'http://localhost:8000/api'

export interface UniversityOut {
  id: string
  name: string
  created_by: string | null
  created_at: string
}

export interface CreateAdminRequest {
  full_name: string
  email: string
  password: string
  university_id?: string
}

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Universities ──────────────────────────────────────────────────────────────

export function listUniversities(token: string): Promise<UniversityOut[]> {
  return request<UniversityOut[]>('/org/universities', token)
}

export function createUniversity(token: string, data: { name: string }): Promise<UniversityOut> {
  return request<UniversityOut>('/org/universities', token, { method: 'POST', body: JSON.stringify(data) })
}

export function deleteUniversity(token: string, universityId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/org/universities/${universityId}`, token, { method: 'DELETE' })
}

// ── Admin creation ────────────────────────────────────────────────────────────

export function createUniversityAdmin(token: string, data: CreateAdminRequest): Promise<{ id: string; full_name: string; email: string; role: string }> {
  return request('/org/admins/university', token, { method: 'POST', body: JSON.stringify(data) })
}

// ── Professor creation ────────────────────────────────────────────────────────

export function createProfessor(token: string, data: CreateAdminRequest): Promise<{ id: string; full_name: string; email: string; role: string }> {
  return request('/org/professors', token, { method: 'POST', body: JSON.stringify(data) })
}

// ── Professor assignment ──────────────────────────────────────────────────────

export function assignProfessor(token: string, universityId: string, professorId: string): Promise<{ id: string; full_name: string; university_id: string }> {
  return request(`/org/universities/${universityId}/professors/${professorId}`, token, { method: 'POST' })
}

// ── User-to-university reassignment (super_admin) ─────────────────────────────

export function assignUserUniversity(
  token: string,
  userId: string,
  universityId: string | null,
): Promise<{ id: string; full_name: string; email: string; role: string; university_id: string | null }> {
  return request(`/org/users/${userId}/university`, token, {
    method: 'PUT',
    body: JSON.stringify({ university_id: universityId }),
  })
}

// ── University join requests ──────────────────────────────────────────────────

export interface JoinRequestOut {
  id: string
  professor_id: string
  professor_name: string | null
  university_id: string
  university_name: string | null
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export function submitJoinRequest(token: string, data: { university_id: string; note?: string }): Promise<JoinRequestOut> {
  return request<JoinRequestOut>('/org/join-requests', token, { method: 'POST', body: JSON.stringify(data) })
}

export function listJoinRequests(token: string): Promise<JoinRequestOut[]> {
  return request<JoinRequestOut[]>('/org/join-requests', token)
}

export function reviewJoinRequest(token: string, requestId: string, action: 'approve' | 'reject'): Promise<JoinRequestOut> {
  return request<JoinRequestOut>(`/org/join-requests/${requestId}/review`, token, { method: 'PUT', body: JSON.stringify({ action }) })
}

export function cancelJoinRequest(token: string, requestId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/org/join-requests/${requestId}`, token, { method: 'DELETE' })
}

const API_BASE = 'http://localhost:8000/api'

export interface RegionOut {
  id: string
  name: string
  code: string | null
  created_by: string | null
  created_at: string
  university_count: number
}

export interface UniversityOut {
  id: string
  name: string
  region_id: string
  region_name: string | null
  created_by: string | null
  created_at: string
}

export interface CreateAdminRequest {
  full_name: string
  email: string
  password: string
  region_id?: string
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

// ── Regions ──────────────────────────────────────────────────────────────────

export function listRegions(token: string): Promise<RegionOut[]> {
  return request<RegionOut[]>('/org/regions', token)
}

export function createRegion(token: string, data: { name: string; code?: string }): Promise<RegionOut> {
  return request<RegionOut>('/org/regions', token, { method: 'POST', body: JSON.stringify(data) })
}

export function deleteRegion(token: string, regionId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/org/regions/${regionId}`, token, { method: 'DELETE' })
}

// ── Universities ──────────────────────────────────────────────────────────────

export function listUniversities(token: string, regionId?: string): Promise<UniversityOut[]> {
  const qs = regionId ? `?region_id=${regionId}` : ''
  return request<UniversityOut[]>(`/org/universities${qs}`, token)
}

export function createUniversity(token: string, data: { name: string; region_id: string }): Promise<UniversityOut> {
  return request<UniversityOut>('/org/universities', token, { method: 'POST', body: JSON.stringify(data) })
}

export function deleteUniversity(token: string, universityId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/org/universities/${universityId}`, token, { method: 'DELETE' })
}

// ── Admin creation ────────────────────────────────────────────────────────────

export function createRegionalAdmin(token: string, data: CreateAdminRequest): Promise<{ id: string; full_name: string; email: string; role: string }> {
  return request('/org/admins/regional', token, { method: 'POST', body: JSON.stringify(data) })
}

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

import type { CourseOut } from './course'

const API_BASE = 'http://localhost:8000/api'

export interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  university_id: string | null
  region_id: string | null
  created_at: string
}

export interface PlatformStats {
  total_users: number
  total_students: number
  total_professors: number
  total_university_admins: number
  total_regional_admins: number
  total_super_admins: number
  total_admins: number
  total_courses: number
  published_courses: number
  total_enrollments: number
}

// Role display helpers
export const ROLE_LABELS: Record<string, string> = {
  student:          'Student',
  professor:        'Professor',
  university_admin: 'Univ. Admin',
  regional_admin:   'Regional Admin',
  super_admin:      'Super Admin',
}

export const ALL_ROLES = ['student', 'professor', 'university_admin', 'regional_admin', 'super_admin'] as const

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getStats(token: string): Promise<PlatformStats> {
  return request<PlatformStats>('/admin/stats', token)
}

export function listUsers(token: string, role?: string, search?: string): Promise<AdminUser[]> {
  const params = new URLSearchParams()
  if (role) params.set('role', role)
  if (search) params.set('search', search)
  const qs = params.toString()
  return request<AdminUser[]>(`/admin/users${qs ? `?${qs}` : ''}`, token)
}

export function changeUserRole(token: string, userId: string, role: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}/role`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

export function deleteUser(token: string, userId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/admin/users/${userId}`, token, { method: 'DELETE' })
}

export function listAllCourses(token: string, categoryId?: string): Promise<CourseOut[]> {
  const qs = categoryId ? `?category_id=${categoryId}` : ''
  return request<CourseOut[]>(`/admin/courses${qs}`, token)
}

export function adminTogglePublish(token: string, courseId: string): Promise<CourseOut> {
  return request<CourseOut>(`/admin/courses/${courseId}/publish`, token, { method: 'PATCH' })
}

export function adminDeleteCourse(token: string, courseId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/admin/courses/${courseId}`, token, { method: 'DELETE' })
}

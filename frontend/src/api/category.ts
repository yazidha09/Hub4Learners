const API_BASE = 'http://localhost:8000/api'

export interface CategoryOut {
  id: string
  name: string
  description?: string
  icon: string
  order_index: number
  course_count: number
  created_at: string
}

async function req<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
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

export function listCategories(): Promise<CategoryOut[]> {
  return req<CategoryOut[]>('/categories')
}

export function createCategory(
  token: string,
  data: { name: string; description?: string },
): Promise<CategoryOut> {
  return req<CategoryOut>('/categories', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateCategory(
  token: string,
  categoryId: string,
  data: { name?: string; description?: string; icon?: string },
): Promise<CategoryOut> {
  return req<CategoryOut>(`/categories/${categoryId}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteCategory(
  token: string,
  categoryId: string,
): Promise<{ detail: string }> {
  return req<{ detail: string }>(`/categories/${categoryId}`, token, { method: 'DELETE' })
}

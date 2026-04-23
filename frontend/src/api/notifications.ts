const API_BASE = 'http://localhost:8000/api'

export interface NotificationData {
  id: string
  type: string
  title: string
  body: string
  meta?: Record<string, string> | null
  is_read: boolean
  created_at: string
}

export async function getNotifications(token: string): Promise<NotificationData[]> {
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch notifications')
  return res.json()
}

export async function markAllRead(token: string): Promise<void> {
  await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function markOneRead(token: string, id: string): Promise<void> {
  await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function deleteNotification(token: string, id: string): Promise<void> {
  await fetch(`${API_BASE}/notifications/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function clearAllNotifications(token: string): Promise<void> {
  await fetch(`${API_BASE}/notifications/clear-all`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

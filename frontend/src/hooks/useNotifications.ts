import { useEffect, useState, useCallback, useRef } from 'react'
import {
  getNotifications,
  markAllRead as apiMarkAllRead,
  markOneRead as apiMarkOneRead,
  deleteNotification as apiDelete,
  clearAllNotifications as apiClearAll,
  type NotificationData,
} from '../api/notifications'

export type NotificationType =
  | 'friend_request'
  | 'friend_request_reviewed'
  | 'friend_message'
  | 'enrollment'
  | 'role_changed'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  timestamp: string
  read: boolean
  meta?: Record<string, string> | null
}

const WS_BASE = 'ws://localhost:8000'

function fromData(d: NotificationData): AppNotification {
  return {
    id: d.id,
    type: d.type as NotificationType,
    title: d.title,
    body: d.body,
    timestamp: d.created_at,
    read: d.is_read,
    meta: d.meta ?? undefined,
  }
}

export function useNotifications(userId: string | undefined, token: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const unreadCount = notifications.filter(n => !n.read).length

  // Initial load from DB
  useEffect(() => {
    if (!userId || !token) return
    getNotifications(token)
      .then(data => setNotifications(data.map(fromData)))
      .catch(() => {})
  }, [userId, token])

  // WebSocket for real-time delivery
  useEffect(() => {
    if (!userId || !token) return
    let active = true

    function connect() {
      if (!active || !userId || !token) return
      const ws = new WebSocket(`${WS_BASE}/ws/notifications/${userId}?token=${token}`)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const data: NotificationData = JSON.parse(e.data)
          const notif = fromData(data)
          setNotifications(prev => {
            if (prev.some(n => n.id === notif.id)) return prev
            return [notif, ...prev].slice(0, 100)
          })
        } catch {}
      }

      ws.onclose = () => {
        if (active) {
          reconnectTimerRef.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      active = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [userId, token])

  const markAllRead = useCallback(async () => {
    if (!token) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    try { await apiMarkAllRead(token) } catch {}
  }, [token])

  const markOneRead = useCallback(async (id: string) => {
    if (!token) return
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try { await apiMarkOneRead(token, id) } catch {}
  }, [token])

  const dismiss = useCallback(async (id: string) => {
    if (!token) return
    setNotifications(prev => prev.filter(n => n.id !== id))
    try { await apiDelete(token, id) } catch {}
  }, [token])

  const clearAll = useCallback(async () => {
    if (!token) return
    setNotifications([])
    try { await apiClearAll(token) } catch {}
  }, [token])

  return { notifications, unreadCount, markAllRead, markOneRead, dismiss, clearAll }
}

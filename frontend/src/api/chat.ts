const API_BASE = 'http://localhost:8000/api'

export interface ChatRequestOut {
  id: string
  student_id: string
  student_full_name: string
  professor_id: string
  professor_full_name: string
  message: string | null
  status: 'pending' | 'accepted' | 'refused' | 'closed'
  created_at: string
  reviewed_at: string | null
}

export interface MessageOut {
  id: string
  chat_request_id: string
  sender_id: string
  sender_full_name: string
  content: string
  created_at: string
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export function sendChatRequest(
  token: string,
  professor_id: string,
  message?: string,
): Promise<ChatRequestOut> {
  return request<ChatRequestOut>(`${API_BASE}/chat/request`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ professor_id, message: message || null }),
  })
}

export function getMyChatRequests(token: string): Promise<ChatRequestOut[]> {
  return request<ChatRequestOut[]>(`${API_BASE}/chat/my-requests`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function getIncomingChatRequests(token: string): Promise<ChatRequestOut[]> {
  return request<ChatRequestOut[]>(`${API_BASE}/chat/incoming`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function reviewChatRequest(
  token: string,
  requestId: string,
  action: 'accept' | 'refuse',
): Promise<ChatRequestOut> {
  return request<ChatRequestOut>(`${API_BASE}/chat/requests/${requestId}/review`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

export function getAutoRefuse(token: string): Promise<{ auto_refuse: boolean }> {
  return request<{ auto_refuse: boolean }>(`${API_BASE}/chat/auto-refuse`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function setAutoRefuse(token: string, auto_refuse: boolean): Promise<{ auto_refuse: boolean }> {
  return request<{ auto_refuse: boolean }>(`${API_BASE}/chat/auto-refuse`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ auto_refuse }),
  })
}

export function sendMessage(token: string, requestId: string, content: string): Promise<MessageOut> {
  return request<MessageOut>(`${API_BASE}/chat/requests/${requestId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export function getMessages(token: string, requestId: string): Promise<MessageOut[]> {
  return request<MessageOut[]>(`${API_BASE}/chat/requests/${requestId}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function closeChatRoom(token: string, requestId: string): Promise<ChatRequestOut> {
  return request<ChatRequestOut>(`${API_BASE}/chat/requests/${requestId}/close`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

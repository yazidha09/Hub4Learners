const BASE = 'http://localhost:8000/api'

export interface UserSearchResult {
  id: string
  full_name: string
  role: string
  profile_image: string | null
  university_name: string | null
}

export interface FriendRequestOut {
  id: string
  requester_id: string
  requester_full_name: string
  requester_profile_image: string | null
  requestee_id: string
  requestee_full_name: string
  requestee_profile_image: string | null
  status: string
  created_at: string
  reviewed_at: string | null
}

export interface FriendOut {
  friendship_id: string
  friend_id: string
  full_name: string
  role: string
  profile_image: string | null
  university_name: string | null
  status: string
}

export interface FriendMessageOut {
  id: string
  friendship_id: string
  sender_id: string
  sender_full_name: string
  sender_profile_image: string | null
  content: string | null
  media_url: string | null
  media_type: string | null
  media_name: string | null
  created_at: string
}

async function req<T>(url: string, token: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

export const searchUsers = (token: string, q: string) =>
  req<UserSearchResult[]>(`/friends/search?q=${encodeURIComponent(q)}`, token)

export const sendFriendRequest = (token: string, requestee_id: string) =>
  req<FriendRequestOut>('/friends/request', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestee_id }),
  })

export const getIncomingFriendRequests = (token: string) =>
  req<FriendRequestOut[]>('/friends/requests/incoming', token)

export const getSentFriendRequests = (token: string) =>
  req<FriendRequestOut[]>('/friends/requests/sent', token)

export const reviewFriendRequest = (token: string, friendshipId: string, action: 'accept' | 'block') =>
  req<FriendRequestOut>(`/friends/requests/${friendshipId}/review`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })

export const cancelFriendRequest = (token: string, friendshipId: string) =>
  req<{ ok: boolean }>(`/friends/requests/${friendshipId}`, token, { method: 'DELETE' })

export const listFriends = (token: string) =>
  req<FriendOut[]>('/friends/list', token)

export const unfriendFriend = (token: string, friendshipId: string) =>
  req<{ ok: boolean }>(`/friends/${friendshipId}`, token, { method: 'DELETE' })

export const getFriendMessages = (token: string, friendshipId: string) =>
  req<FriendMessageOut[]>(`/friends/${friendshipId}/messages`, token)

export const sendFriendMessage = (token: string, friendshipId: string, content: string) =>
  req<FriendMessageOut>(`/friends/${friendshipId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

export const sendFriendMedia = async (
  token: string,
  friendshipId: string,
  file: File,
  caption?: string,
): Promise<FriendMessageOut> => {
  const form = new FormData()
  form.append('file', file)
  if (caption) form.append('caption', caption)
  const res = await fetch(`${BASE}/friends/${friendshipId}/messages/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Error ${res.status}`)
  }
  return res.json()
}

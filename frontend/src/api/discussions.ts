const API_BASE = 'http://localhost:8000/api'

export type DiscussionSort = 'relevant' | 'top' | 'new' | 'old'

export interface DiscussionAuthor {
  id: string
  full_name: string
  profile_image?: string | null
  role: string
}

export interface DiscussionPostOut {
  id: string
  subsection_id: string
  parent_post_id?: string | null
  content: string
  is_deleted: boolean
  edited_at?: string | null
  upvote_count: number
  reply_count: number
  has_voted: boolean
  is_owner: boolean
  is_instructor: boolean
  author: DiscussionAuthor
  created_at: string
  replies: DiscussionPostOut[]
}

export interface DiscussionListOut {
  posts: DiscussionPostOut[]
  total: number
  has_more: boolean
}

export interface DiscussionSummaryOut {
  subsection_id: string
  summary_md: string | null
  generated_at: string | null
  post_count_at_gen: number
  is_stale: boolean
  can_generate: boolean
}

export interface DiscussionVoteOut {
  post_id: string
  has_voted: boolean
  upvote_count: number
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export function listDiscussionPosts(
  token: string,
  subsectionId: string,
  sort: DiscussionSort = 'relevant',
  limit = 20,
  offset = 0,
): Promise<DiscussionListOut> {
  return request(
    `/discussions/subsections/${subsectionId}?sort=${sort}&limit=${limit}&offset=${offset}`,
    token,
  )
}

export function createDiscussionPost(
  token: string,
  subsectionId: string,
  content: string,
): Promise<DiscussionPostOut> {
  return request(`/discussions/subsections/${subsectionId}`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export function replyToDiscussionPost(
  token: string,
  postId: string,
  content: string,
): Promise<DiscussionPostOut> {
  return request(`/discussions/${postId}/replies`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export function editDiscussionPost(
  token: string,
  postId: string,
  content: string,
): Promise<DiscussionPostOut> {
  return request(`/discussions/${postId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export function deleteDiscussionPost(token: string, postId: string): Promise<void> {
  return request(`/discussions/${postId}`, token, { method: 'DELETE' })
}

export function toggleDiscussionVote(
  token: string,
  postId: string,
): Promise<DiscussionVoteOut> {
  return request(`/discussions/${postId}/vote`, token, { method: 'POST' })
}

export function reportDiscussionPost(
  token: string,
  postId: string,
  reason?: string,
): Promise<{ detail: string }> {
  return request(`/discussions/${postId}/report`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason ?? null }),
  })
}

export function getDiscussionSummary(
  token: string,
  subsectionId: string,
): Promise<DiscussionSummaryOut> {
  return request(`/discussions/subsections/${subsectionId}/summary`, token)
}

export function regenerateDiscussionSummary(
  token: string,
  subsectionId: string,
): Promise<DiscussionSummaryOut> {
  return request(`/discussions/subsections/${subsectionId}/summary/regenerate`, token, {
    method: 'POST',
  })
}

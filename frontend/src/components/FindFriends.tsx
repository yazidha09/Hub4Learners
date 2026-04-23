import { useState, useEffect, useRef } from 'react'
import {
  searchUsers,
  sendFriendRequest,
  getIncomingFriendRequests,
  getSentFriendRequests,
  reviewFriendRequest,
  cancelFriendRequest,
  type UserSearchResult,
  type FriendRequestOut,
} from '../api/friends'

const MEDIA_BASE = 'http://localhost:8000'

interface FindFriendsProps {
  token: string
}

type Tab = 'search' | 'incoming' | 'sent'

function Avatar({ name, image }: { name: string; image?: string | null }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  if (image) {
    return <img src={`${MEDIA_BASE}${image}`} className="w-11 h-11 rounded-xl object-cover shrink-0" alt={name} />
  }
  return (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF5533] to-[#ff7a5c] flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
      role === 'professor'
        ? 'bg-violet-50 text-violet-600 border-violet-200'
        : 'bg-blue-50 text-blue-600 border-blue-200'
    }`}>
      {role === 'professor' ? 'Professor' : 'Student'}
    </span>
  )
}

export default function FindFriends({ token }: FindFriendsProps) {
  const [tab, setTab] = useState<Tab>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [incoming, setIncoming] = useState<FriendRequestOut[]>([])
  const [sent, setSent] = useState<FriendRequestOut[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRequests = async () => {
    setLoadingRequests(true)
    try {
      const [inc, snt] = await Promise.all([
        getIncomingFriendRequests(token),
        getSentFriendRequests(token),
      ])
      setIncoming(inc)
      setSent(snt)
      setSentIds(new Set(snt.map(r => r.requestee_id)))
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchUsers(token, searchQuery)
        setSearchResults(data)
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [searchQuery])

  const handleAddFriend = async (userId: string) => {
    setActionLoading(userId)
    setErr('')
    try {
      await sendFriendRequest(token, userId)
      setSentIds(prev => new Set([...prev, userId]))
      await fetchRequests()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReview = async (friendshipId: string, action: 'accept' | 'block') => {
    setActionLoading(friendshipId)
    setErr('')
    try {
      await reviewFriendRequest(token, friendshipId, action)
      await fetchRequests()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancel = async (friendshipId: string) => {
    setActionLoading(friendshipId)
    setErr('')
    try {
      await cancelFriendRequest(token, friendshipId)
      await fetchRequests()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setActionLoading(null)
    }
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'search', label: 'Find People' },
    { id: 'incoming', label: 'Incoming', count: incoming.length },
    { id: 'sent', label: 'Sent', count: sent.length },
  ]

  return (
    <div className="max-w-[640px]">

      {/* Tab bar */}
      <div className="flex items-center gap-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setErr('') }}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-none cursor-pointer ${
              tab === t.id
                ? 'bg-[#0C0C0F] text-white'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-200'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                tab === t.id ? 'bg-white/20 text-white' : 'bg-[#FF5533] text-white'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {err && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{err}</div>
      )}

      {/* ── Search tab ── */}
      {tab === 'search' && (
        <div>
          <div className="relative mb-5">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name to find friends…"
              className="w-full h-11 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
            />
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            {searching && (
              <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
          </div>

          {!searchQuery.trim() && (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-400">Search for students or professors</p>
              <p className="text-xs text-slate-300 mt-1">Type at least 2 characters</p>
            </div>
          )}

          {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm text-slate-400">No users found for "<span className="font-medium">{searchQuery}</span>"</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(u => {
                const alreadySent = sentIds.has(u.id)
                return (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                    <Avatar name={u.full_name} image={u.profile_image} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">{u.full_name}</p>
                        <RoleBadge role={u.role} />
                      </div>
                      {u.university_name && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{u.university_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => !alreadySent && handleAddFriend(u.id)}
                      disabled={actionLoading === u.id || alreadySent}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border-none cursor-pointer transition-all shrink-0 ${
                        alreadySent
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : 'bg-[#0C0C0F] text-white hover:bg-[#1E1E23] disabled:bg-slate-200 disabled:cursor-not-allowed'
                      }`}
                    >
                      {actionLoading === u.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : alreadySent ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Sent
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                          </svg>
                          Add Friend
                        </>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Incoming requests ── */}
      {tab === 'incoming' && (
        <div>
          {loadingRequests ? (
            <div className="flex justify-center py-12">
              <svg className="w-5 h-5 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : incoming.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No incoming requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {incoming.map(req => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl">
                  <Avatar name={req.requester_full_name} image={req.requester_profile_image} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{req.requester_full_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">wants to be your friend</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleReview(req.id, 'accept')}
                      disabled={actionLoading === req.id}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'block')}
                      disabled={actionLoading === req.id}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 text-xs font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sent requests ── */}
      {tab === 'sent' && (
        <div>
          {loadingRequests ? (
            <div className="flex justify-center py-12">
              <svg className="w-5 h-5 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : sent.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-slate-400">No pending sent requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sent.map(req => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-200 rounded-xl">
                  <Avatar name={req.requestee_full_name} image={req.requestee_profile_image} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{req.requestee_full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <p className="text-[11px] text-amber-500 font-medium">Pending</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancel(req.id)}
                    disabled={actionLoading === req.id}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 text-xs font-semibold rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

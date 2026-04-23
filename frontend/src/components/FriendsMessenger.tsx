import { useState, useEffect, useRef } from 'react'
import { listFriends, getFriendMessages, unfriendFriend, type FriendOut, type FriendMessageOut } from '../api/friends'
import FriendChat from './FriendChat'

const MEDIA_BASE = 'http://localhost:8000'

interface FriendsMessengerProps {
  token: string
  currentUserId: string
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  if (image) {
    return <img src={`${MEDIA_BASE}${image}`} className="w-10 h-10 rounded-xl object-cover shrink-0" alt={name} />
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5533] to-[#ff7a5c] flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

function formatPreviewTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function FriendsMessenger({ token, currentUserId }: FriendsMessengerProps) {
  const [friends, setFriends] = useState<FriendOut[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<FriendOut | null>(null)
  const [previews, setPreviews] = useState<Record<string, FriendMessageOut | null>>({})
  const [searchQ, setSearchQ] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [confirmUnfriendId, setConfirmUnfriendId] = useState<string | null>(null)
  const [unfriending, setUnfriending] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const fetchFriends = () =>
    listFriends(token)
      .then(data => {
        setFriends(data)
        data.forEach(f => {
          getFriendMessages(token, f.friendship_id)
            .then(msgs => {
              setPreviews(prev => ({ ...prev, [f.friendship_id]: msgs[msgs.length - 1] ?? null }))
            })
            .catch(() => {})
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => {
    fetchFriends()
  }, [token])

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleUnfriend = async (friendshipId: string) => {
    setUnfriending(true)
    try {
      await unfriendFriend(token, friendshipId)
      setFriends(prev => prev.filter(f => f.friendship_id !== friendshipId))
      if (selected?.friendship_id === friendshipId) setSelected(null)
      setConfirmUnfriendId(null)
      setMenuOpenId(null)
    } catch {
      // silently ignore
    } finally {
      setUnfriending(false)
    }
  }

  const filtered = friends.filter(f =>
    f.full_name.toLowerCase().includes(searchQ.toLowerCase())
  )

  const getPreviewText = (f: FriendOut): string => {
    const msg = previews[f.friendship_id]
    if (!msg) return 'No messages yet'
    if (msg.media_type === 'image') return '📷 Photo'
    if (msg.media_type === 'file') return `📎 ${msg.media_name || 'File'}`
    return msg.content || ''
  }

  return (
    <div
      className="relative flex bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
      style={{ height: 'calc(100vh - 140px)', minHeight: '560px' }}
    >
      {/* ── Left sidebar ── */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-slate-100">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[1.05rem] font-bold text-[#0C0C0F]">Messages</h2>
            <span className="text-[0.7rem] text-slate-400 font-medium">{friends.length} friend{friends.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search friends…"
              className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-[0.8rem] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-300 focus:bg-white transition-all"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-5 h-5 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-2">
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-[0.78rem] font-medium text-slate-400">
                {searchQ ? 'No results' : 'No friends yet'}
              </p>
              {!searchQ && (
                <p className="text-[0.7rem] text-slate-300 mt-0.5">Use "Find Friends" to add people</p>
              )}
            </div>
          ) : (
            filtered.map(f => {
              const isActive = selected?.friendship_id === f.friendship_id
              const isHovered = hoveredId === f.friendship_id
              const menuOpen = menuOpenId === f.friendship_id
              const confirmOpen = confirmUnfriendId === f.friendship_id
              const preview = getPreviewText(f)
              const lastMsg = previews[f.friendship_id]

              return (
                <div
                  key={f.friendship_id}
                  className="relative"
                  onMouseEnter={() => setHoveredId(f.friendship_id)}
                  onMouseLeave={() => { setHoveredId(null); if (!menuOpen) {} }}
                >
                  {/* Confirm unfriend overlay */}
                  {confirmOpen && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 backdrop-blur-sm px-3">
                      <div className="text-center">
                        <p className="text-[0.78rem] font-semibold text-slate-800 mb-2">Remove {f.full_name.split(' ')[0]}?</p>
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleUnfriend(f.friendship_id)}
                            disabled={unfriending}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[0.72rem] font-semibold rounded-lg border-none cursor-pointer disabled:opacity-60 transition-colors"
                          >
                            {unfriending ? '…' : 'Unfriend'}
                          </button>
                          <button
                            onClick={() => setConfirmUnfriendId(null)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[0.72rem] font-semibold rounded-lg border-none cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={`w-full flex items-center gap-3 px-4 py-3 cursor-pointer transition-all select-none ${
                      isActive
                        ? 'bg-[#0C0C0F]'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => { setSelected(f); setMenuOpenId(null) }}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={f.full_name} image={f.profile_image} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-[0.82rem] font-semibold truncate ${isActive ? 'text-white' : 'text-slate-900'}`}>
                          {f.full_name}
                        </p>
                        {lastMsg && !isHovered && (
                          <span className={`text-[0.65rem] shrink-0 ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                            {formatPreviewTime(lastMsg.created_at)}
                          </span>
                        )}
                      </div>
                      <p className={`text-[0.72rem] truncate mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                        {preview}
                      </p>
                    </div>

                    {/* Three-dot menu button — visible on hover */}
                    {isHovered && !confirmOpen && (
                      <div
                        ref={menuOpen ? menuRef : null}
                        className="relative shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setMenuOpenId(menuOpen ? null : f.friendship_id)}
                          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all border-none cursor-pointer ${
                            isActive
                              ? 'text-white/70 hover:text-white hover:bg-white/10 bg-transparent'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 bg-transparent'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                          </svg>
                        </button>

                        {/* Dropdown */}
                        {menuOpen && (
                          <div
                            ref={menuRef}
                            className="absolute right-0 top-8 z-30 w-36 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                          >
                            <button
                              onClick={() => { setConfirmUnfriendId(f.friendship_id); setMenuOpenId(null) }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-[0.78rem] font-semibold text-red-600 hover:bg-red-50 border-none bg-transparent cursor-pointer transition-colors"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="22" y1="18" x2="16" y2="18" />
                              </svg>
                              Unfriend
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right panel — chat ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <FriendChat
            token={token}
            friendshipId={selected.friendship_id}
            currentUserId={currentUserId}
            friendName={selected.full_name}
            friendImage={selected.profile_image}
            onBack={() => setSelected(null)}
            onUnfriend={() => {
              setConfirmUnfriendId(selected.friendship_id)
            }}
            embedded
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shadow-sm">
              <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-[0.95rem] font-semibold text-slate-500">Select a conversation</p>
              <p className="text-[0.78rem] text-slate-300 mt-1">Choose a friend from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Full-screen unfriend confirm when triggered from chat header */}
      {confirmUnfriendId && selected?.friendship_id === confirmUnfriendId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 rounded-2xl">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-72 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" /><line x1="22" y1="18" x2="16" y2="18" />
              </svg>
            </div>
            <p className="text-[0.92rem] font-bold text-slate-900 mb-1">Remove {selected.full_name.split(' ')[0]}?</p>
            <p className="text-[0.78rem] text-slate-400 mb-5">You'll lose your chat history with them.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmUnfriendId(null)}
                className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[0.82rem] font-semibold border-none cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnfriend(confirmUnfriendId)}
                disabled={unfriending}
                className="flex-1 h-9 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[0.82rem] font-semibold border-none cursor-pointer disabled:opacity-60 transition-colors"
              >
                {unfriending ? '…' : 'Unfriend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

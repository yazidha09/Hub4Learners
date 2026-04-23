import { useState, useEffect, useRef } from 'react'
import {
  getFriendMessages,
  sendFriendMessage,
  sendFriendMedia,
  type FriendMessageOut,
} from '../api/friends'

const MEDIA_BASE = 'http://localhost:8000'
const WS_BASE = 'ws://localhost:8000'
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

interface FriendChatProps {
  token: string
  friendshipId: string
  currentUserId: string
  friendName: string
  friendImage: string | null
  onBack: () => void
  onUnfriend?: () => void
  embedded?: boolean
}

export default function FriendChat({
  token,
  friendshipId,
  currentUserId,
  friendName,
  friendImage,
  onBack,
  onUnfriend,
  embedded = false,
}: FriendChatProps) {
  const [messages, setMessages] = useState<FriendMessageOut[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [uploadErr, setUploadErr] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  const fetchMessages = async () => {
    try {
      const data = await getFriendMessages(token, friendshipId)
      setMessages(data)
    } catch {
      // silently ignore poll errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()

    const ws = new WebSocket(`${WS_BASE}/ws/friends/${friendshipId}?token=${encodeURIComponent(token)}`)

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as FriendMessageOut
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      } catch { /* ignore malformed frames */ }
    }

    let fallbackInterval: ReturnType<typeof setInterval> | null = null
    ws.onerror = () => {
      fallbackInterval = setInterval(fetchMessages, 3000)
    }

    return () => {
      ws.close()
      if (fallbackInterval) clearInterval(fallbackInterval)
    }
  }, [friendshipId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr('')
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.docx', '.txt', '.zip', '.xlsx', '.pptx']
    if (!allowed.includes(ext)) {
      setUploadErr('Unsupported file type')
      return
    }
    setMediaFile(file)
    if (IMAGE_EXTS.includes(ext)) {
      const reader = new FileReader()
      reader.onload = ev => setMediaPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setMediaPreview(null)
    }
    e.target.value = ''
  }

  const clearMedia = () => {
    setMediaFile(null)
    setMediaPreview(null)
    setUploadErr('')
  }

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && !mediaFile) || sending) return
    setSending(true)
    try {
      let msg: FriendMessageOut
      if (mediaFile) {
        msg = await sendFriendMedia(token, friendshipId, mediaFile, text || undefined)
        clearMedia()
      } else {
        msg = await sendFriendMessage(token, friendshipId, text)
      }
      setMessages(prev => [...prev, msg])
      setInput('')
      setTimeout(scrollToBottom, 50)
    } catch (e: any) {
      setUploadErr(e.message || 'Failed to send')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return 'Today'
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const grouped: { date: string; msgs: FriendMessageOut[] }[] = []
  messages.forEach(m => {
    const label = formatDate(m.created_at)
    if (!grouped.length || grouped[grouped.length - 1].date !== label) {
      grouped.push({ date: label, msgs: [m] })
    } else {
      grouped[grouped.length - 1].msgs.push(m)
    }
  })

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={`flex flex-col ${embedded ? 'h-full' : 'h-[calc(100vh-180px)] min-h-[500px] max-w-[760px]'} animate-fadeIn`}>

      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 bg-white shrink-0 ${embedded ? 'border-b border-slate-100' : 'border border-slate-200 rounded-t-2xl shadow-sm'}`}>
        {!embedded && (
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 border-none bg-transparent cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {friendImage ? (
          <img
            src={`${MEDIA_BASE}${friendImage}`}
            className="w-9 h-9 rounded-xl object-cover shrink-0"
            alt={friendName}
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5533] to-[#ff7a5c] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials(friendName)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-none truncate">{friendName}</p>
          <p className="text-xs text-emerald-500 mt-0.5 font-medium">Friend</p>
        </div>

        {onUnfriend && (
          <button
            onClick={onUnfriend}
            title="Unfriend"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border-none bg-transparent cursor-pointer shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" /><line x1="22" y1="18" x2="16" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className={`flex-1 overflow-y-auto px-5 py-4 bg-[#F8F9FB] space-y-1 ${embedded ? '' : 'border-x border-slate-200'}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-6 h-6 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-slate-400">Loading messages…</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF5533]/10 to-[#FF5533]/5 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#FF5533]/60" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">No messages yet</p>
            <p className="text-xs text-slate-400">Say hello to {friendName}!</p>
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">{group.date}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {group.msgs.map((msg, idx) => {
                const isMe = msg.sender_id === currentUserId
                const prevMsg = idx > 0 ? group.msgs[idx - 1] : null
                const sameAsPrev = prevMsg?.sender_id === msg.sender_id

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${sameAsPrev ? 'mt-1' : 'mt-3'}`}>
                    <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {!sameAsPrev && (
                        <span className="text-[10px] font-semibold text-slate-400 mb-1 px-1">
                          {isMe ? 'You' : msg.sender_full_name}
                        </span>
                      )}

                      {/* Media bubble */}
                      {msg.media_url && (
                        <div className={`mb-1 rounded-2xl overflow-hidden ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                          {msg.media_type === 'image' ? (
                            <a href={`${MEDIA_BASE}${msg.media_url}`} target="_blank" rel="noopener noreferrer">
                              <img
                                src={`${MEDIA_BASE}${msg.media_url}`}
                                className="max-w-[260px] max-h-[220px] object-cover rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                                alt={msg.media_name || 'image'}
                              />
                            </a>
                          ) : (
                            <a
                              href={`${MEDIA_BASE}${msg.media_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm no-underline transition-all duration-200 ${
                                isMe
                                  ? 'bg-[#0C0C0F] text-white border-transparent hover:bg-[#1E1E23] rounded-br-sm'
                                  : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50 rounded-bl-sm shadow-sm'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-white/10' : 'bg-slate-100'}`}>
                                <svg className={`w-4 h-4 ${isMe ? 'text-white/80' : 'text-slate-500'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className={`text-xs font-medium truncate max-w-[160px] ${isMe ? 'text-white' : 'text-slate-900'}`}>
                                  {msg.media_name || 'File'}
                                </p>
                                <p className={`text-[10px] ${isMe ? 'text-white/60' : 'text-slate-400'}`}>Download</p>
                              </div>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Text bubble */}
                      {msg.content && (
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                          isMe
                            ? 'bg-[#0C0C0F] text-white rounded-br-sm'
                            : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm shadow-sm'
                        }`}>
                          {msg.content}
                        </div>
                      )}

                      <span className="text-[10px] text-slate-400 mt-1 px-1">{formatTime(msg.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Media preview bar */}
      {mediaFile && (
        <div className={`px-4 py-2 bg-white flex items-center gap-3 shrink-0 ${embedded ? 'border-t border-slate-100' : 'border-x border-slate-200'}`}>
          {mediaPreview ? (
            <img src={mediaPreview} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="preview" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-800 truncate">{mediaFile.name}</p>
            <p className="text-[10px] text-slate-400">{(mediaFile.size / 1024).toFixed(1)} KB</p>
          </div>
          <button
            onClick={clearMedia}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border-none bg-transparent cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error bar */}
      {uploadErr && (
        <div className={`px-4 py-2 bg-red-50 text-xs text-red-600 shrink-0 ${embedded ? 'border-t border-red-100' : 'border-x border-red-200'}`}>{uploadErr}</div>
      )}

      {/* Input area */}
      <div className={`px-4 py-3 bg-white shrink-0 ${embedded ? 'border-t border-slate-100' : 'border border-slate-200 rounded-b-2xl'}`}>
        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#FF5533] hover:bg-[#FF5533]/5 transition-all border border-slate-200 bg-white shrink-0 cursor-pointer"
            title="Attach file or image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.txt,.zip,.xlsx,.pptx"
            className="hidden"
            onChange={handleFileSelect}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mediaFile ? 'Add a caption… (optional)' : 'Type a message…'}
            rows={1}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 resize-none outline-none focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all duration-200 max-h-32"
            style={{ minHeight: '42px' }}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !mediaFile) || sending}
            className="w-10 h-10 rounded-xl bg-[#0C0C0F] text-white flex items-center justify-center shrink-0 hover:bg-[#1E1E23] disabled:bg-slate-200 disabled:cursor-not-allowed transition-all duration-200 border-none cursor-pointer"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { getMessages, sendMessage, closeChatRoom, type MessageOut } from '../api/chat'

interface ChatRoomProps {
  token: string
  requestId: string
  currentUserId: string
  otherName: string
  initialClosed: boolean
  isProfessor: boolean
  onRoomClosed: () => void
  onBack: () => void
}

export default function ChatRoom({
  token,
  requestId,
  currentUserId,
  otherName,
  initialClosed,
  isProfessor,
  onRoomClosed,
  onBack,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<MessageOut[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [closed, setClosed] = useState(initialClosed)
  const [closing, setClosing] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async () => {
    try {
      const data = await getMessages(token, requestId)
      setMessages(data)
    } catch {
      // silently ignore poll errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [requestId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending || closed) return
    setSending(true)
    try {
      const msg = await sendMessage(token, requestId, text)
      setMessages(prev => [...prev, msg])
      setInput('')
      setTimeout(scrollToBottom, 50)
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

  const handleClose = async () => {
    setClosing(true)
    try {
      await closeChatRoom(token, requestId)
      setClosed(true)
      setConfirmClose(false)
      onRoomClosed()
    } finally {
      setClosing(false)
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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

  // Group messages by date
  const grouped: { date: string; msgs: MessageOut[] }[] = []
  messages.forEach(m => {
    const label = formatDate(m.created_at)
    if (!grouped.length || grouped[grouped.length - 1].date !== label) {
      grouped.push({ date: label, msgs: [m] })
    } else {
      grouped[grouped.length - 1].msgs.push(m)
    }
  })

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[500px] max-w-[760px] animate-fadeIn">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-white border border-slate-200 rounded-t-2xl shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200 border-none bg-transparent cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {otherName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-none">{otherName}</p>
            <p className={`text-xs mt-0.5 font-medium ${closed ? 'text-red-400' : 'text-emerald-500'}`}>
              {closed ? 'Chat closed' : 'Active'}
            </p>
          </div>
        </div>

        {isProfessor && !closed && (
          <div className="flex items-center gap-2">
            {confirmClose ? (
              <>
                <span className="text-xs text-slate-500">Close this chat room?</span>
                <button
                  onClick={handleClose}
                  disabled={closing}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors duration-200"
                >
                  {closing ? 'Closing...' : 'Yes, close'}
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border-none cursor-pointer transition-colors duration-200"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClose(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close room
              </button>
            )}
          </div>
        )}
      </div>

      {/* Closed banner */}
      {closed && (
        <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border-x border-red-200 text-sm text-red-600 shrink-0">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {isProfessor ? 'You closed this chat room. The student can no longer send messages.' : 'The professor has closed this chat room.'}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 bg-[#F8F9FB] border-x border-slate-200 space-y-1">
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
            <div className="w-12 h-12 rounded-2xl bg-slate-200 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-500">No messages yet</p>
            {!closed && <p className="text-xs text-slate-400">Say hello to get the conversation started</p>}
          </div>
        ) : (
          grouped.map(group => (
            <div key={group.date}>
              {/* Date separator */}
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
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                        isMe
                          ? 'bg-[#0C0C0F] text-white rounded-br-sm'
                          : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm shadow-sm'
                      }`}>
                        {msg.content}
                      </div>
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

      {/* Input area */}
      <div className={`px-4 py-3 bg-white border border-slate-200 rounded-b-2xl shrink-0 ${closed ? 'opacity-60' : ''}`}>
        {closed ? (
          <div className="flex items-center justify-center h-10 text-sm text-slate-400">
            This chat room is closed
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 resize-none outline-none focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all duration-200 max-h-32"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
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
        )}
      </div>
    </div>
  )
}

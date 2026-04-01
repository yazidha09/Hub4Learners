import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getCourseDetail, type CourseOut, type MaterialOut, type SectionOut } from '../api/course'

/* ───────── chat message type (prepared for AI) ───────── */
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

/* ───────── icons ───────── */
const Icons = {
  back: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  ),
  pdf: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2z" />
      <polyline strokeLinecap="round" strokeLinejoin="round" points="14 2 14 8 20 8" />
    </svg>
  ),
  video: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <polygon strokeLinecap="round" strokeLinejoin="round" points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  send: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  ),
  ai: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
    </svg>
  ),
  menu: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  chat: (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
}

const BACKEND = 'http://localhost:8000'

export default function CourseLearningPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [course, setCourse] = useState<CourseOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* ── active material ── */
  const [activeMaterial, setActiveMaterial] = useState<MaterialOut | null>(null)
  const [activeSection, setActiveSection] = useState<SectionOut | null>(null)

  /* ── panel visibility (mobile) ── */
  const [showOutline, setShowOutline] = useState(false)
  const [showChat, setShowChat] = useState(true)

  /* ── chat state ── */
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  /* ── fetch course ── */
  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    getCourseDetail(courseId)
      .then((c) => {
        setCourse(c)
        // auto-select first material
        const firstSection = c.sections?.sort((a, b) => a.order_index - b.order_index)[0]
        if (firstSection) {
          setActiveSection(firstSection)
          const firstMat = firstSection.materials?.sort((a, b) => a.order_index - b.order_index)[0]
          if (firstMat) setActiveMaterial(firstMat)
        }
      })
      .catch(() => setError('Failed to load course'))
      .finally(() => setLoading(false))
  }, [courseId])

  /* ── auto-scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTyping])

  /* ── send chat message (placeholder — will connect to RAG API later) ── */
  const sendMessage = () => {
    const text = chatInput.trim()
    if (!text) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setAiTyping(true)

    // Simulated AI response — will be replaced with actual RAG API call
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          "I'm the Hub4Learners AI assistant. I'll be able to answer questions about this course's materials once the RAG system is connected. For now, feel free to take notes here!",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMsg])
      setAiTyping(false)
    }, 1200)
  }

  /* ── select material ── */
  const selectMaterial = (section: SectionOut, material: MaterialOut) => {
    setActiveSection(section)
    setActiveMaterial(material)
    setShowOutline(false) // close outline on mobile
  }

  /* ── material url ── */
  const materialUrl = activeMaterial ? `${BACKEND}/uploads/${activeMaterial.file_url}` : ''

  /* ─────────── loading / error ─────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0C0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#94A3B8] text-[0.82rem]">Loading course…</span>
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-[#0C0C0F] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-[0.88rem] mb-4">{error || 'Course not found'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-[#FF5533] text-white text-[0.82rem] rounded-lg hover:bg-[#E64422] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const sortedSections = [...(course.sections || [])].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="h-screen flex flex-col bg-[#0C0C0F] text-white overflow-hidden">
      {/* ═══════ TOP BAR ═══════ */}
      <header className="h-[52px] min-h-[52px] bg-[#111318] border-b border-[#1E2028] flex items-center px-4 gap-3 z-30">
        {/* mobile outline toggle */}
        <button
          onClick={() => setShowOutline(!showOutline)}
          className="lg:hidden p-1.5 rounded-md hover:bg-[#1E2028] text-[#94A3B8] transition-colors"
        >
          {Icons.menu}
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-[#94A3B8] hover:text-white transition-colors text-[0.82rem]"
        >
          {Icons.back}
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="h-5 w-px bg-[#1E2028]" />

        <h1 className="text-[0.88rem] font-medium text-[#E2E8F0] truncate flex-1">
          {course.title}
        </h1>

        {activeMaterial && (
          <span className="hidden md:inline text-[0.75rem] text-[#64748B] truncate max-w-[200px]">
            {activeMaterial.title}
          </span>
        )}

        {/* mobile chat toggle */}
        <button
          onClick={() => setShowChat(!showChat)}
          className="lg:hidden p-1.5 rounded-md hover:bg-[#1E2028] text-[#94A3B8] transition-colors relative"
        >
          {Icons.chat}
          {messages.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FF5533] rounded-full" />
          )}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ═══════ LEFT: COURSE OUTLINE ═══════ */}
        {/* desktop: always visible; mobile: slide overlay */}
        <aside
          className={`
            ${showOutline ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0
            absolute lg:relative z-20
            w-[280px] min-w-[280px] h-full
            bg-[#111318] border-r border-[#1E2028]
            flex flex-col
            transition-transform duration-200
          `}
        >
          {/* outline header */}
          <div className="px-4 py-3 border-b border-[#1E2028] flex items-center justify-between">
            <h2 className="text-[0.78rem] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Course Outline
            </h2>
            <button
              onClick={() => setShowOutline(false)}
              className="lg:hidden p-1 rounded hover:bg-[#1E2028] text-[#64748B]"
            >
              {Icons.close}
            </button>
          </div>

          {/* sections list */}
          <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {sortedSections.map((section, si) => {
              const sortedMats = [...(section.materials || [])].sort(
                (a, b) => a.order_index - b.order_index,
              )
              return (
                <div key={section.id} className="mb-1">
                  {/* section title */}
                  <div className="px-4 py-2">
                    <span className="text-[0.7rem] font-semibold text-[#64748B] uppercase tracking-wider">
                      Section {si + 1}
                    </span>
                    <p className="text-[0.82rem] text-[#CBD5E1] mt-0.5 leading-tight">
                      {section.title}
                    </p>
                  </div>

                  {/* materials */}
                  {sortedMats.map((mat) => {
                    const isActive = activeMaterial?.id === mat.id
                    return (
                      <button
                        key={mat.id}
                        onClick={() => selectMaterial(section, mat)}
                        className={`
                          w-full text-left px-4 py-2.5 flex items-center gap-2.5
                          transition-all duration-150
                          ${
                            isActive
                              ? 'bg-[#FF5533]/10 border-l-2 border-[#FF5533] text-white'
                              : 'border-l-2 border-transparent text-[#94A3B8] hover:bg-[#1A1D25] hover:text-[#E2E8F0]'
                          }
                        `}
                      >
                        <span
                          className={`flex-shrink-0 ${isActive ? 'text-[#FF5533]' : 'text-[#64748B]'}`}
                        >
                          {mat.type === 'video' ? Icons.video : Icons.pdf}
                        </span>
                        <span className="text-[0.78rem] leading-tight truncate">{mat.title}</span>
                        <span
                          className={`ml-auto text-[0.65rem] uppercase tracking-wider flex-shrink-0 ${isActive ? 'text-[#FF5533]' : 'text-[#475569]'}`}
                        >
                          {mat.type}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {sortedSections.length === 0 && (
              <p className="px-4 py-6 text-[0.82rem] text-[#475569] text-center">
                No sections yet
              </p>
            )}
          </div>
        </aside>

        {/* overlay backdrop (mobile) */}
        {showOutline && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-10"
            onClick={() => setShowOutline(false)}
          />
        )}

        {/* ═══════ CENTER: MATERIAL VIEWER ═══════ */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0C0C0F]">
          {activeMaterial ? (
            <>
              {/* material title bar */}
              <div className="px-5 py-3 border-b border-[#1E2028] bg-[#111318]/60">
                <div className="flex items-center gap-2">
                  <span className="text-[#FF5533]">
                    {activeMaterial.type === 'video' ? Icons.video : Icons.pdf}
                  </span>
                  <h3 className="text-[0.88rem] font-medium text-[#E2E8F0]">
                    {activeMaterial.title}
                  </h3>
                </div>
                {activeSection && (
                  <p className="text-[0.72rem] text-[#64748B] mt-0.5 ml-6">
                    {activeSection.title}
                  </p>
                )}
              </div>

              {/* viewer area */}
              <div className="flex-1 overflow-hidden p-4">
                {activeMaterial.type === 'video' ? (
                  <div className="h-full flex items-center justify-center">
                    <video
                      key={activeMaterial.id}
                      controls
                      className="max-h-full max-w-full rounded-lg shadow-2xl"
                      style={{ maxHeight: 'calc(100vh - 160px)' }}
                    >
                      <source src={materialUrl} />
                      Your browser does not support video playback.
                    </video>
                  </div>
                ) : activeMaterial.type === 'pdf' ? (
                  <iframe
                    key={activeMaterial.id}
                    src={materialUrl}
                    className="w-full h-full rounded-lg border border-[#1E2028]"
                    title={activeMaterial.title}
                  />
                ) : (
                  /* audio or exercise fallback */
                  <div className="h-full flex flex-col items-center justify-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-[#1A1D25] flex items-center justify-center text-[#FF5533]">
                      {Icons.pdf}
                    </div>
                    <p className="text-[0.88rem] text-[#94A3B8]">{activeMaterial.title}</p>
                    <a
                      href={materialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#FF5533] text-white text-[0.82rem] rounded-lg hover:bg-[#E64422] transition-colors"
                    >
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#1A1D25] flex items-center justify-center mx-auto mb-3">
                  {Icons.video}
                </div>
                <p className="text-[0.88rem] text-[#94A3B8]">
                  Select a material from the course outline
                </p>
              </div>
            </div>
          )}
        </main>

        {/* ═══════ RIGHT: AI CHAT PANEL ═══════ */}
        <aside
          className={`
            ${showChat ? 'translate-x-0' : 'translate-x-full'}
            lg:translate-x-0
            absolute lg:relative right-0 z-20
            w-[340px] min-w-[340px] h-full
            bg-[#111318] border-l border-[#1E2028]
            flex flex-col
            transition-transform duration-200
          `}
        >
          {/* chat header */}
          <div className="px-4 py-3 border-b border-[#1E2028] flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF5533] to-[#FF7755] flex items-center justify-center text-white">
              {Icons.ai}
            </div>
            <div className="flex-1">
              <h2 className="text-[0.82rem] font-semibold text-[#E2E8F0]">AI Assistant</h2>
              <p className="text-[0.65rem] text-[#64748B]">Ask about this course material</p>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="lg:hidden p-1 rounded hover:bg-[#1E2028] text-[#64748B]"
            >
              {Icons.close}
            </button>
          </div>

          {/* messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF5533]/20 to-[#FF7755]/10 flex items-center justify-center mb-4">
                  <span className="text-[#FF5533]">{Icons.ai}</span>
                </div>
                <h3 className="text-[0.88rem] font-medium text-[#CBD5E1] mb-1.5">
                  Course AI Assistant
                </h3>
                <p className="text-[0.78rem] text-[#64748B] leading-relaxed max-w-[220px]">
                  Ask questions about the current PDF or video material. The AI is trained on this
                  course's content.
                </p>

                {/* quick prompts */}
                <div className="mt-5 space-y-2 w-full">
                  {[
                    'Summarize this material',
                    'What are the key concepts?',
                    'Explain the main topic',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setChatInput(prompt)
                      }}
                      className="w-full px-3 py-2 text-left text-[0.78rem] text-[#94A3B8] bg-[#1A1D25] rounded-lg hover:bg-[#1E2028] hover:text-[#E2E8F0] transition-colors border border-[#1E2028]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-3.5 py-2.5
                    ${
                      msg.role === 'user'
                        ? 'bg-[#FF5533] text-white rounded-br-md'
                        : 'bg-[#1A1D25] text-[#E2E8F0] border border-[#1E2028] rounded-bl-md'
                    }
                  `}
                >
                  <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  <span
                    className={`block text-[0.6rem] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-[#475569]'}`}
                  >
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* typing indicator */}
            {aiTyping && (
              <div className="flex justify-start">
                <div className="bg-[#1A1D25] border border-[#1E2028] rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* input bar */}
          <div className="px-3 py-3 border-t border-[#1E2028]">
            <div className="flex items-end gap-2 bg-[#1A1D25] rounded-xl border border-[#1E2028] focus-within:border-[#FF5533]/40 transition-colors">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Ask about this material…"
                rows={1}
                className="flex-1 bg-transparent text-[0.82rem] text-[#E2E8F0] placeholder-[#475569] px-3.5 py-2.5 resize-none outline-none max-h-[100px] scrollbar-thin"
                style={{ minHeight: '40px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim() || aiTyping}
                className="p-2 mr-1 mb-1 rounded-lg text-[#FF5533] hover:bg-[#FF5533]/10 disabled:text-[#475569] disabled:hover:bg-transparent transition-colors"
              >
                {Icons.send}
              </button>
            </div>
            <p className="text-[0.6rem] text-[#475569] text-center mt-1.5">
              AI responses are based on course materials only
            </p>
          </div>
        </aside>

        {/* overlay backdrop for chat (mobile) */}
        {showChat && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-10"
            onClick={() => setShowChat(false)}
          />
        )}
      </div>
    </div>
  )
}

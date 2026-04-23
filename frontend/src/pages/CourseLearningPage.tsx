import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
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
  lesson: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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

/* ─────────────────────────────────────────────────────────────────────────────
   Rich content viewer — used for both PDF-extracted text and lesson HTML
   ───────────────────────────────────────────────────────────────────────────── */
function ContentViewer({ html }: { html: string }) {
  return (
    <div className="h-full overflow-y-auto bg-[#0E1014] scrollbar-thin">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <div
          className="
            prose prose-invert max-w-none text-[#CBD5E1] leading-[1.85]

            [&>h2]:text-[1.2rem] [&>h2]:font-bold [&>h2]:text-white
            [&>h2]:mt-10 [&>h2]:mb-4 [&>h2]:pb-2
            [&>h2]:border-b [&>h2]:border-[#FF5533]/30

            [&>h3]:text-[1.05rem] [&>h3]:font-semibold [&>h3]:text-[#E2E8F0]
            [&>h3]:mt-8 [&>h3]:mb-3 [&>h3]:pb-1.5
            [&>h3]:border-b [&>h3]:border-[#1E2028]

            [&>h4]:text-[0.92rem] [&>h4]:font-semibold [&>h4]:text-[#CBD5E1]
            [&>h4]:mt-6 [&>h4]:mb-2

            [&>p]:text-[0.9rem] [&>p]:mb-5 [&>p]:text-[#CBD5E1]

            [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-5 [&>ul]:space-y-1.5
            [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-5 [&>ol]:space-y-1.5
            [&_li]:text-[0.88rem] [&_li]:text-[#94A3B8]

            [&>blockquote]:border-l-[3px] [&>blockquote]:border-[#FF5533]/50
            [&>blockquote]:pl-4 [&>blockquote]:my-5 [&>blockquote]:text-[#64748B] [&>blockquote]:italic

            [&_strong]:text-[#E2E8F0] [&_strong]:font-semibold
            [&_em]:text-[#94A3B8]

            [&_code]:bg-[#1A1D25] [&_code]:text-[#FF5533]
            [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.78rem]
            [&_code]:font-mono [&_code]:border [&_code]:border-[#1E2028]

            [&>pre]:bg-[#111318] [&>pre]:border [&>pre]:border-[#1E2028]
            [&>pre]:rounded-xl [&>pre]:p-5 [&>pre]:my-5 [&>pre]:overflow-x-auto
            [&>pre]:text-[0.8rem] [&>pre]:leading-relaxed
            [&>pre_code]:bg-transparent [&>pre_code]:border-0
            [&>pre_code]:text-[#94A3B8] [&>pre_code]:p-0
          "
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Material reader — fetches text for PDFs, shows HTML for lessons
   ───────────────────────────────────────────────────────────────────────────── */
function MaterialReader({ material, token }: { material: MaterialOut; token: string | null }) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setHtml(null)
    setError('')
    setLoading(true)

    if (material.content_text) {
      setHtml(material.content_text)
      setLoading(false)
      return
    }

    if (material.type === 'pdf') {
      fetch(`http://localhost:8000/api/courses/materials/${material.id}/text`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
        .then(data => setHtml(data.html as string))
        .catch(() => setError('Could not extract text from this PDF.'))
        .finally(() => setLoading(false))
      return
    }

    setLoading(false)
  }, [material.id])

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
        <span className="text-[0.8rem] text-[#475569]">Reading content…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[0.82rem] text-red-400">{error}</p>
      </div>
    )
  }

  if (html) return <ContentViewer html={html} />

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <p className="text-[0.88rem] text-[#94A3B8]">No readable content for this material.</p>
    </div>
  )
}

export default function CourseLearningPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { token, user } = useAuth()
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

  /* ── reindex state (professor only) ── */
  const [reindexing, setReindexing] = useState(false)
  const [reindexMsg, setReindexMsg] = useState('')

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

  /* ── send chat message → Gemini AI via backend ── */
  const sendMessage = async () => {
    const text = chatInput.trim()
    if (!text || aiTyping) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setChatInput('')
    setAiTyping(true)

    // Build history for the API (all previous turns, role mapped to "user"/"assistant")
    const history = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))

    try {
      const res = await fetch('http://localhost:8000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          course_id: courseId,
          message: text,
          history,
        }),
      })
      const data = await res.json()
      const reply: string = res.ok
        ? (data.reply ?? 'No response from AI.')
        : (data.detail ?? 'AI request failed.')

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Could not reach the AI. Check your connection and try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setAiTyping(false)
    }
  }

  /* ── reindex course AI (professor only) ── */
  const handleReindex = async () => {
    if (!courseId || !token || reindexing) return
    setReindexing(true)
    setReindexMsg('')
    try {
      const res = await fetch(`http://localhost:8000/api/ai/reindex/${courseId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        const n = data.chunks_stored ?? 0
        setReindexMsg(n > 0 ? `✓ Indexed ${n} chunks — AI is ready.` : '⚠ No text found in PDFs.')
      } else {
        setReindexMsg(`Error: ${data.detail ?? 'Reindex failed.'}`)
      }
    } catch {
      setReindexMsg('Could not reach the server.')
    } finally {
      setReindexing(false)
    }
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
                          {mat.type === 'video' ? Icons.video : mat.type === 'pdf' ? Icons.pdf : Icons.lesson}
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
                    {activeMaterial.type === 'video' ? Icons.video : activeMaterial.type === 'pdf' ? Icons.pdf : Icons.lesson}
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
              <div className="flex-1 overflow-hidden">
                {activeMaterial.type === 'video' ? (
                  <div className="h-full flex items-center justify-center p-4">
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
                ) : (
                  <MaterialReader
                    key={activeMaterial.id}
                    material={activeMaterial}
                    token={token}
                  />
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
          <div className="px-4 py-3 border-b border-[#1E2028] flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
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

            {/* Reindex button — only shown to the course professor */}
            {course && user && course.professor_id === user.id && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="w-full py-1.5 rounded-lg text-[0.72rem] font-medium
                             bg-[#1A1D25] border border-[#1E2028] text-[#94A3B8]
                             hover:border-[#FF5533]/40 hover:text-[#FF5533]
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  {reindexing ? 'Indexing PDFs…' : '⟳ Reindex Course for AI'}
                </button>
                {reindexMsg && (
                  <p className={`text-[0.68rem] text-center ${reindexMsg.startsWith('✓') ? 'text-green-400' : 'text-amber-400'}`}>
                    {reindexMsg}
                  </p>
                )}
              </div>
            )}
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
                    activeMaterial ? `Summarize "${activeMaterial.title}"` : 'Summarize this material',
                    'What are the key concepts?',
                    'Give me a quick quiz on this section',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={async () => {
                        setChatInput(prompt)
                        // small delay so state flushes before sendMessage reads it
                        await new Promise(r => setTimeout(r, 0))
                        const userMsg: ChatMessage = {
                          id: crypto.randomUUID(),
                          role: 'user',
                          content: prompt,
                          timestamp: new Date(),
                        }
                        setMessages((prev) => [...prev, userMsg])
                        setChatInput('')
                        setAiTyping(true)
                        try {
                          const res = await fetch('http://localhost:8000/api/ai/chat', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({ course_id: courseId, message: prompt, history: [] }),
                          })
                          const data = await res.json()
                          const reply: string = res.ok ? (data.reply ?? 'No response.') : (data.detail ?? 'Error.')
                          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() }])
                        } catch {
                          setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Could not reach the AI.', timestamp: new Date() }])
                        } finally {
                          setAiTyping(false)
                        }
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
                  {msg.role === 'assistant' ? (
                    <div className="text-[0.82rem] leading-relaxed
                      [&>p]:mb-2 [&>p]:last:mb-0
                      [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ul]:space-y-0.5
                      [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>ol]:space-y-0.5
                      [&_li]:text-[0.8rem]
                      [&>h1]:text-sm [&>h1]:font-bold [&>h1]:mb-1
                      [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mb-1
                      [&>h3]:text-[0.8rem] [&>h3]:font-semibold [&>h3]:mb-1
                      [&_strong]:text-white [&_strong]:font-semibold
                      [&_code]:bg-[#0C0C0F] [&_code]:text-[#FF5533] [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.75rem]
                      [&>pre]:bg-[#0C0C0F] [&>pre]:rounded [&>pre]:p-2 [&>pre]:mb-2 [&>pre]:overflow-x-auto [&>pre]:text-[0.75rem]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
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

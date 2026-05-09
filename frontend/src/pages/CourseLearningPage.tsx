import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../context/AuthContext'
import {
  getCourseDetail, getCourseProgress, markItemCompleted,
  getCourseFeedback, submitFeedback,
  type CourseOut, type SubsectionOut, type LessonBlockOut, type MaterialOut, type CourseProgressOut,
  type FeedbackOut,
} from '../api/course'
import {
  getQCMHistory,
  getCourseSummary,
  regenerateCourseSummary,
  type QCMAttemptOut,
} from '../api/qcm'
import QCMModal from '../components/QCMModal'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const Icons = {
  back: (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
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
  text: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  image: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  video: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
}

const BACKEND = 'http://localhost:8000'

/* ─── Rich text viewer ─── */
function ContentViewer({ html }: { html: string }) {
  return (
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
  )
}

/* ─── Single lesson block renderer ─── */
function BlockRenderer({ block }: { block: LessonBlockOut }) {
  if (block.block_type === 'text') {
    const raw = block.content ?? ''
    // Detect rich HTML (from Tiptap) vs legacy plain text
    const isHtml = raw.trimStart().startsWith('<')
    if (isHtml) {
      return (
        <div
          className="
            prose prose-invert max-w-none text-[#CBD5E1] leading-[1.85]
            [&_h1]:text-[1.4rem] [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-[#FF5533]/30
            [&_h2]:text-[1.15rem] [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-[#1E2028]
            [&_h3]:text-[1rem] [&_h3]:font-semibold [&_h3]:text-[#E2E8F0] [&_h3]:mt-5 [&_h3]:mb-2
            [&_p]:text-[0.9rem] [&_p]:mb-4 [&_p]:text-[#CBD5E1]
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5
            [&_li]:text-[0.9rem] [&_li]:text-[#CBD5E1]
            [&_strong]:font-bold [&_strong]:text-white
            [&_em]:italic
            [&_u]:underline
            [&_s]:line-through
            [&_mark]:px-0.5 [&_mark]:rounded-sm
            [&_blockquote]:border-l-4 [&_blockquote]:border-[#FF5533]/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#94A3B8]
            [&_pre]:bg-[#1A1D25] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto
            [&_code]:bg-[#1A1D25] [&_code]:text-[#FF5533] [&_code]:px-1.5 [&_code]:rounded [&_code]:text-[0.82rem]
          "
          dangerouslySetInnerHTML={{ __html: raw }}
        />
      )
    }
    const paragraphs = raw.split(/\n\n+/)
    const html = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('')
    return <ContentViewer html={html} />
  }

  if (block.block_type === 'image') {
    return (
      <figure className="my-6">
        <img
          src={`${BACKEND}/uploads/${block.file_url}`}
          alt={block.caption ?? 'Lesson image'}
          className="w-full max-w-2xl rounded-xl border border-[#1E2028] shadow-2xl"
          loading="lazy"
        />
        {block.caption && (
          <figcaption className="mt-2 text-[0.78rem] text-[#64748B] text-center italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  if (block.block_type === 'video') {
    return (
      <figure className="my-6">
        <video
          controls
          className="w-full max-w-2xl rounded-xl border border-[#1E2028] shadow-2xl"
          style={{ maxHeight: '480px' }}
        >
          <source src={`${BACKEND}/uploads/${block.file_url}`} />
          Your browser does not support video playback.
        </video>
        {block.caption && (
          <figcaption className="mt-2 text-[0.78rem] text-[#64748B] text-center italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    )
  }

  return null
}

/* ─── Legacy material renderer (AI-generated lessons, PDFs, videos) ─── */
function LegacyMaterialRenderer({ material, token }: { material: MaterialOut; token: string | null }) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (material.content_text) {
      setHtml(material.content_text)
      return
    }
    if (material.type === 'pdf') {
      setLoading(true)
      fetch(`${BACKEND}/api/courses/materials/${material.id}/text`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setHtml(data.html))
        .catch(() => setHtml('<p style="color:#94A3B8">Could not extract text from this PDF.</p>'))
        .finally(() => setLoading(false))
    }
  }, [material.id])

  if (material.type === 'video') {
    return (
      <figure className="my-6">
        <p className="text-[0.75rem] font-semibold text-[#64748B] uppercase tracking-wider mb-2">{material.title}</p>
        <video controls className="w-full max-w-2xl rounded-xl border border-[#1E2028] shadow-2xl" style={{ maxHeight: '480px' }}>
          <source src={`${BACKEND}/uploads/${material.file_url}`} />
        </video>
      </figure>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[0.8rem] text-[#475569]">
        <div className="w-4 h-4 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
        Reading content…
      </div>
    )
  }

  if (html) {
    return (
      <div className="my-2">
        {material.title && (
          <p className="text-[0.75rem] font-semibold text-[#64748B] uppercase tracking-wider mb-3">{material.title}</p>
        )}
        <ContentViewer html={html} />
      </div>
    )
  }

  return null
}

/* ─── Subsection content renderer ─── */
function SubsectionContentRenderer({ subsection }: { subsection: SubsectionOut }) {
  const blocks = [...(subsection.blocks || [])].sort((a, b) => a.order_index - b.order_index)
  if (blocks.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-[#475569] text-[0.88rem]">This lesson has no content yet.</p>
      </div>
    )
  }
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      {blocks.map(block => <BlockRenderer key={block.id} block={block} />)}
    </div>
  )
}


export default function CourseLearningPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'

  const [course, setCourse] = useState<CourseOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // For subsection-based navigation
  const [activeSubsection, setActiveSubsection] = useState<SubsectionOut | null>(null)
  const [activeSectionTitle, setActiveSectionTitle] = useState<string>('')
  // For legacy material sections (no subsections)
  const [activeMaterial, setActiveMaterial] = useState<MaterialOut | null>(null)

  const [showOutline, setShowOutline] = useState(false)
  const [showChat, setShowChat] = useState(true)

  const [progress, setProgress] = useState<CourseProgressOut | null>(null)
  const [markingComplete, setMarkingComplete] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [reindexing, setReindexing] = useState(false)
  const [reindexMsg, setReindexMsg] = useState('')

  const [feedbacks, setFeedbacks] = useState<FeedbackOut[]>([])
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackHover, setFeedbackHover] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const userFeedback = user ? feedbacks.find(f => f.user_id === user.id) : undefined

  const [qcmAttempts, setQcmAttempts] = useState<QCMAttemptOut[]>([])
  const [qcmModal, setQcmModal] = useState<{ sectionId?: string; scopeLabel: string } | null>(null)

  // AI course summary (markdown recap rendered at the bottom of the course)
  const [summaryMd, setSummaryMd] = useState<string | null>(null)
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null)
  const [summaryGenerating, setSummaryGenerating] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  useEffect(() => {
    if (!courseId) return
    setLoading(true)
    getCourseDetail(courseId)
      .then(c => {
        setCourse(c)
        const sorted = [...(c.sections ?? [])].sort((a, b) => a.order_index - b.order_index)
        // Auto-select first subsection of first section, or first material of legacy section
        for (const section of sorted) {
          const subs = [...(section.subsections ?? [])].sort((a, b) => a.order_index - b.order_index)
          if (subs.length > 0) {
            setActiveSubsection(subs[0])
            setActiveSectionTitle(section.title)
            return
          }
          const mats = [...(section.materials ?? [])].sort((a, b) => a.order_index - b.order_index)
          if (mats.length > 0) {
            setActiveMaterial(mats[0])
            setActiveSectionTitle(section.title)
            return
          }
        }
      })
      .catch(() => setError('Failed to load course'))
      .finally(() => setLoading(false))
  }, [courseId])

  useEffect(() => {
    if (!courseId || !token || isPreview) return
    getCourseProgress(token, courseId).then(setProgress).catch(() => {})
  }, [courseId, token, isPreview])

  useEffect(() => {
    if (!courseId || isPreview) return
    getCourseFeedback(courseId).then(setFeedbacks).catch(() => {})
  }, [courseId, isPreview])

  const refreshQcmHistory = () => {
    if (!courseId || !token || isPreview) return
    getQCMHistory(token, courseId).then(setQcmAttempts).catch(() => {})
  }

  useEffect(() => {
    refreshQcmHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, token, isPreview])

  useEffect(() => {
    if (!courseId || !token || isPreview) return
    getCourseSummary(token, courseId)
      .then(s => {
        setSummaryMd(s.summary ?? null)
        setSummaryGeneratedAt(s.generated_at ?? null)
      })
      .catch(() => {})
  }, [courseId, token, isPreview])

  const handleGenerateSummary = async () => {
    if (!courseId || !token || summaryGenerating) return
    setSummaryGenerating(true)
    setSummaryError('')
    try {
      const s = await regenerateCourseSummary(token, courseId)
      setSummaryMd(s.summary ?? null)
      setSummaryGeneratedAt(s.generated_at ?? null)
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Could not generate summary.')
    } finally {
      setSummaryGenerating(false)
    }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, aiTyping])

  const handleMarkComplete = async () => {
    if (!courseId || !token || markingComplete) return
    setMarkingComplete(true)
    try {
      let updated: CourseProgressOut | null = null
      if (activeSubsection) {
        updated = await markItemCompleted(token, courseId, activeSubsection.id)
      } else if (activeMaterial) {
        updated = await markItemCompleted(token, courseId, undefined, activeMaterial.id)
      }
      if (updated) setProgress(updated)
    } catch {
      // silently ignore (e.g. not enrolled in preview)
    } finally {
      setMarkingComplete(false)
    }
  }

  const isCurrentItemDone = (): boolean => {
    if (!progress) return false
    if (activeSubsection) return progress.completed_subsection_ids.includes(activeSubsection.id)
    if (activeMaterial) return progress.completed_material_ids.includes(activeMaterial.id)
    return false
  }

  const sendMessage = async () => {
    const text = chatInput.trim()
    if (!text || aiTyping) return
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setChatInput('')
    setAiTyping(true)
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    try {
      const res = await fetch(`${BACKEND}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ course_id: courseId, message: text, history }),
      })
      const data = await res.json()
      const reply: string = res.ok ? (data.reply ?? 'No response.') : (data.detail ?? 'Error.')
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Could not reach the AI.', timestamp: new Date() }])
    } finally {
      setAiTyping(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!courseId || !token || feedbackRating === 0 || submittingFeedback) return
    setSubmittingFeedback(true)
    setFeedbackError('')
    try {
      const fb = await submitFeedback(token, courseId, feedbackRating, feedbackComment || undefined)
      setFeedbacks(prev => [fb, ...prev])
      setFeedbackRating(0)
      setFeedbackComment('')
    } catch (err: unknown) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to submit feedback.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const handleReindex = async () => {
    if (!courseId || !token || reindexing) return
    setReindexing(true); setReindexMsg('')
    try {
      const res = await fetch(`${BACKEND}/api/ai/reindex/${courseId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (res.ok) {
        const n = data.chunks_stored ?? 0
        setReindexMsg(n > 0 ? `✓ Indexed ${n} chunks — AI is ready.` : '⚠ No text found.')
      } else {
        setReindexMsg(`Error: ${data.detail ?? 'Reindex failed.'}`)
      }
    } catch { setReindexMsg('Could not reach the server.') }
    finally { setReindexing(false) }
  }

  /* ─── Section / course completion helpers (used to gate quiz cards) ─── */
  const isSectionDone = (section: CourseOut['sections'][number]): boolean => {
    if (!progress) return false
    const subs = section.subsections ?? []
    const mats = section.materials ?? []
    if (subs.length === 0 && mats.length === 0) return false
    const subsDone = subs.every(s => progress.completed_subsection_ids.includes(s.id))
    const matsDone = subs.length === 0
      ? mats.every(m => progress.completed_material_ids.includes(m.id))
      : true
    return subsDone && matsDone
  }

  const bestAttemptFor = (sectionId?: string): QCMAttemptOut | undefined => {
    const filtered = qcmAttempts.filter(a =>
      sectionId ? a.section_id === sectionId : !a.section_id
    )
    if (filtered.length === 0) return undefined
    return filtered.reduce((best, cur) => (cur.score_pct > best.score_pct ? cur : best))
  }

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
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-[#FF5533] text-white text-[0.82rem] rounded-lg hover:bg-[#E64422] transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const sortedSections = [...(course.sections || [])].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="h-screen flex flex-col bg-[#0C0C0F] text-white overflow-hidden">
      {/* ═══ PREVIEW BANNER ═══ */}
      {isPreview && (
        <div className="shrink-0 flex items-center justify-between px-5 py-2.5 bg-amber-400 text-amber-950 z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-950/15 flex items-center justify-center">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span className="text-[0.8rem] font-semibold">Preview Mode</span>
            <span className="text-[0.75rem] text-amber-800">You are viewing this course as a student would see it</span>
          </div>
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.78rem] font-semibold bg-amber-950/15 hover:bg-amber-950/25 transition-colors"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close Preview
          </button>
        </div>
      )}

      {/* ═══ TOP BAR ═══ */}
      <header className="shrink-0 bg-[#111318] border-b border-[#1E2028] z-30">
        <div className="h-[58px] flex items-center px-4 gap-3">
          <button onClick={() => setShowOutline(!showOutline)} className="lg:hidden p-2 rounded-lg hover:bg-[#1E2028] text-[#64748B] hover:text-[#94A3B8] transition-colors">
            {Icons.menu}
          </button>
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-[#64748B] hover:text-white transition-colors text-[0.8rem] font-medium shrink-0 px-2 py-1.5 rounded-lg hover:bg-[#1E2028]">
            {Icons.back}
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-5 w-px bg-[#1E2028] shrink-0" />

          {/* Course title + lesson breadcrumb */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[0.88rem] font-semibold text-[#E2E8F0] truncate leading-tight">{course.title}</h1>
            {(activeSubsection || activeMaterial) && (
              <p className="text-[0.68rem] text-[#475569] truncate leading-tight mt-0.5">
                {activeSectionTitle} → {activeSubsection?.title ?? activeMaterial?.title}
              </p>
            )}
          </div>

          {/* Progress */}
          {progress && progress.total_items > 0 && (
            <div className="hidden md:flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <div className="w-32 h-1.5 bg-[#1E2028] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${progress.progress_pct}%`,
                        background: progress.progress_pct >= 100
                          ? 'linear-gradient(90deg,#10B981,#34D399)'
                          : 'linear-gradient(90deg,#FF5533,#FF7755)',
                      }}
                    />
                  </div>
                  <span className={`text-[0.72rem] font-bold font-mono tabular-nums min-w-[2.5rem] text-right ${progress.progress_pct >= 100 ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                    {progress.progress_pct}%
                  </span>
                </div>
                <p className="text-[0.6rem] text-[#334155] text-right">
                  {progress.completed_items}/{progress.total_items} lessons done
                </p>
              </div>
            </div>
          )}

          <button onClick={() => setShowChat(!showChat)} className="lg:hidden p-2 rounded-lg hover:bg-[#1E2028] text-[#64748B] hover:text-[#94A3B8] transition-colors relative">
            {Icons.chat}
            {messages.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF5533] rounded-full" />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ═══ LEFT: COURSE OUTLINE ═══ */}
        <aside className={`
          ${showOutline ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          absolute lg:relative z-20
          w-[272px] min-w-[272px] h-full
          bg-[#0F1117] border-r border-[#1E2028]
          flex flex-col
          transition-transform duration-200
        `}>
          {/* Sidebar header */}
          <div className="px-4 py-3.5 border-b border-[#1E2028] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <h2 className="text-[0.72rem] font-bold text-[#475569] uppercase tracking-[0.12em]">Contents</h2>
            </div>
            <button onClick={() => setShowOutline(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-[#1E2028] text-[#475569] hover:text-[#94A3B8] transition-colors">{Icons.close}</button>
          </div>

          {/* Mini progress strip */}
          {progress && progress.total_items > 0 && (
            <div className="px-4 py-2.5 border-b border-[#1E2028] shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[0.65rem] text-[#475569]">{progress.completed_items} of {progress.total_items} complete</span>
                <span className={`text-[0.65rem] font-bold ${progress.progress_pct >= 100 ? 'text-emerald-400' : 'text-[#FF5533]'}`}>{progress.progress_pct}%</span>
              </div>
              <div className="w-full h-1 bg-[#1E2028] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress.progress_pct}%`,
                    background: progress.progress_pct >= 100 ? '#10B981' : '#FF5533',
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
            {sortedSections.map((section, si) => {
              const sortedSubs = [...(section.subsections ?? [])].sort((a, b) => a.order_index - b.order_index)
              const sortedMats = [...(section.materials ?? [])].sort((a, b) => a.order_index - b.order_index)
              const totalItems = sortedSubs.length || sortedMats.length
              const doneItems = sortedSubs.filter(s => progress?.completed_subsection_ids.includes(s.id)).length
                + sortedMats.filter(m => progress?.completed_material_ids.includes(m.id)).length
              return (
                <div key={section.id} className="mb-1">
                  {/* Section header */}
                  <div className="px-3 pt-4 pb-2 flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-md bg-[#1A1D25] border border-[#252830] flex items-center justify-center text-[0.58rem] font-bold text-[#64748B] shrink-0">{si + 1}</span>
                    <p className="text-[0.68rem] font-bold text-[#475569] uppercase tracking-[0.1em] truncate flex-1">{section.title}</p>
                    {totalItems > 0 && progress && (
                      <span className="text-[0.6rem] text-[#334155] shrink-0">{doneItems}/{totalItems}</span>
                    )}
                  </div>

                  {/* Subsections */}
                  {sortedSubs.map((sub, subIdx) => {
                    const isActive = activeSubsection?.id === sub.id
                    const isDone = progress?.completed_subsection_ids.includes(sub.id) ?? false
                    return (
                      <button
                        key={sub.id}
                        onClick={() => { setActiveSubsection(sub); setActiveMaterial(null); setActiveSectionTitle(section.title); setShowOutline(false) }}
                        className={`w-full text-left pl-3 pr-3 py-2.5 flex items-start gap-2.5 transition-all duration-150 mx-1 rounded-lg mb-0.5 border ${
                          isActive
                            ? 'bg-[#FF5533]/12 border-[#FF5533]/25 text-white'
                            : 'border-transparent text-[#64748B] hover:bg-[#1A1D25] hover:text-[#CBD5E1]'
                        }`}
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        {isDone ? (
                          <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        ) : (
                          <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-[#FF5533] bg-[#FF5533]/10' : 'border-[#2A2E38]'}`}>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[0.81rem] leading-snug truncate font-medium ${isDone && !isActive ? 'text-[#334155]' : isActive ? 'text-white' : ''}`}>{sub.title}</p>
                          {sub.blocks.length > 0 && (
                            <span className={`text-[0.6rem] mt-0.5 block ${isActive ? 'text-[#FF5533]/70' : 'text-[#2A2E38]'}`}>
                              {sub.blocks.length} block{sub.blocks.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {/* Legacy materials */}
                  {sortedSubs.length === 0 && sortedMats.map((mat) => {
                    const isActive = activeMaterial?.id === mat.id
                    const isDone = progress?.completed_material_ids.includes(mat.id) ?? false
                    return (
                      <button
                        key={mat.id}
                        onClick={() => { setActiveMaterial(mat); setActiveSubsection(null); setActiveSectionTitle(section.title); setShowOutline(false) }}
                        className={`w-full text-left pl-3 pr-3 py-2.5 flex items-start gap-2.5 transition-all duration-150 mx-1 rounded-lg mb-0.5 border ${
                          isActive
                            ? 'bg-[#FF5533]/12 border-[#FF5533]/25 text-white'
                            : 'border-transparent text-[#64748B] hover:bg-[#1A1D25] hover:text-[#CBD5E1]'
                        }`}
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        {isDone ? (
                          <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                            <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </span>
                        ) : (
                          <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-[#FF5533] bg-[#FF5533]/10' : 'border-[#2A2E38]'}`}>
                            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />}
                          </span>
                        )}
                        <p className={`text-[0.81rem] leading-snug truncate flex-1 font-medium ${isDone && !isActive ? 'text-[#334155]' : isActive ? 'text-white' : ''}`}>{mat.title}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {sortedSections.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#1A1D25] flex items-center justify-center text-[#334155]">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75..." />
                  </svg>
                </div>
                <p className="text-[0.78rem] text-[#334155]">No sections yet</p>
              </div>
            )}
          </div>
        </aside>

        {showOutline && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setShowOutline(false)} />
        )}

        {/* ═══ CENTER: LESSON CONTENT ═══ */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0C0C0F]">
          {/* Lesson title bar — only when a lesson is selected */}
          {(activeSubsection || activeMaterial) && (
            <div className="px-6 py-4 border-b border-[#1E2028] bg-[#111318] shrink-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] shrink-0" />
                  <p className="text-[0.66rem] font-bold text-[#475569] uppercase tracking-[0.12em] truncate">{activeSectionTitle}</p>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-[1rem] font-bold text-[#E2E8F0] leading-snug">
                    {activeSubsection?.title ?? activeMaterial?.title}
                  </h3>
                  {/* Mark complete inline — compact version in title bar */}
                  {!isPreview && (
                    isCurrentItemDone() ? (
                      <span className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[0.75rem] font-semibold">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Done
                      </span>
                    ) : (
                      <button
                        onClick={handleMarkComplete}
                        disabled={markingComplete}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1A1D25] border border-[#252830] text-[#64748B] text-[0.75rem] font-semibold hover:border-emerald-500/30 hover:text-emerald-400 hover:bg-emerald-500/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {markingComplete ? (
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        Mark done
                      </button>
                    )
                  )}
                </div>
            </div>
          )}

          {/* Scrollable content area — always present */}
          <div className="flex-1 overflow-y-auto bg-[#0D1018] scrollbar-thin">
            {(activeSubsection || activeMaterial) ? (<>
                {activeSubsection ? (
                  <SubsectionContentRenderer subsection={activeSubsection} />
                ) : activeMaterial ? (
                  <div className="max-w-3xl mx-auto px-6 py-8">
                    <LegacyMaterialRenderer material={activeMaterial} token={token} />
                  </div>
                ) : null}

                {/* Bottom spacer + completion progress */}
                {!isPreview && progress && progress.total_items > 0 && (
                  <div className="max-w-3xl mx-auto px-6 pb-12 pt-4">
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#111318] border border-[#1E2028]">
                      <div className="w-10 h-10 rounded-xl bg-[#1A1D25] flex items-center justify-center shrink-0">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={progress.progress_pct >= 100 ? '#10B981' : '#FF5533'} strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.78rem] font-semibold text-[#CBD5E1] mb-1.5">Course progress</p>
                        <div className="w-full h-1.5 bg-[#1A1D25] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${progress.progress_pct}%`,
                              background: progress.progress_pct >= 100 ? '#10B981' : 'linear-gradient(90deg,#FF5533,#FF7755)',
                            }}
                          />
                        </div>
                      </div>
                      <span className={`text-[0.82rem] font-bold font-mono tabular-nums shrink-0 ${progress.progress_pct >= 100 ? 'text-emerald-400' : 'text-[#FF5533]'}`}>
                        {progress.progress_pct}%
                      </span>
                    </div>
                  </div>
                )}

              </>) : (
              <div className="flex items-center justify-center p-8 min-h-[240px]">
                <div className="text-center max-w-xs">
                  <div className="w-20 h-20 rounded-3xl bg-[#111318] border border-[#1E2028] flex items-center justify-center mx-auto mb-5">
                    <svg width="36" height="36" fill="none" stroke="#334155" strokeWidth={1.2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <h3 className="text-[0.95rem] font-semibold text-[#94A3B8] mb-2">Ready to learn?</h3>
                  <p className="text-[0.82rem] text-[#475569] leading-relaxed">Pick a lesson from the course outline on the left to get started.</p>
                </div>
              </div>
            )}

            {/* ── AI Knowledge Checks (per section + final exam) ── */}
            {!isPreview && token && sortedSections.length > 0 && (
              <div className="max-w-3xl mx-auto px-6 pb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-[#1E2028]" />
                  <span className="text-[0.65rem] font-bold text-[#334155] uppercase tracking-[0.12em]">AI Knowledge Checks</span>
                  <div className="flex-1 h-px bg-[#1E2028]" />
                </div>

                <div className="space-y-3">
                  {sortedSections.map((section, si) => {
                    const done = isSectionDone(section)
                    const best = bestAttemptFor(section.id)
                    return (
                      <div
                        key={section.id}
                        className={`p-4 rounded-2xl border flex items-center gap-4 ${
                          done
                            ? 'bg-[#111318] border-[#1E2028]'
                            : 'bg-[#0F1117] border-[#1A1D25] opacity-60'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          best?.passed
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : done
                              ? 'bg-[#FF5533]/12 text-[#FF5533] border border-[#FF5533]/25'
                              : 'bg-[#1A1D25] text-[#334155] border border-[#252830]'
                        }`}>
                          {best?.passed ? (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : done ? (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[0.62rem] font-bold text-[#475569] uppercase tracking-wider">Section {si + 1}</p>
                            {best && (
                              <span className={`text-[0.62rem] font-bold px-1.5 py-0.5 rounded ${
                                best.passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                              }`}>
                                Best: {best.score_pct}% ({best.difficulty})
                              </span>
                            )}
                          </div>
                          <p className="text-[0.85rem] font-semibold text-white truncate">{section.title}</p>
                          <p className="text-[0.7rem] text-[#475569] mt-0.5">
                            {done ? 'Optional — test your understanding.' : 'Complete the section to unlock.'}
                          </p>
                        </div>

                        <button
                          onClick={() => setQcmModal({ sectionId: section.id, scopeLabel: `Section: ${section.title}` })}
                          disabled={!done}
                          className="shrink-0 px-4 py-2 rounded-xl bg-[#FF5533] text-white text-[0.78rem] font-semibold hover:bg-[#E64422] disabled:bg-[#1A1D25] disabled:text-[#334155] disabled:cursor-not-allowed transition-colors"
                        >
                          {best ? 'Retake' : 'Take Quiz'}
                        </button>
                      </div>
                    )
                  })}

                  {/* Final exam — full course */}
                  {(() => {
                    const courseDone = !!progress && progress.progress_pct >= 100
                    const best = bestAttemptFor(undefined)
                    return (
                      <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
                        courseDone
                          ? 'bg-[#FF5533]/[0.06] border-[#FF5533]/25'
                          : 'bg-[#0F1117] border-[#1A1D25] border-dashed opacity-60'
                      }`}>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          best?.passed
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : courseDone
                              ? 'bg-[#FF5533] text-white'
                              : 'bg-[#1A1D25] text-[#334155] border border-[#252830]'
                        }`}>
                          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[0.62rem] font-bold text-[#FF5533] uppercase tracking-wider">Final Exam</p>
                            {best && (
                              <span className={`text-[0.62rem] font-bold px-1.5 py-0.5 rounded ${
                                best.passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                              }`}>
                                Best: {best.score_pct}% ({best.difficulty})
                              </span>
                            )}
                          </div>
                          <p className="text-[0.9rem] font-bold text-white truncate">Course-wide Knowledge Check</p>
                          <p className="text-[0.7rem] text-[#94A3B8] mt-0.5">
                            {courseDone
                              ? 'Bring it all together — questions span the whole course.'
                              : 'Reach 100% course progress to unlock.'}
                          </p>
                        </div>

                        <button
                          onClick={() => setQcmModal({ scopeLabel: `Final Exam: ${course.title}` })}
                          disabled={!courseDone}
                          className="shrink-0 px-4 py-2 rounded-xl bg-[#FF5533] text-white text-[0.78rem] font-semibold hover:bg-[#E64422] disabled:bg-[#1A1D25] disabled:text-[#334155] disabled:cursor-not-allowed transition-colors"
                        >
                          {best ? 'Retake' : 'Start Exam'}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* ── AI Course Recap — markdown summary of the entire course ── */}
            {!isPreview && token && (
              <div className="max-w-3xl mx-auto px-6 pb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-[#1E2028]" />
                  <span className="text-[0.65rem] font-bold text-[#334155] uppercase tracking-[0.12em]">AI Course Recap</span>
                  <div className="flex-1 h-px bg-[#1E2028]" />
                </div>

                <div className="rounded-2xl border border-[#1E2028] bg-gradient-to-b from-[#111318] to-[#0F1117] overflow-hidden">
                  {/* Header */}
                  <div className="flex items-start gap-4 px-5 py-4 border-b border-[#1E2028] bg-[#0F1117]/60">
                    <div className="w-10 h-10 rounded-xl bg-[#FF5533]/12 border border-[#FF5533]/25 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#FF5533" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.92rem] font-bold text-white leading-snug">Smart course recap</p>
                      <p className="text-[0.72rem] text-[#64748B] mt-0.5 leading-relaxed">
                        A polished AI-generated summary covering every section — learning outcomes, key concepts, and a cheat sheet you can revise from.
                      </p>
                      {summaryGeneratedAt && (
                        <p className="text-[0.65rem] text-[#475569] mt-1.5 font-mono">
                          Last generated {new Date(summaryGeneratedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={summaryGenerating}
                      className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF5533] text-white text-[0.78rem] font-semibold hover:bg-[#E64422] disabled:bg-[#1A1D25] disabled:text-[#334155] disabled:cursor-not-allowed transition-colors"
                    >
                      {summaryGenerating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Generating…
                        </>
                      ) : summaryMd ? (
                        <>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          Regenerate
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                          </svg>
                          Generate
                        </>
                      )}
                    </button>
                  </div>

                  {/* Body */}
                  <div className="px-6 py-6">
                    {summaryError && (
                      <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/25 text-[0.78rem] text-red-300">
                        {summaryError}
                      </div>
                    )}

                    {summaryMd ? (
                      <div className="
                        prose prose-invert max-w-none text-[#CBD5E1] leading-[1.8]
                        [&>h2]:text-[1.25rem] [&>h2]:font-bold [&>h2]:text-white
                        [&>h2]:mt-2 [&>h2]:mb-5 [&>h2]:pb-2.5
                        [&>h2]:border-b [&>h2]:border-[#FF5533]/35
                        [&>h2]:flex [&>h2]:items-center [&>h2]:gap-2
                        [&>h3]:text-[1.02rem] [&>h3]:font-semibold [&>h3]:text-[#F1F5F9]
                        [&>h3]:mt-7 [&>h3]:mb-3 [&>h3]:pb-1.5
                        [&>h3]:border-b [&>h3]:border-[#1E2028]
                        [&>h4]:text-[0.9rem] [&>h4]:font-semibold [&>h4]:text-[#FF5533]
                        [&>h4]:mt-5 [&>h4]:mb-2 [&>h4]:uppercase [&>h4]:tracking-[0.04em]
                        [&>p]:text-[0.88rem] [&>p]:mb-4 [&>p]:text-[#CBD5E1]
                        [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-5 [&>ul]:space-y-1.5
                        [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-5 [&>ol]:space-y-1.5
                        [&_li]:text-[0.85rem] [&_li]:text-[#94A3B8] [&_li]:leading-relaxed
                        [&_li>strong]:text-[#E2E8F0]
                        [&>blockquote]:border-l-[3px] [&>blockquote]:border-[#FF5533]/50
                        [&>blockquote]:pl-4 [&>blockquote]:my-5 [&>blockquote]:text-[#94A3B8] [&>blockquote]:italic
                        [&_strong]:text-white [&_strong]:font-semibold
                        [&_em]:text-[#94A3B8]
                        [&_code]:bg-[#1A1D25] [&_code]:text-[#FF5533]
                        [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.78rem]
                        [&_code]:font-mono [&_code]:border [&_code]:border-[#1E2028]
                        [&>table]:w-full [&>table]:my-5 [&>table]:border-collapse
                        [&>table]:rounded-xl [&>table]:overflow-hidden
                        [&>table]:border [&>table]:border-[#1E2028]
                        [&_thead]:bg-[#1A1D25]
                        [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[0.72rem]
                        [&_th]:font-bold [&_th]:text-[#E2E8F0] [&_th]:uppercase [&_th]:tracking-wider
                        [&_th]:border-b [&_th]:border-[#252830]
                        [&_td]:px-4 [&_td]:py-2.5 [&_td]:text-[0.82rem] [&_td]:text-[#CBD5E1]
                        [&_td]:border-t [&_td]:border-[#1E2028] [&_td]:align-top
                        [&_tbody_tr:hover]:bg-[#FF5533]/[0.03]
                        [&_a]:text-[#FF5533] [&_a]:underline [&_a]:underline-offset-2
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryMd}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#1A1D25] border border-[#252830] flex items-center justify-center">
                          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={1.6}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                          </svg>
                        </div>
                        <p className="text-[0.88rem] font-semibold text-[#CBD5E1]">No recap yet</p>
                        <p className="text-[0.76rem] text-[#475569] mt-1.5 max-w-sm mx-auto leading-relaxed">
                          Generate a structured AI summary of the full course — perfect for last-minute revision.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Student Reviews — visible to everyone ── */}
            {!isPreview && (
              <div className="max-w-3xl mx-auto px-6 pb-16">
                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex-1 h-px bg-[#1E2028]" />
                      <span className="text-[0.65rem] font-bold text-[#334155] uppercase tracking-[0.12em]">Student Reviews</span>
                      <div className="flex-1 h-px bg-[#1E2028]" />
                    </div>

                    {/* Summary row */}
                    {feedbacks.length > 0 && (() => {
                      const avg = feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length
                      return (
                        <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-[#111318] border border-[#1E2028]">
                          <div className="text-center shrink-0">
                            <p className="text-[2rem] font-bold text-white leading-none">{avg.toFixed(1)}</p>
                            <div className="flex gap-0.5 justify-center mt-1">
                              {[1,2,3,4,5].map(s => (
                                <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={s <= Math.round(avg) ? '#FF5533' : '#1E2028'} stroke={s <= Math.round(avg) ? '#FF5533' : '#334155'} strokeWidth={1.5}>
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                              ))}
                            </div>
                            <p className="text-[0.62rem] text-[#475569] mt-1">{feedbacks.length} review{feedbacks.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex-1 space-y-1.5">
                            {[5,4,3,2,1].map(star => {
                              const count = feedbacks.filter(f => f.rating === star).length
                              const pct = feedbacks.length ? (count / feedbacks.length) * 100 : 0
                              return (
                                <div key={star} className="flex items-center gap-2">
                                  <span className="text-[0.62rem] text-[#475569] w-3 text-right shrink-0">{star}</span>
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="#FF5533" stroke="#FF5533" strokeWidth={1.5} className="shrink-0">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                  <div className="flex-1 h-1.5 bg-[#1A1D25] rounded-full overflow-hidden">
                                    <div className="h-full bg-[#FF5533] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[0.6rem] text-[#334155] w-5 text-right shrink-0">{count}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Submit form — only when course is completed and user hasn't reviewed yet */}
                    {progress && progress.progress_pct >= 100 && token && !userFeedback && (
                      <div className="mb-6 p-5 rounded-2xl bg-[#111318] border border-[#1E2028]">
                        <p className="text-[0.82rem] font-semibold text-[#E2E8F0] mb-1">Leave a review</p>
                        <p className="text-[0.72rem] text-[#475569] mb-4">Share your experience to help other learners.</p>

                        {/* Star picker */}
                        <div className="flex gap-1.5 mb-4">
                          {[1,2,3,4,5].map(star => (
                            <button
                              key={star}
                              onClick={() => setFeedbackRating(star)}
                              onMouseEnter={() => setFeedbackHover(star)}
                              onMouseLeave={() => setFeedbackHover(0)}
                              className="p-0.5 transition-transform hover:scale-110"
                            >
                              <svg width="28" height="28" viewBox="0 0 24 24"
                                fill={(feedbackHover || feedbackRating) >= star ? '#FF5533' : 'transparent'}
                                stroke={(feedbackHover || feedbackRating) >= star ? '#FF5533' : '#334155'}
                                strokeWidth={1.5}
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                            </button>
                          ))}
                          {feedbackRating > 0 && (
                            <span className="ml-2 text-[0.75rem] text-[#94A3B8] self-center">
                              {['','Poor','Fair','Good','Very good','Excellent'][feedbackRating]}
                            </span>
                          )}
                        </div>

                        <textarea
                          value={feedbackComment}
                          onChange={e => setFeedbackComment(e.target.value)}
                          placeholder="Write your review (optional)…"
                          rows={3}
                          className="w-full bg-[#0C0C0F] border border-[#1E2028] rounded-xl px-3 py-2.5 text-[0.82rem] text-[#CBD5E1] placeholder-[#334155] outline-none resize-none focus:border-[#FF5533]/40 focus:shadow-[0_0_0_3px_rgba(255,85,51,0.06)] transition-all duration-200 mb-3"
                        />

                        {feedbackError && (
                          <p className="text-[0.72rem] text-red-400 mb-3">{feedbackError}</p>
                        )}

                        <button
                          onClick={handleSubmitFeedback}
                          disabled={feedbackRating === 0 || submittingFeedback}
                          className="px-5 py-2 rounded-xl bg-[#FF5533] text-white text-[0.8rem] font-semibold hover:bg-[#E64422] disabled:bg-[#1E2028] disabled:text-[#334155] disabled:cursor-not-allowed transition-all duration-200"
                        >
                          {submittingFeedback ? 'Submitting…' : 'Submit Review'}
                        </button>
                      </div>
                    )}

                    {/* Already reviewed */}
                    {userFeedback && (
                      <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#10B981" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <p className="text-[0.78rem] text-emerald-400 font-medium">You've reviewed this course.</p>
                      </div>
                    )}

                    {/* Feedback cards */}
                    {feedbacks.length === 0 ? (
                      <p className="text-[0.78rem] text-[#334155] text-center py-6">No reviews yet. Be the first to share your experience!</p>
                    ) : (
                      <div className="space-y-3">
                        {feedbacks.map(fb => (
                          <div key={fb.id} className="p-4 rounded-xl bg-[#111318] border border-[#1E2028]">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#1A1D25] border border-[#252830] flex items-center justify-center text-[0.75rem] font-bold text-[#64748B] shrink-0">
                                  {fb.user_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[0.82rem] font-semibold text-[#CBD5E1] leading-tight">{fb.user_name}</p>
                                  <p className="text-[0.62rem] text-[#334155]">{new Date(fb.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                                </div>
                              </div>
                              <div className="flex gap-0.5 shrink-0">
                                {[1,2,3,4,5].map(s => (
                                  <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={s <= fb.rating ? '#FF5533' : 'transparent'} stroke={s <= fb.rating ? '#FF5533' : '#334155'} strokeWidth={1.5}>
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                ))}
                              </div>
                            </div>
                            {fb.comment && (
                              <p className="text-[0.82rem] text-[#94A3B8] leading-relaxed">{fb.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
            </div>
          )}
          </div>
        </main>

        {/* ═══ RIGHT: AI CHAT PANEL ═══ */}
        <aside className={`
          ${showChat ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0
          absolute lg:relative right-0 z-20
          w-[320px] min-w-[320px] h-full
          bg-[#0F1117] border-l border-[#1E2028]
          flex flex-col
          transition-transform duration-200
        `}>
          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b border-[#1E2028] shrink-0">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF5533] to-[#FF7755] flex items-center justify-center text-white shadow-lg shadow-[#FF5533]/20">
                {Icons.ai}
              </div>
              <div className="flex-1">
                <h2 className="text-[0.85rem] font-bold text-[#E2E8F0] leading-tight">AI Tutor</h2>
                <p className="text-[0.63rem] text-[#475569] leading-tight">Powered by course content</p>
              </div>
              <button onClick={() => setShowChat(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-[#1E2028] text-[#475569] hover:text-[#94A3B8] transition-colors">
                {Icons.close}
              </button>
            </div>

            {/* Current lesson context chip */}
            {(activeSubsection || activeMaterial) && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#1A1D25] rounded-lg border border-[#252830]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] shrink-0" />
                <span className="text-[0.68rem] text-[#64748B] truncate">
                  {activeSubsection?.title ?? activeMaterial?.title}
                </span>
              </div>
            )}

            {!isPreview && course && user && course.professor_id === user.id && (
              <div className="mt-2.5 flex flex-col gap-1">
                <button
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="w-full py-1.5 rounded-lg text-[0.7rem] font-medium bg-[#1A1D25] border border-[#1E2028] text-[#64748B] hover:border-[#FF5533]/30 hover:text-[#FF5533] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {reindexing ? 'Indexing…' : '↻ Reindex for AI'}
                </button>
                {reindexMsg && (
                  <p className={`text-[0.65rem] text-center ${reindexMsg.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {reindexMsg}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 px-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF5533]/15 to-[#FF7755]/5 border border-[#FF5533]/15 flex items-center justify-center mb-4">
                  <span className="text-[#FF5533]">{Icons.ai}</span>
                </div>
                <h3 className="text-[0.88rem] font-semibold text-[#CBD5E1] mb-1">Ask anything</h3>
                <p className="text-[0.75rem] text-[#475569] leading-relaxed mb-5 max-w-[200px]">
                  I'll answer based on this course's materials only.
                </p>
                <div className="w-full space-y-2">
                  {[
                    activeSubsection ? `Summarize "${activeSubsection.title}"` : 'Summarize this lesson',
                    'What are the key concepts?',
                    'Quiz me on this section',
                  ].map(prompt => (
                    <button
                      key={prompt}
                      onClick={async () => {
                        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: prompt, timestamp: new Date() }
                        setMessages(prev => [...prev, userMsg])
                        setAiTyping(true)
                        try {
                          const res = await fetch(`${BACKEND}/api/ai/chat`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ course_id: courseId, message: prompt, history: [] }),
                          })
                          const data = await res.json()
                          const reply: string = res.ok ? (data.reply ?? 'No response.') : (data.detail ?? 'Error.')
                          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() }])
                        } catch {
                          setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: 'Could not reach the AI.', timestamp: new Date() }])
                        } finally { setAiTyping(false) }
                      }}
                      className="w-full px-3 py-2.5 text-left text-[0.78rem] text-[#64748B] bg-[#1A1D25] rounded-xl hover:bg-[#1E2028] hover:text-[#CBD5E1] transition-all duration-150 border border-[#1E2028] hover:border-[#252830] flex items-center gap-2"
                    >
                      <span className="text-[#FF5533] shrink-0">›</span>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF5533] to-[#FF7755] flex items-center justify-center shrink-0 mb-0.5">
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
                    </svg>
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-[#FF5533] text-white rounded-br-sm'
                    : 'bg-[#181C24] text-[#CBD5E1] border border-[#252830] rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="text-[0.81rem] leading-relaxed
                      [&>p]:mb-2 [&>p:last-child]:mb-0
                      [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-2 [&>ul]:space-y-0.5
                      [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-2 [&>ol]:space-y-0.5
                      [&_li]:text-[0.79rem]
                      [&>h1]:text-[0.88rem] [&>h1]:font-bold [&>h1]:mb-1.5 [&>h1]:text-white
                      [&>h2]:text-[0.85rem] [&>h2]:font-semibold [&>h2]:mb-1 [&>h2]:text-white
                      [&>h3]:text-[0.8rem] [&>h3]:font-semibold [&>h3]:mb-1 [&>h3]:text-[#E2E8F0]
                      [&_strong]:text-white [&_strong]:font-semibold
                      [&_em]:text-[#94A3B8] [&_em]:italic
                      [&_code]:bg-[#0C0C0F] [&_code]:text-[#FF7755] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.73rem] [&_code]:font-mono">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <span className={`block text-[0.58rem] mt-1.5 ${msg.role === 'user' ? 'text-white/50 text-right' : 'text-[#334155]'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {aiTyping && (
              <div className="flex justify-start items-end gap-2">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF5533] to-[#FF7755] flex items-center justify-center shrink-0">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V19a2 2 0 01-2 2H7a2 2 0 01-2-2v-4.5" />
                  </svg>
                </div>
                <div className="bg-[#181C24] border border-[#252830] rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-[#FF5533]/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#FF5533]/60 rounded-full animate-bounce" style={{ animationDelay: '180ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#FF5533]/60 rounded-full animate-bounce" style={{ animationDelay: '360ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 pb-3 pt-2 border-t border-[#1E2028] shrink-0">
            <div className="flex items-end gap-2 bg-[#181C24] rounded-2xl border border-[#252830] focus-within:border-[#FF5533]/35 focus-within:shadow-[0_0_0_3px_rgba(255,85,51,0.06)] transition-all duration-200">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask about this lesson…"
                rows={1}
                className="flex-1 bg-transparent text-[0.82rem] text-[#E2E8F0] placeholder-[#334155] px-3.5 pt-3 pb-2.5 resize-none outline-none max-h-[120px] scrollbar-thin leading-relaxed"
                style={{ minHeight: '44px' }}
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim() || aiTyping}
                className="p-2.5 m-1.5 rounded-xl bg-[#FF5533] text-white hover:bg-[#E64422] disabled:bg-[#1E2028] disabled:text-[#334155] disabled:cursor-not-allowed transition-all duration-200 shrink-0"
              >
                {Icons.send}
              </button>
            </div>
            <p className="text-[0.58rem] text-[#2A2E38] text-center mt-2">Answers based on course materials · Enter to send</p>
          </div>
        </aside>

        {showChat && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-10" onClick={() => setShowChat(false)} />
        )}
      </div>

      {qcmModal && token && courseId && (
        <QCMModal
          token={token}
          courseId={courseId}
          sectionId={qcmModal.sectionId}
          scopeLabel={qcmModal.scopeLabel}
          onClose={() => {
            setQcmModal(null)
            refreshQcmHistory()
          }}
        />
      )}
    </div>
  )
}

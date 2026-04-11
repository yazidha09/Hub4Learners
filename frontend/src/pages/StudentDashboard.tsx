import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'
import {
  listPublishedCourses, getEnrolledCourses, enrollInCourse, unenrollFromCourse,
  type CourseOut,
} from '../api/course'
import { listCategories, type CategoryOut } from '../api/category'
import { sendChatRequest, getMyChatRequests, type ChatRequestOut } from '../api/chat'
import ChatRoom from '../components/ChatRoom'
import { listUniversities, type UniversityOut } from '../api/org'
import { updateProfile } from '../api/auth'

/* ── Icons ── */
const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const BookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)
const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)
const GraduationCapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
)
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const BASE_NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'courses', label: 'Courses', icon: <BookIcon /> },
  { id: 'my-courses', label: 'My Courses', icon: <GraduationCapIcon /> },
  { id: 'chat', label: 'Chat Requests', icon: <ChatIcon /> },
  { id: 'grades', label: 'Grades', icon: <ChartIcon /> },
]

/* ── Mock data ── */
const COURSES = [
  { id: 1, name: 'Introduction to Machine Learning', instructor: 'Dr. Benali', progress: 68, tag: 'AI', color: '#FF5533' },
  { id: 2, name: 'Advanced React Patterns', instructor: 'Sarah Chen', progress: 42, tag: 'Web', color: '#3B82F6' },
  { id: 3, name: 'Data Structures & Algorithms', instructor: 'Prof. Hamidi', progress: 91, tag: 'CS', color: '#10B981' },
  { id: 4, name: 'UI/UX Design Fundamentals', instructor: 'Amira Khelif', progress: 15, tag: 'Design', color: '#8B5CF6' },
]

const DEADLINES = [
  { course: 'Machine Learning', task: 'Assignment 3: Neural Networks', due: 'Tomorrow', urgent: true },
  { course: 'React Patterns', task: 'Project: State Management', due: 'In 3 days', urgent: false },
  { course: 'DSA', task: 'Quiz: Graph Algorithms', due: 'In 5 days', urgent: false },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/* ── University self-assignment card ── */
function UniversityCard({ token }: { token: string }) {
  const { user, refreshUser } = useAuth()
  const [unis, setUnis] = useState<UniversityOut[]>([])
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(user?.university_id ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    listUniversities(token).then(setUnis).catch(() => {})
  }, [token])

  const handleSave = async () => {
    setSaving(true); setErr('')
    try {
      await updateProfile(token, { university_id: selected || '' })
      refreshUser()
      setEditing(false)
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  if (!editing && user?.university_name) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-4 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-0.5">My University</p>
          <p className="text-[0.88rem] font-semibold text-[#0C0C0F]">{user.university_name}</p>
          {user.region_name && <p className="text-xs text-[#94A3B8]">{user.region_name}</p>}
        </div>
        <button
          onClick={() => { setSelected(user.university_id ?? ''); setEditing(true) }}
          className="text-xs font-semibold text-[#94A3B8] hover:text-[#0C0C0F] transition-colors cursor-pointer bg-transparent border-none px-2 py-1"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-4 shadow-sm">
      <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-1">My University</p>
      {!user?.university_name && (
        <p className="text-xs text-[#94A3B8] mb-3">Assign yourself to a university to get tailored recommendations and announcements.</p>
      )}
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.87rem] bg-white outline-none focus:border-[#0C0C0F] focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-all"
        >
          <option value="">Not assigned</option>
          {unis.map(u => (
            <option key={u.id} value={u.id}>{u.name}{u.region_name ? ` · ${u.region_name}` : ''}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-lg bg-[#0C0C0F] text-white text-[0.84rem] font-semibold cursor-pointer hover:bg-[#1E1E23] disabled:bg-[#D1D5DB] border-none transition-colors"
        >
          {saving ? '...' : 'Save'}
        </button>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="h-10 px-3 rounded-lg text-[0.84rem] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none cursor-pointer transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
    </div>
  )
}

function FileUploadField({
  label, required, accept, file, onChange,
}: {
  label: string
  required?: boolean
  accept: string
  file: File | null
  onChange: (f: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}{required && <span className="text-[#FF5533] ml-0.5">*</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative h-14 px-4 border-2 border-dashed rounded-xl bg-white cursor-pointer flex items-center gap-3 transition-all duration-200 ${
          file 
            ? 'border-emerald-300 bg-emerald-50/50' 
            : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${file ? 'bg-emerald-100' : 'bg-slate-100'}`}>
          {file ? (
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`block text-sm truncate ${file ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
            {file ? file.name : 'Click to select file'}
          </span>
          <span className="text-[10px] text-slate-400">JPG, PNG, PDF accepted</span>
        </div>
        {file && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

/* ── Request Chat Inline ── */
function RequestChatInline({ token, professorId, professorName }: {
  token: string; professorId: string; professorName: string
}) {
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    setSending(true); setErr('')
    try {
      await sendChatRequest(token, professorId, msg.trim() || undefined)
      setSent(true)
    } catch (e: any) { setErr(e.message) } finally { setSending(false) }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm font-semibold">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Chat request sent to {professorName}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 cursor-pointer transition-all duration-200"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Chat with Professor
      </button>
    )
  }

  return (
    <div className="w-full mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Request chat with {professorName}</span>
      </div>
      <textarea
        value={msg}
        onChange={e => setMsg(e.target.value)}
        placeholder="Add a message (optional)..."
        rows={2}
        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 resize-none outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
      />
      {err && <p className="text-xs text-red-500">{err}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setOpen(false); setErr('') }}
          className="flex-1 h-9 rounded-lg text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors duration-200">
          Cancel
        </button>
        <button onClick={handleSend} disabled={sending}
          className="flex-1 h-9 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors duration-200">
          {sending ? 'Sending...' : 'Send Request'}
        </button>
      </div>
    </div>
  )
}

/* ── Browse Courses Section ── */
function BrowseCoursesSection({ token }: { token: string }) {
  const [courses, setCourses] = useState<CourseOut[]>([])
  const [enrolled, setEnrolled] = useState<CourseOut[]>([])
  const [categories, setCategories] = useState<CategoryOut[]>([])
  const [activeCat, setActiveCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [search, setSearch] = useState('')
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [all, myEnrolled] = await Promise.all([listPublishedCourses(activeCat || undefined), getEnrolledCourses(token)])
      setCourses(all); setEnrolled(myEnrolled)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token, activeCat])

  const enrolledIds = new Set(enrolled.map(c => c.id))
  const filtered = courses.filter(c =>
    !search.trim() ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.professor_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleEnroll = async (courseId: string) => {
    setErr(''); setEnrollingId(courseId)
    try {
      await enrollInCourse(token, courseId)
      await load()
    } catch (e: any) { setErr(e.message) } finally { setEnrollingId(null) }
  }

  const typeIcon: Record<string, string> = { pdf: '📄', video: '🎬', audio: '🎵', exercise: '✏️' }

  if (selected) {
    const isEnrolled = enrolledIds.has(selected.id)
    return (
      <div className="max-w-[800px] animate-fadeIn">
        <button onClick={() => setSelected(null)}
          className="group flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 bg-transparent border-none cursor-pointer p-0 transition-all duration-200">
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to courses
        </button>
        
        {/* Course Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden mb-6">
          {selected.thumbnail && (
            <div className="h-48 w-full overflow-hidden">
              <img src={`http://localhost:8000/uploads/${selected.thumbnail}`} alt={selected.title}
                className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">{selected.title}</h2>
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[10px] font-bold">
                    {selected.professor_name.charAt(0).toUpperCase()}
                  </span>
                  {selected.professor_name}
                </p>
                {selected.description && (
                  <p className="text-sm text-slate-600 mt-4 leading-relaxed max-w-xl">{selected.description}</p>
                )}
                <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    {selected.sections.length} section{selected.sections.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                    {selected.enrolled_count} enrolled
                  </span>
                </div>
              </div>
              {!isEnrolled ? (
                <button onClick={() => handleEnroll(selected.id)} disabled={!!enrollingId}
                  className="px-6 py-3 bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white text-sm font-semibold rounded-xl border-none cursor-pointer shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-300 shrink-0">
                  {enrollingId === selected.id ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Enrolling...
                    </span>
                  ) : 'Enroll for free'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-semibold border border-emerald-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Enrolled
                </span>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <RequestChatInline token={token} professorId={selected.professor_id} professorName={selected.professor_name} />
            </div>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {err}
          </div>
        )}
        
        {/* Course Content */}
        {selected.sections.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 mx-auto mb-4 bg-slate-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">No content yet</p>
            <p className="text-xs text-slate-500">Check back later for new materials</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-children">
            {selected.sections.map((section, idx) => (
              <div key={section.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-900">{section.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">{section.materials.length} item{section.materials.length !== 1 ? 's' : ''}</span>
                </div>
                {section.materials.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {section.materials.map(m => (
                      <div key={m.id}>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors duration-200">
                          <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">{typeIcon[m.type] ?? '📁'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{m.title}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">{m.type}</div>
                          </div>
                          {isEnrolled ? (
                            m.type === 'pdf' && m.content_text ? (
                              <button
                                onClick={() => setExpandedMaterial(expandedMaterial === m.id ? null : m.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors duration-200 border-none cursor-pointer">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                </svg>
                                {expandedMaterial === m.id ? 'Close' : 'Read'}
                              </button>
                            ) : (
                              <a href={`http://localhost:8000/uploads/${m.file_url}`} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200 no-underline">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                                Open
                              </a>
                            )
                          ) : (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                              </svg>
                              Enroll to access
                            </span>
                          )}
                        </div>
                        {expandedMaterial === m.id && m.content_text && (
                          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100">
                            <div className="prose-sm max-w-none text-slate-700 leading-relaxed [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-3 [&>h1]:text-slate-900 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:text-slate-800 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mb-1.5 [&>h3]:text-slate-800 [&>p]:mb-3 [&>p]:text-[0.875rem] [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>li]:mb-1 [&>li]:text-[0.875rem] [&>pre]:bg-slate-900 [&>pre]:text-slate-100 [&>pre]:rounded-lg [&>pre]:p-4 [&>pre]:mb-3 [&>pre]:overflow-x-auto [&>code]:bg-slate-200 [&>code]:px-1 [&>code]:rounded [&>code]:text-[0.8rem] [&>blockquote]:border-l-4 [&>blockquote]:border-slate-300 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-slate-600">
                              <Markdown>{m.content_text}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-[900px] animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Browse Courses</h2>
          <p className="text-sm text-slate-500 mt-1">Discover and enroll in courses that interest you</p>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
          {filtered.length} course{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setActiveCat('')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
              !activeCat
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >All</button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
                activeCat === cat.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >{cat.name}</button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search courses by title or instructor..."
          className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
        />
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {err}
        </div>
      )}
      
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">{search ? 'No courses found' : 'No courses available'}</p>
          <p className="text-sm text-slate-500">{search ? 'Try adjusting your search terms' : 'Check back later for new content'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {filtered.map(c => (
            <div key={c.id}
              className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300"
              onClick={() => setSelected(c)}>
              {c.thumbnail ? (
                <div className="h-36 overflow-hidden">
                  <img src={`http://localhost:8000/uploads/${c.thumbnail}`} alt={c.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              ) : (
                <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#FF5533] transition-colors duration-200">{c.title}</h3>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wide">Free</span>
                </div>
                {c.category_name && (
                  <span className="inline-block text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full mb-2">{c.category_name}</span>
                )}
                <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                    {c.professor_name.charAt(0).toUpperCase()}
                  </span>
                  {c.professor_name}
                </p>
                {c.description && (
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-4">{c.description}</p>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{c.sections.length} section{c.sections.length !== 1 ? 's' : ''}</span>
                  {enrolledIds.has(c.id) ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Enrolled
                    </span>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); handleEnroll(c.id) }}
                      disabled={!!enrollingId}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white rounded-lg border-none cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                      {enrollingId === c.id ? '...' : 'Enroll'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── My Courses Section (enrolled) ── */
function MyCoursesSection({ token }: { token: string }) {
  const navigate = useNavigate()
  const [enrolled, setEnrolled] = useState<CourseOut[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState(false)
  const [unenrollErr, setUnenrollErr] = useState('')
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getEnrolledCourses(token).then(setEnrolled).finally(() => setLoading(false))
  }, [token])

  const handleUnenroll = async (courseId: string) => {
    setUnenrolling(true)
    setUnenrollErr('')
    try {
      await unenrollFromCourse(token, courseId)
      setEnrolled(prev => prev.filter(c => c.id !== courseId))
      setConfirmUnenroll(null)
      if (selected?.id === courseId) setSelected(null)
    } catch (e: any) {
      setUnenrollErr(e.message)
    } finally {
      setUnenrolling(false)
    }
  }

  const typeIcon: Record<string, string> = { pdf: '📄', video: '🎬', audio: '🎵', exercise: '✏️' }

  if (selected) {
    return (
      <div className="max-w-[800px] animate-fadeIn">
        <button onClick={() => setSelected(null)}
          className="group flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 bg-transparent border-none cursor-pointer p-0 transition-all duration-200">
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to my courses
        </button>
        
        {/* Course Header */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">{selected.title}</h2>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[10px] font-bold">
                  {selected.professor_name.charAt(0).toUpperCase()}
                </span>
                {selected.professor_name}
              </p>
              {selected.description && (
                <p className="text-sm text-slate-600 mt-4 leading-relaxed max-w-xl">{selected.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => navigate(`/learn/${selected.id}`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0C0C0F] text-white rounded-xl text-sm font-semibold hover:bg-[#1E1E23] transition-colors duration-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polygon strokeLinecap="round" strokeLinejoin="round" points="5 3 19 12 5 21 5 3" />
                </svg>
                Start Learning
              </button>
              {confirmUnenroll === selected.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Remove this course?</span>
                  <button
                    onClick={() => handleUnenroll(selected.id)}
                    disabled={unenrolling}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors duration-200"
                  >{unenrolling ? 'Removing...' : 'Yes, remove'}</button>
                  <button
                    onClick={() => { setConfirmUnenroll(null); setUnenrollErr('') }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg border-none cursor-pointer transition-colors duration-200"
                  >Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmUnenroll(selected.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 cursor-pointer transition-colors duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Remove
                </button>
              )}
              {unenrollErr && <p className="text-xs text-red-500 w-full">{unenrollErr}</p>}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <RequestChatInline token={token} professorId={selected.professor_id} professorName={selected.professor_name} />
          </div>
        </div>

        {/* Course Content */}
        {selected.sections.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="w-12 h-12 mx-auto mb-4 bg-slate-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">No content yet</p>
            <p className="text-xs text-slate-500">The instructor hasn't added any materials</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-children">
            {selected.sections.map((section, idx) => (
              <div key={section.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-900">{section.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">{section.materials.length} item{section.materials.length !== 1 ? 's' : ''}</span>
                </div>
                {section.materials.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {section.materials.map(m => (
                      <div key={m.id}>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors duration-200">
                          <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">{typeIcon[m.type] ?? '📁'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{m.title}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">{m.type}</div>
                          </div>
                          {m.type === 'pdf' && m.content_text ? (
                            <button
                              onClick={() => setExpandedMaterial(expandedMaterial === m.id ? null : m.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors duration-200 border-none cursor-pointer">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                              {expandedMaterial === m.id ? 'Close' : 'Read'}
                            </button>
                          ) : (
                            <a href={`http://localhost:8000/uploads/${m.file_url}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors duration-200 no-underline">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              Open
                            </a>
                          )}
                        </div>
                        {expandedMaterial === m.id && m.content_text && (
                          <div className="px-6 py-5 bg-slate-50 border-t border-slate-100">
                            <div className="prose-sm max-w-none text-slate-700 leading-relaxed [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-3 [&>h1]:text-slate-900 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2 [&>h2]:text-slate-800 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mb-1.5 [&>h3]:text-slate-800 [&>p]:mb-3 [&>p]:text-[0.875rem] [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>li]:mb-1 [&>li]:text-[0.875rem] [&>pre]:bg-slate-900 [&>pre]:text-slate-100 [&>pre]:rounded-lg [&>pre]:p-4 [&>pre]:mb-3 [&>pre]:overflow-x-auto [&>code]:bg-slate-200 [&>code]:px-1 [&>code]:rounded [&>code]:text-[0.8rem] [&>blockquote]:border-l-4 [&>blockquote]:border-slate-300 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-slate-600">
                              <Markdown>{m.content_text}</Markdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-[800px] animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Learning</h2>
        <p className="text-sm text-slate-500 mt-1">Continue where you left off</p>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl skeleton" />
          ))}
        </div>
      ) : enrolled.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">No courses yet</p>
          <p className="text-sm text-slate-500 mb-4">Enroll in a course to get started</p>
          <button className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors duration-200">
            Browse courses
          </button>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {enrolled.map(c => (
            <div key={c.id}
              onClick={() => setSelected(c)}
              className="group bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center gap-4">
                {/* Course icon/thumbnail */}
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shrink-0">
                  <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 truncate group-hover:text-[#FF5533] transition-colors duration-200">{c.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500">by {c.professor_name}</p>
                </div>
                
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <div className="text-xs text-slate-400">{c.sections.length} section{c.sections.length !== 1 ? 's' : ''}</div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Active
                    </span>
                  </div>
                  {confirmUnenroll === c.id ? (
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleUnenroll(c.id)}
                        disabled={unenrolling}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors duration-200"
                      >{unenrolling ? '...' : 'Remove'}</button>
                      <button
                        onClick={() => setConfirmUnenroll(null)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg border-none cursor-pointer transition-colors duration-200"
                      >No</button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmUnenroll(c.id) }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 border-none bg-transparent cursor-pointer transition-all duration-200"
                      title="Remove from my courses"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


/* ── Chat Requests Section ── */
function ChatRequestsSection({ token, currentUserId }: { token: string; currentUserId: string }) {
  const [requests, setRequests] = useState<ChatRequestOut[]>([])
  const [loading, setLoading] = useState(true)
  const [openRequest, setOpenRequest] = useState<ChatRequestOut | null>(null)

  const load = () => {
    setLoading(true)
    getMyChatRequests(token).then(setRequests).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const statusStyle: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    refused: 'bg-red-50 text-red-600 border-red-200',
    closed: 'bg-slate-50 text-slate-500 border-slate-200',
  }
  const statusLabel: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Active',
    refused: 'Refused',
    closed: 'Closed',
  }

  if (openRequest) {
    return (
      <ChatRoom
        token={token}
        requestId={openRequest.id}
        currentUserId={currentUserId}
        otherName={openRequest.professor_full_name}
        initialClosed={openRequest.status === 'closed'}
        isProfessor={false}
        onRoomClosed={() => {
          setRequests(prev => prev.map(r => r.id === openRequest.id ? { ...r, status: 'closed' } : r))
          setOpenRequest(prev => prev ? { ...prev, status: 'closed' } : null)
        }}
        onBack={() => { setOpenRequest(null); load() }}
      />
    )
  }

  return (
    <div className="max-w-[720px] animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Chat Requests</h2>
        <p className="text-sm text-slate-500 mt-1">Track your chat requests to professors</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 rounded-2xl skeleton" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">No chat requests yet</p>
          <p className="text-sm text-slate-500">Browse courses and click "Chat with Professor" to send a request</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {requests.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {r.professor_full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.professor_full_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${statusStyle[r.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'pending' ? 'bg-amber-500 animate-pulse' : r.status === 'accepted' ? 'bg-emerald-500' : r.status === 'closed' ? 'bg-slate-400' : 'bg-red-400'}`} />
                    {statusLabel[r.status] ?? r.status}
                  </span>
                  {(r.status === 'accepted' || r.status === 'closed') && (
                    <button
                      onClick={() => setOpenRequest(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border-none cursor-pointer transition-colors duration-200"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {r.status === 'closed' ? 'View Chat' : 'Open Chat'}
                    </button>
                  )}
                </div>
              </div>
              {r.message && (
                <p className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 italic">
                  "{r.message}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


export default function StudentDashboard() {
  const { user, token } = useAuth()
  const [nav, setNav] = useState('home')
  const firstName = user?.full_name?.split(' ')[0] || ''

  const resumeCourse = COURSES.reduce(
    (best, c) => (c.progress > 0 && c.progress < 100 && c.progress > (best?.progress ?? 0) ? c : best),
    null as (typeof COURSES)[0] | null,
  )

  if (nav === 'courses') {
    return (
      <DashboardLayout navItems={BASE_NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <BrowseCoursesSection token={token!} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav === 'my-courses') {
    return (
      <DashboardLayout navItems={BASE_NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <MyCoursesSection token={token!} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav === 'chat') {
    return (
      <DashboardLayout navItems={BASE_NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <ChatRequestsSection token={token!} currentUserId={user!.id} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav !== 'home') {
    return (
      <DashboardLayout navItems={BASE_NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-[1.1rem] font-bold text-[#0C0C0F]">{BASE_NAV.find(n => n.id === nav)?.label}</h2>
            <p className="text-[0.82rem] text-[#94A3B8] mt-1">Coming soon</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={BASE_NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
      <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">

        {/* Hero */}
        <div className="mb-10 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0B1021] text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] border border-white/10">
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#FF5533]/20 blur-3xl rounded-full" />
          <div className="absolute -left-10 -bottom-16 w-56 h-56 bg-[#22D3EE]/10 blur-3xl rounded-full" />
          <div className="relative p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-[0.7rem] font-bold tracking-[0.16em] uppercase text-white/70 mb-1">{getGreeting()}</p>
                <h1 className="text-[1.9rem] font-black tracking-[-0.03em] leading-tight">Welcome back, {firstName || 'student'}</h1>
                <p className="text-white/70 text-[0.95rem] max-w-xl mt-2">
                  Keep your learning streak going with smoother navigation and a calmer workspace curated for you.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setNav('courses')}
                  className="h-11 px-5 rounded-xl bg-white text-[#0C0C0F] font-semibold text-[0.9rem] border-none cursor-pointer shadow-md hover:-translate-y-0.5 transition-all"
                >
                  Explore courses
                </button>
                <button
                  onClick={() => setNav('my-courses')}
                  className="h-11 px-5 rounded-xl border border-white/40 text-white/90 font-semibold text-[0.9rem] bg-white/10 backdrop-blur cursor-pointer hover:border-white/70 transition-all"
                >
                  My learning
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: String(COURSES.length), label: 'Enrolled courses' },
                { value: '54h', label: 'Study time' },
                { value: '7', label: 'Day streak' },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-white/10 border border-white/15 backdrop-blur px-4 py-3 shadow-inner flex items-center justify-between"
                >
                  <div>
                    <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-white/70">{s.label}</p>
                    <p className="text-[1.35rem] font-black tracking-tight">{s.value}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-white/70" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* University affiliation */}
        <div className="mb-8">
          <UniversityCard token={token!} />
        </div>

        {/* Continue learning */}
        {resumeCourse && (
          <div className="mb-10">
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Pick up where you left off</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-[0_18px_50px_rgba(12,12,15,0.05)] transition-transform hover:-translate-y-[2px]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span
                    className="inline-block text-[0.58rem] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-sm mb-2"
                    style={{ color: resumeCourse.color, background: resumeCourse.color + '14' }}
                  >
                    {resumeCourse.tag}
                  </span>
                  <h3 className="text-[1.05rem] font-bold text-[#0C0C0F] mb-1">{resumeCourse.name}</h3>
                  <p className="text-[0.8rem] text-[#94A3B8]">{resumeCourse.instructor}</p>
                </div>
                <span className="text-[1.5rem] font-black text-[#0C0C0F] font-mono tracking-tighter">{resumeCourse.progress}%</span>
              </div>
              <div className="mt-4 h-[3px] bg-[#F1F3F5] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${resumeCourse.progress}%`, background: resumeCourse.color }} />
              </div>
              <button className="mt-4 px-4 py-2 bg-[#0C0C0F] text-white text-[0.78rem] font-bold rounded-md border-none cursor-pointer hover:bg-[#1E1E23] transition-colors">
                Resume
              </button>
            </div>
          </div>
        )}

        {/* Courses + Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">
          {/* Courses */}
          <div>
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">My courses</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-[0_16px_44px_rgba(12,12,15,0.06)] divide-y divide-[#F1F3F5]">
              {COURSES.map(c => (
                <div
                  key={c.id}
                  className="group flex items-center gap-4 px-5 py-4 cursor-pointer transition-all hover:bg-[#FAFAFA]"
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.9rem] font-semibold text-[#0C0C0F] truncate group-hover:text-[#FF5533] transition-colors">{c.name}</div>
                    <div className="text-[0.73rem] text-[#94A3B8]">{c.instructor}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-16 h-[3px] bg-[#F1F3F5] rounded-full overflow-hidden hidden sm:block">
                      <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: c.color }} />
                    </div>
                    <span className="text-[0.8rem] font-bold text-[#0C0C0F] font-mono w-12 text-right">{c.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deadlines */}
          <div>
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Upcoming</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-[0_16px_44px_rgba(12,12,15,0.06)] p-5">
              <div className="flex flex-col gap-4">
                {DEADLINES.map((d, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1.5">
                      <span className={`w-2 h-2 rounded-full ${d.urgent ? 'bg-[#FF5533]' : 'bg-[#D1D5DB]'}`} />
                      {i < DEADLINES.length - 1 && <div className="w-px h-8 bg-[#E5E7EB] mt-1" />}
                    </div>
                    <div>
                      <div className="text-[0.85rem] font-semibold text-[#0C0C0F]">{d.task}</div>
                      <div className="text-[0.7rem] text-[#94A3B8]">{d.course} · {d.due}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

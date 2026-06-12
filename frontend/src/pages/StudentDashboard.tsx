import { useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'
import type { AppNotification } from '../hooks/useNotifications'
import {
  listPublishedCourses, getCourseDetail, getEnrolledCourses, enrollInCourse, unenrollFromCourse,
  getCourseFeedback, getCourseFeedbackSummaries, getStudentAnalytics,
  type CourseOut, type FeedbackOut, type StudentAnalyticsOut, type StudentActivityPoint,
} from '../api/course'
import { listCategories, type CategoryOut } from '../api/category'
import { createCheckoutSession } from '../api/payment'
import FriendsMessenger from '../components/FriendsMessenger'
import FindFriends from '../components/FindFriends'
import { listUniversities, type UniversityOut } from '../api/org'
import { getMyAnnouncements, type AnnouncementOut } from '../api/admin'
import { updateProfile } from '../api/auth'
import GamificationPage from '../components/gamification/GamificationPage'
import ProfileStats from '../components/gamification/ProfileStats'

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
const FriendsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const AddFriendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
  </svg>
)

const MegaphoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
)
const TrophyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 1 1-10 0V4z" />
    <path d="M17 4h3v3a3 3 0 0 1-3 3M7 4H4v3a3 3 0 0 0 3 3" />
  </svg>
)

const BASE_NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'courses', label: 'Courses', icon: <BookIcon /> },
  { id: 'my-courses', label: 'My Courses', icon: <GraduationCapIcon /> },
  { id: 'gamification', label: 'Hero Stats', icon: <TrophyIcon /> },
  { id: 'messages', label: 'Messages', icon: <FriendsIcon /> },
  { id: 'find-friends', label: 'Find Friends', icon: <AddFriendIcon /> },
  { id: 'grades', label: 'Grades', icon: <ChartIcon /> },
]
const ANNOUNCEMENTS_NAV_ITEM: NavItem = { id: 'announcements', label: 'Announcements', icon: <MegaphoneIcon /> }

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
            <option key={u.id} value={u.id}>{u.name}</option>
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

/* ── Browse Courses Section ── */
function BrowseCoursesSection({
  token,
  enrolled,
  refreshEnrolled,
}: {
  token: string
  enrolled: CourseOut[]
  refreshEnrolled: () => Promise<void>
}) {
  const [courses, setCourses] = useState<CourseOut[]>([])
  const [categories, setCategories] = useState<CategoryOut[]>([])
  const [activeCat, setActiveCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [selectedFeedbacks, setSelectedFeedbacks] = useState<FeedbackOut[]>([])
  const [feedbackSummaries, setFeedbackSummaries] = useState<Record<string, { avg_rating: number; count: number }>>({})
  const [search, setSearch] = useState('')
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [justEnrolled, setJustEnrolled] = useState<Set<string>>(new Set())

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected) return
    setSelectedFeedbacks([])
    getCourseFeedback(selected.id).then(setSelectedFeedbacks).catch(() => {})
  }, [selected?.id])

  const load = async () => {
    setLoading(true)
    try {
      const [all, summaries] = await Promise.all([
        listPublishedCourses(activeCat || undefined),
        getCourseFeedbackSummaries(),
      ])
      setCourses(all); setFeedbackSummaries(summaries)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token, activeCat])

  // Optimistically enrolled IDs — ensures the "Enrolled" badge shows
  // immediately when the user clicks, before the API refresh completes.
  const enrolledIds = useMemo(() => {
    const ids = new Set(enrolled.map(c => c.id))
    for (const id of justEnrolled) ids.add(id)
    return ids
  }, [enrolled, justEnrolled])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return courses
    return courses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.professor_name.toLowerCase().includes(q)
    )
  }, [courses, search])

  const handleEnroll = async (courseId: string) => {
    setErr('')
    // Optimistic — badge shows immediately
    setJustEnrolled(prev => { const next = new Set(prev); next.add(courseId); return next })
    setEnrollingId(courseId)
    const course = courses.find(c => c.id === courseId)
    try {
      if (course && !course.is_free) {
        const session = await createCheckoutSession(token, courseId)
        window.location.href = session.url
        return
      }
      await enrollInCourse(token, courseId)
      await refreshEnrolled()
      load().catch(() => {})
      setJustEnrolled(new Set())
    } catch (e: any) {
      setErr(e.message)
      setJustEnrolled(prev => { const next = new Set(prev); next.delete(courseId); return next })
    } finally {
      setEnrollingId(null)
    }
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
                    {selected.sections_count} section{selected.sections_count !== 1 ? 's' : ''}
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
                selected.is_free ? (
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
                  <div className="shrink-0 flex flex-col items-end gap-2 min-w-[200px]">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">${Number(selected.price).toFixed(0)}</span>
                      <span className="text-xs font-medium text-slate-400">USD</span>
                    </div>
                    <button
                      onClick={() => handleEnroll(selected.id)}
                      disabled={!!enrollingId}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl border-none cursor-pointer hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    >
                      {enrollingId === selected.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Redirecting…
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                          </svg>
                          Enroll · Pay securely
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-400 leading-tight text-right">
                      Lifetime access · Powered by Stripe
                    </p>
                  </div>
                )
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-semibold border border-emerald-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Enrolled
                </span>
              )}
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
        
        {/* Reviews summary chip — shown on header when feedbacks exist */}
        {selectedFeedbacks.length > 0 && (() => {
          const avg = selectedFeedbacks.reduce((s, f) => s + f.rating, 0) / selectedFeedbacks.length
          return (
            <div className="flex items-center gap-2 mb-6 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl w-fit">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} width="13" height="13" viewBox="0 0 24 24"
                    fill={s <= Math.round(avg) ? '#F59E0B' : 'transparent'}
                    stroke={s <= Math.round(avg) ? '#F59E0B' : '#D1D5DB'}
                    strokeWidth={1.5}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ))}
              </div>
              <span className="text-sm font-bold text-amber-700">{avg.toFixed(1)}</span>
              <span className="text-xs text-amber-600">({selectedFeedbacks.length} review{selectedFeedbacks.length !== 1 ? 's' : ''})</span>
            </div>
          )
        })()}

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
                  <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full">
                    {section.subsections.length + section.materials.length} item{(section.subsections.length + section.materials.length) !== 1 ? 's' : ''}
                  </span>
                </div>
                {(section.subsections.length > 0 || section.materials.length > 0) && (
                  <div className="divide-y divide-slate-50">
                    {section.subsections.map(sub => (
                      <div key={sub.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors duration-200">
                        <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                          </svg>
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{sub.title}</div>
                          <div className="text-xs text-slate-400">Lesson</div>
                        </div>
                      </div>
                    ))}
                    {section.materials.map(m => (
                      <div key={m.id}>
                        <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors duration-200">
                          <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg">{typeIcon[m.type] ?? '📁'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{m.title}</div>
                            <div className="text-xs text-slate-400 uppercase tracking-wider">{m.type}</div>
                          </div>
                          {isEnrolled && m.type === 'pdf' && m.content_text && (
                            <button
                              onClick={() => setExpandedMaterial(expandedMaterial === m.id ? null : m.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors duration-200 border-none cursor-pointer">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                              {expandedMaterial === m.id ? 'Close' : 'Read'}
                            </button>
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

        {/* ── Student Reviews ── */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.12em]">Student Reviews</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {selectedFeedbacks.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
              <div className="w-10 h-10 mx-auto mb-3 bg-slate-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-500">No reviews yet</p>
              <p className="text-xs text-slate-400 mt-1">Be the first to complete and review this course</p>
            </div>
          ) : (
            <>
              {/* Rating breakdown */}
              {(() => {
                const avg = selectedFeedbacks.reduce((s, f) => s + f.rating, 0) / selectedFeedbacks.length
                return (
                  <div className="flex items-center gap-6 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-5">
                    <div className="text-center shrink-0">
                      <p className="text-4xl font-bold text-slate-900 leading-none">{avg.toFixed(1)}</p>
                      <div className="flex gap-0.5 justify-center mt-2">
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} width="14" height="14" viewBox="0 0 24 24"
                            fill={s <= Math.round(avg) ? '#F59E0B' : 'transparent'}
                            stroke={s <= Math.round(avg) ? '#F59E0B' : '#D1D5DB'}
                            strokeWidth={1.5}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">{selectedFeedbacks.length} review{selectedFeedbacks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex-1 space-y-2">
                      {[5,4,3,2,1].map(star => {
                        const count = selectedFeedbacks.filter(f => f.rating === star).length
                        const pct = (count / selectedFeedbacks.length) * 100
                        return (
                          <div key={star} className="flex items-center gap-2.5">
                            <span className="text-xs text-slate-500 w-3 text-right shrink-0">{star}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth={1} className="shrink-0">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-400 w-5 text-right shrink-0">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Review cards */}
              <div className="space-y-3">
                {selectedFeedbacks.map(fb => (
                  <div key={fb.id} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {fb.user_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-tight">{fb.user_name}</p>
                          <p className="text-xs text-slate-400">{new Date(fb.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0 pt-0.5">
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} width="13" height="13" viewBox="0 0 24 24"
                            fill={s <= fb.rating ? '#F59E0B' : 'transparent'}
                            stroke={s <= fb.rating ? '#F59E0B' : '#D1D5DB'}
                            strokeWidth={1.5}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        ))}
                      </div>
                    </div>
                    {fb.comment && (
                      <p className="text-sm text-slate-600 leading-relaxed">{fb.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
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
              onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}>
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
                  {c.is_free ? (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wide">Free</span>
                  ) : (
                    <span className="shrink-0 text-sm font-bold text-slate-900 tabular-nums leading-none mt-0.5">${Number(c.price).toFixed(0)}</span>
                  )}
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
                {feedbackSummaries[c.id] && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} width="11" height="11" viewBox="0 0 24 24"
                          fill={s <= Math.round(feedbackSummaries[c.id].avg_rating) ? '#F59E0B' : 'transparent'}
                          stroke={s <= Math.round(feedbackSummaries[c.id].avg_rating) ? '#F59E0B' : '#D1D5DB'}
                          strokeWidth={1.5}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-amber-600">{feedbackSummaries[c.id].avg_rating}</span>
                    <span className="text-[10px] text-slate-400">({feedbackSummaries[c.id].count})</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">{c.sections_count} section{c.sections_count !== 1 ? 's' : ''}</span>
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
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border-none cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                        c.is_free
                          ? 'bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}>
                      {enrollingId === c.id ? '...' : (c.is_free ? 'Enroll' : 'Buy now')}
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
function MyCoursesSection({
  token,
  onNavigate,
  enrolled,
  enrolledLoading,
  refreshEnrolled,
}: {
  token: string
  onNavigate: (id: string) => void
  enrolled: CourseOut[]
  enrolledLoading: boolean
  refreshEnrolled: () => Promise<void>
}) {
  const navigate = useNavigate()
  const loading = enrolledLoading
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState(false)
  const [unenrollErr, setUnenrollErr] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'not_started'>('all')
  const [search, setSearch] = useState('')

  // Default-expand the first section of the first course once enrolled data arrives
  useEffect(() => {
    if (expandedSection) return
    if (enrolled.length > 0 && enrolled[0].sections.length > 0) {
      setExpandedSection(enrolled[0].sections[0].id)
    }
  }, [enrolled, expandedSection])

  const handleUnenroll = async (courseId: string) => {
    setUnenrolling(true)
    setUnenrollErr('')
    try {
      await unenrollFromCourse(token, courseId)
      await refreshEnrolled()
      setConfirmUnenroll(null)
      if (selected?.id === courseId) setSelected(null)
    } catch (e: any) {
      setUnenrollErr(e.message)
    } finally {
      setUnenrolling(false)
    }
  }

  const typeConfig: Record<string, { icon: ReactNode; color: string; bg: string; label: string }> = {
    pdf: {
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
      color: 'text-blue-600', bg: 'bg-blue-50', label: 'PDF',
    },
    video: {
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>,
      color: 'text-purple-600', bg: 'bg-purple-50', label: 'VIDEO',
    },
    audio: {
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>,
      color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'AUDIO',
    },
    exercise: {
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
      color: 'text-amber-600', bg: 'bg-amber-50', label: 'EXERCISE',
    },
  }

  if (selected) {
    return (
      <div className="max-w-[820px] animate-fadeIn">
        <button onClick={() => setSelected(null)}
          className="group inline-flex items-center gap-2 text-[0.82rem] font-semibold text-[#64748B] hover:text-[#0C0C0F] mb-6 bg-transparent border-none cursor-pointer p-0 transition-colors">
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to my learning
        </button>

        {/* Course Header */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-5">
          {selected.thumbnail ? (
            <div className="aspect-[16/6] bg-[#F1F3F5] overflow-hidden">
              <img src={`http://localhost:8000/uploads/${selected.thumbnail}`} alt={selected.title} className="w-full h-full object-cover" />
            </div>
          ) : null}

          <div className="p-6">
            <p className="text-[0.62rem] font-bold tracking-[0.14em] uppercase text-[#94A3B8] mb-2">Enrolled course</p>
            <h2 className="text-[1.4rem] font-semibold text-[#0C0C0F] tracking-[-0.02em] leading-tight mb-2">{selected.title}</h2>
            <div className="flex items-center gap-3 text-[0.8rem] text-[#64748B]">
              <span className="w-6 h-6 rounded-full bg-[#0C0C0F] text-white flex items-center justify-center text-[0.66rem] font-semibold">
                {selected.professor_name.charAt(0).toUpperCase()}
              </span>
              <span>{selected.professor_name}</span>
              <span className="text-[#CBD5E1]">·</span>
              <span>{selected.sections_count} section{selected.sections_count !== 1 ? 's' : ''}</span>
            </div>

            {selected.description && (
              <p className="text-[0.86rem] text-[#64748B] leading-relaxed mt-4">{selected.description}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button onClick={() => navigate(`/learn/${selected.id}`)}
                className="inline-flex items-center gap-2 h-10 px-5 bg-[#0C0C0F] text-white rounded-lg text-[0.84rem] font-semibold hover:bg-[#1E1E23] transition-colors border-none cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start learning
              </button>
              {confirmUnenroll === selected.id ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => handleUnenroll(selected.id)} disabled={unenrolling}
                    className="h-10 px-4 text-[0.8rem] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg border-none cursor-pointer disabled:opacity-50 transition-colors">
                    {unenrolling ? 'Removing…' : 'Confirm remove'}
                  </button>
                  <button onClick={() => { setConfirmUnenroll(null); setUnenrollErr('') }}
                    className="h-10 px-3 text-[0.8rem] font-semibold text-[#64748B] bg-white border border-[#E5E7EB] hover:border-[#0C0C0F] rounded-lg cursor-pointer transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmUnenroll(selected.id)}
                  className="inline-flex items-center gap-1.5 h-10 px-4 text-[0.82rem] font-semibold text-[#64748B] bg-white border border-[#E5E7EB] hover:border-[#0C0C0F] hover:text-[#0C0C0F] rounded-lg cursor-pointer transition-colors">
                  Unenroll
                </button>
              )}
              {unenrollErr && <p className="text-xs text-red-500 ml-2">{unenrollErr}</p>}
            </div>

          </div>
        </div>

        {/* Course Sections Accordion */}
        {selected.sections.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-xl border border-dashed border-[#E5E7EB]">
            <p className="text-[0.88rem] font-medium text-[#0C0C0F] mb-1">No content yet</p>
            <p className="text-[0.78rem] text-[#94A3B8]">The instructor hasn't added any materials.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selected.sections.map((section, idx) => {
              const isOpen = expandedSection === section.id
              return (
                <div key={section.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(isOpen ? null : section.id)}
                    className="w-full px-5 py-4 flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer bg-transparent border-none"
                  >
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center text-[0.78rem] font-semibold shrink-0 transition-colors ${isOpen ? 'bg-[#0C0C0F] text-white' : 'bg-[#F1F3F5] text-[#64748B]'}`}>
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-[#0C0C0F] flex-1 text-left text-[0.88rem]">{section.title}</span>
                    <span className="text-[0.7rem] text-[#94A3B8] shrink-0">
                      {section.subsections.length + section.materials.length} item{(section.subsections.length + section.materials.length) !== 1 ? 's' : ''}
                    </span>
                    <svg className={`w-4 h-4 text-[#94A3B8] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isOpen && (section.subsections.length > 0 || section.materials.length > 0) && (
                    <div className="border-t border-[#F1F3F5]">
                      {section.subsections.map((sub, subIdx) => (
                        <div key={sub.id} className={subIdx > 0 ? 'border-t border-[#F1F3F5]' : ''}>
                          <div className="flex items-center gap-4 px-5 py-3.5">
                            <div className="w-8 h-8 rounded-md bg-[#F1F3F5] flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-[#64748B]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[0.85rem] font-medium text-[#0C0C0F] truncate">{sub.title}</div>
                              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.08em] mt-0.5 text-[#94A3B8]">Lesson</div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {section.materials.map((m, mIdx) => {
                        const cfg = typeConfig[m.type] ?? { icon: null, color: 'text-[#64748B]', bg: 'bg-[#F1F3F5]', label: m.type.toUpperCase() }
                        return (
                          <div key={m.id} className={mIdx > 0 || section.subsections.length > 0 ? 'border-t border-[#F1F3F5]' : ''}>
                            <div className="flex items-center gap-4 px-5 py-3.5">
                              <div className={`w-8 h-8 rounded-md ${cfg.bg} flex items-center justify-center shrink-0`}>
                                <span className={cfg.color}>{cfg.icon}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[0.85rem] font-medium text-[#0C0C0F] truncate">{m.title}</div>
                                <div className={`text-[0.66rem] font-semibold uppercase tracking-[0.08em] mt-0.5 ${cfg.color}`}>{cfg.label}</div>
                              </div>
                              {m.type === 'pdf' && m.content_text && (
                                <button
                                  onClick={() => setExpandedMaterial(expandedMaterial === m.id ? null : m.id)}
                                  className="h-8 px-3 text-[0.74rem] font-semibold text-[#0C0C0F] bg-white border border-[#E5E7EB] hover:border-[#0C0C0F] rounded-lg transition-colors cursor-pointer whitespace-nowrap">
                                  {expandedMaterial === m.id ? 'Close' : 'Read'}
                                </button>
                              )}
                            </div>
                            {expandedMaterial === m.id && m.content_text && (
                              <div className="px-6 py-5 bg-[#FAFAFA] border-t border-[#F1F3F5]">
                                <div className="prose-sm max-w-none text-[#0C0C0F] leading-relaxed [&>h1]:text-xl [&>h1]:font-bold [&>h1]:mb-3 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mb-2 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:mb-1.5 [&>p]:mb-3 [&>p]:text-[0.875rem] [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>li]:mb-1">
                                  <Markdown>{m.content_text}</Markdown>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Pre-compute counts / filtered list
  const counts = useMemo(() => {
    const inProgress = enrolled.filter(c => (c.progress_pct ?? 0) > 0 && c.enrollment_status !== 'completed').length
    const completed = enrolled.filter(c => c.enrollment_status === 'completed').length
    const notStarted = enrolled.filter(c => (c.progress_pct ?? 0) === 0 && c.enrollment_status !== 'completed').length
    return { all: enrolled.length, in_progress: inProgress, completed, not_started: notStarted }
  }, [enrolled])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return enrolled.filter(c => {
      if (filter === 'completed' && c.enrollment_status !== 'completed') return false
      if (filter === 'in_progress' && !((c.progress_pct ?? 0) > 0 && c.enrollment_status !== 'completed')) return false
      if (filter === 'not_started' && !((c.progress_pct ?? 0) === 0 && c.enrollment_status !== 'completed')) return false
      if (q && !(c.title.toLowerCase().includes(q) || c.professor_name.toLowerCase().includes(q))) return false
      return true
    })
  }, [enrolled, filter, search])

  const overallPct = enrolled.length === 0
    ? 0
    : Math.round(enrolled.reduce((s, c) => s + (c.progress_pct ?? 0), 0) / enrolled.length)

  const hero = useMemo(
    () => enrolled.find(c => (c.progress_pct ?? 0) > 0 && c.enrollment_status !== 'completed'),
    [enrolled],
  )

  return (
    <div className="max-w-[1200px] animate-fadeIn">

      {/* ── Header ── */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="text-[0.66rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-1.5">Your library</p>
          <h2 className="text-[1.75rem] font-bold tracking-[-0.03em] text-[#0C0C0F] leading-tight">My Learning</h2>
          <p className="text-[0.86rem] text-[#94A3B8] mt-1">Pick up where you left off and keep your streak going</p>
        </div>
        {enrolled.length > 0 && (
          <button
            onClick={() => onNavigate('courses')}
            className="inline-flex items-center gap-2 h-10 px-4 text-[0.82rem] font-semibold text-[#0C0C0F] bg-white border border-[#E5E7EB] hover:border-[#0C0C0F] rounded-xl cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Browse more
          </button>
        )}
      </div>

      {/* ── Stat strip ── */}
      {enrolled.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(12,12,15,0.04)]">
            <div className="w-11 h-11 rounded-xl bg-[#F1F3F5] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#0C0C0F]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[1.4rem] font-bold text-[#0C0C0F] leading-none tabular-nums">{counts.all}</p>
              <p className="text-[0.66rem] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mt-1.5">Enrolled</p>
            </div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(12,12,15,0.04)]">
            <div className="w-11 h-11 rounded-xl bg-[#FFF1ED] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#FF5533]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[1.4rem] font-bold text-[#FF5533] leading-none tabular-nums">{counts.in_progress}</p>
              <p className="text-[0.66rem] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mt-1.5">In Progress</p>
            </div>
          </div>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 py-4 flex items-center gap-3.5 shadow-[0_2px_10px_rgba(12,12,15,0.04)]">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[1.4rem] font-bold text-emerald-600 leading-none tabular-nums">{counts.completed}</p>
              <p className="text-[0.66rem] font-bold text-[#94A3B8] uppercase tracking-[0.1em] mt-1.5">Completed</p>
            </div>
          </div>
          <div className="bg-[#0C0C0F] rounded-2xl px-4 py-4 flex items-center gap-3.5 relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-[#FF5533]/15" />
            <div className="w-11 h-11 rounded-xl bg-white/8 flex items-center justify-center shrink-0 relative" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <svg className="w-5 h-5 text-[#FF5533]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div className="min-w-0 relative">
              <p className="text-[1.4rem] font-bold text-white leading-none tabular-nums">{overallPct}<span className="text-[0.95rem]">%</span></p>
              <p className="text-[0.66rem] font-bold text-white/55 uppercase tracking-[0.1em] mt-1.5">Avg Progress</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl skeleton" />
          ))}
        </div>
      ) : enrolled.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-[#E5E7EB]">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#F1F3F5] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <p className="text-[1.05rem] font-bold text-[#0C0C0F] mb-2">No courses yet</p>
          <p className="text-[0.86rem] text-[#94A3B8] mb-6">Enroll in a course to start learning.</p>
          <button onClick={() => onNavigate('courses')}
            className="h-10 px-6 text-[0.84rem] font-semibold text-white bg-[#0C0C0F] rounded-xl hover:bg-[#1E1E23] transition-colors border-none cursor-pointer">
            Browse courses
          </button>
        </div>
      ) : (
        <>
          {/* ── Resume banner for most-recent in-progress course ── */}
          {hero && (
            <div
              className="mb-6 relative overflow-hidden rounded-2xl cursor-pointer group"
              onClick={() => navigate(`/learn/${hero.id}`)}
            >
              <div className="absolute inset-0 bg-[#0C0C0F]" />
              {hero.thumbnail && (
                <img
                  src={`http://localhost:8000/uploads/${hero.thumbnail}`}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-20 transition-transform duration-700 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0C0C0F] via-[#0C0C0F]/85 to-[#0C0C0F]/20" />
              <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-[#FF5533]/15 blur-3xl" />
              <div className="relative z-10 p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF5533]/15 text-[#FF5533] text-[0.6rem] font-bold tracking-[0.14em] uppercase mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] animate-pulse" />
                    Continue where you left off
                  </span>
                  <h3 className="text-[1.3rem] font-bold text-white leading-snug line-clamp-1 mb-1">{hero.title}</h3>
                  <p className="text-[0.78rem] text-white/45 mb-5">by {hero.professor_name} · {hero.sections_count} section{hero.sections_count !== 1 ? 's' : ''}</p>
                  <div className="flex items-center gap-3 max-w-md">
                    <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#FF5533] to-[#ff7a5e] rounded-full transition-all duration-500"
                        style={{ width: `${hero.progress_pct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-[0.74rem] font-bold text-white/80 tabular-nums shrink-0">{hero.progress_pct ?? 0}% complete</span>
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/learn/${hero.id}`) }}
                  className="shrink-0 flex items-center gap-2 h-11 px-6 bg-[#FF5533] text-white text-[0.84rem] font-bold rounded-xl border-none cursor-pointer hover:bg-[#e5482b] transition-colors shadow-lg shadow-[#FF5533]/30"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Resume
                </button>
              </div>
            </div>
          )}

          {/* ── Filter + Search toolbar ── */}
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white border border-[#E5E7EB] rounded-xl p-1 shadow-[0_2px_8px_rgba(12,12,15,0.03)]">
              {([
                { key: 'all', label: 'All' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'completed', label: 'Completed' },
                { key: 'not_started', label: 'Not Started' },
              ] as const).map(t => {
                const active = filter === t.key
                const count = counts[t.key]
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[0.76rem] font-semibold border-none cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#0C0C0F] text-white'
                        : 'bg-transparent text-[#64748B] hover:bg-[#F1F3F5]'
                    }`}
                  >
                    {t.label}
                    <span className={`min-w-[18px] h-[18px] px-1 rounded-md flex items-center justify-center text-[0.65rem] font-bold tabular-nums ${
                      active ? 'bg-white/15 text-white' : 'bg-[#F1F3F5] text-[#94A3B8]'
                    }`}>{count}</span>
                  </button>
                )
              })}
            </div>
            <div className="relative flex-1 min-w-[200px] sm:max-w-xs sm:flex-initial">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search your courses…"
                className="w-full h-10 pl-9 pr-3 bg-white border border-[#E5E7EB] rounded-xl text-[0.82rem] text-[#0C0C0F] placeholder:text-[#94A3B8] outline-none focus:border-[#0C0C0F] focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-all"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-[#E5E7EB]">
              <p className="text-[0.92rem] font-bold text-[#0C0C0F] mb-1">No matching courses</p>
              <p className="text-[0.82rem] text-[#94A3B8]">Try clearing the filter or search term.</p>
            </div>
          ) : (
            /* ── Course Grid ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
              {filtered.map(c => {
                const pct = c.progress_pct ?? 0
                const isDone = c.enrollment_status === 'completed'
                const isStarted = pct > 0 && !isDone
                return (
                  <div
                    key={c.id}
                    className="group bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden flex flex-col transition-all duration-300 hover:shadow-[0_20px_60px_rgba(12,12,15,0.12)] hover:-translate-y-1 hover:border-[#CBD5E1]"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-[16/9] cursor-pointer overflow-hidden bg-[#0C0C0F]"
                      onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
                    >
                      {c.thumbnail ? (
                        <img
                          src={`http://localhost:8000/uploads/${c.thumbnail}`}
                          alt={c.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#1E1E2A] via-[#0C0C0F] to-[#FF5533]/30 flex items-center justify-center">
                          <span className="text-white/90 text-[2.5rem] font-black tracking-tight">
                            {c.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

                      {/* Status badge top-left */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.62rem] font-bold uppercase tracking-wide bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Done
                          </span>
                        ) : isStarted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.62rem] font-bold uppercase tracking-wide bg-[#FF5533] text-white shadow-lg shadow-[#FF5533]/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            In Progress
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.62rem] font-bold uppercase tracking-wide bg-white/95 text-[#0C0C0F] shadow-lg backdrop-blur-sm">
                            New
                          </span>
                        )}
                        {c.category_name && (
                          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full text-[0.62rem] font-semibold bg-black/40 backdrop-blur-sm text-white border border-white/15">
                            {c.category_name}
                          </span>
                        )}
                      </div>

                      {/* Unenroll button */}
                      <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                        {confirmUnenroll === c.id ? (
                          <div className="flex items-center gap-1 bg-white rounded-xl shadow-xl p-1 border border-[#E5E7EB]">
                            <button
                              onClick={() => handleUnenroll(c.id)}
                              disabled={unenrolling}
                              className="px-2.5 py-1 text-[0.68rem] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg border-none cursor-pointer transition-colors disabled:opacity-50"
                            >
                              {unenrolling ? '…' : 'Remove'}
                            </button>
                            <button
                              onClick={() => setConfirmUnenroll(null)}
                              className="px-2 py-1 text-[0.68rem] font-semibold text-[#64748B] bg-[#F1F3F5] hover:bg-[#E5E7EB] rounded-lg border-none cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmUnenroll(c.id)}
                            className="w-8 h-8 rounded-lg bg-black/55 backdrop-blur-sm flex items-center justify-center text-white/75 hover:text-white hover:bg-black/75 border-none cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                            title="Remove course"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Play overlay on hover */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-300">
                          <svg className="w-5 h-5 text-[#0C0C0F] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3
                        className="text-[0.98rem] font-bold text-[#0C0C0F] leading-snug mb-2 line-clamp-2 cursor-pointer group-hover:text-[#FF5533] transition-colors duration-200 min-h-[2.5rem]"
                        onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
                      >
                        {c.title}
                      </h3>

                      {/* Instructor */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1E1E2A] to-[#0C0C0F] flex items-center justify-center text-white text-[0.6rem] font-bold shrink-0">
                          {c.professor_name.charAt(0).toUpperCase()}
                        </span>
                        <p className="text-[0.76rem] text-[#64748B] truncate">{c.professor_name}</p>
                      </div>

                      {/* Progress section */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[0.66rem] font-bold uppercase tracking-wider text-[#94A3B8]">
                            {isDone ? 'Completed' : isStarted ? 'Progress' : 'Not started'}
                          </span>
                          <span className={`text-[0.74rem] font-bold tabular-nums ${
                            isDone ? 'text-emerald-600' : isStarted ? 'text-[#FF5533]' : 'text-[#94A3B8]'
                          }`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#F1F3F5] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-[#FF5533] to-[#ff7a5e]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer meta + actions */}
                      <div className="mt-auto">
                        <div className="flex items-center gap-3 text-[0.7rem] text-[#94A3B8] mb-3">
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                            </svg>
                            {c.sections_count} section{c.sections_count !== 1 ? 's' : ''}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                          <span className="inline-flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                            {c.enrolled_count}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/learn/${c.id}`)}
                            className={`flex-1 h-10 text-[0.82rem] font-bold rounded-xl flex items-center justify-center gap-1.5 border-none cursor-pointer transition-all duration-200 ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : isStarted
                                  ? 'bg-[#FF5533] text-white hover:bg-[#e5482b] shadow-sm shadow-[#FF5533]/30 hover:shadow-md hover:shadow-[#FF5533]/40'
                                  : 'bg-[#0C0C0F] text-white hover:bg-[#1E1E23]'
                            }`}
                          >
                            {isDone ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                Review
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                {isStarted ? 'Continue' : 'Start'}
                              </>
                            )}
                          </button>
                          <button
                            onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
                            className="h-10 w-10 bg-white text-[#64748B] hover:text-[#0C0C0F] border border-[#E5E7EB] hover:border-[#0C0C0F] rounded-xl transition-all flex items-center justify-center cursor-pointer shrink-0"
                            title="Course details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="9" />
                              <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
                              <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" strokeWidth="2.5" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}


function AnnouncementsSection({ token, universityName }: { token: string; universityName: string }) {
  const [items, setItems] = useState<AnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyAnnouncements(token)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#FF5533] mb-1">University</p>
        <h1 className="text-[1.75rem] font-black tracking-[-0.03em] text-[#0C0C0F]">Announcements</h1>
        {universityName && (
          <p className="text-[0.85rem] text-[#94A3B8] mt-1">From {universityName}</p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 py-12 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF5533" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l19-9-9 19-2-8-8-2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900 mb-1">No announcements yet</p>
          <p className="text-xs text-slate-400">Your university hasn't posted anything yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 11l19-9-9 19-2-8-8-2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[0.85rem] font-semibold text-[#0C0C0F] leading-snug">{a.title}</p>
                    <span className="text-[0.65rem] text-slate-400 shrink-0 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[0.8rem] text-slate-500 mt-1.5 leading-relaxed whitespace-pre-wrap">{a.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Student Analytics ─────────────────────────────────────────────────────── */

function StatCard({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 shadow-[0_4px_20px_rgba(12,12,15,0.04)] relative overflow-hidden">
      {accent && <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent }} />}
      <p className="text-[0.65rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">{label}</p>
      <p className="text-[1.7rem] font-black text-[#0C0C0F] leading-none mb-1">{value}</p>
      {hint && <p className="text-[0.7rem] font-semibold text-[#94A3B8]">{hint}</p>}
    </div>
  )
}

function ActivityChart({ trend }: { trend: StudentActivityPoint[] }) {
  const W = 720
  const H = 180
  const PAD_X = 12
  const PAD_TOP = 16
  const PAD_BOTTOM = 24
  const max = Math.max(1, ...trend.map(t => Math.max(t.lessons_completed, t.quizzes_taken)))
  const stepX = trend.length > 1 ? (W - PAD_X * 2) / (trend.length - 1) : 0
  const yOf = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM)
  const xOf = (i: number) => PAD_X + i * stepX
  const lessonsPath = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(t.lessons_completed).toFixed(1)}`).join(' ')
  const lessonsArea = `${lessonsPath} L${xOf(trend.length - 1).toFixed(1)},${(H - PAD_BOTTOM).toFixed(1)} L${xOf(0).toFixed(1)},${(H - PAD_BOTTOM).toFixed(1)} Z`
  const quizPath = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(t.quizzes_taken).toFixed(1)}`).join(' ')

  const labelEvery = Math.max(1, Math.floor(trend.length / 6))
  const fmtDay = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[180px] min-w-[480px]">
        <defs>
          <linearGradient id="lessons-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5533" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF5533" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f} y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f} stroke="#F1F3F5" strokeWidth="1" />
        ))}
        <path d={lessonsArea} fill="url(#lessons-area)" />
        <path d={lessonsPath} fill="none" stroke="#FF5533" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={quizPath} fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((t, i) => (i % labelEvery === 0 || i === trend.length - 1) && (
          <text key={t.date} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600">{fmtDay(t.date)}</text>
        ))}
      </svg>
    </div>
  )
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

const DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: 'Easy',   color: '#10B981', bg: '#ECFDF5' },
  medium: { label: 'Medium', color: '#F59E0B', bg: '#FFFBEB' },
  hard:   { label: 'Hard',   color: '#EF4444', bg: '#FEF2F2' },
}

function scoreColor(pct: number): string {
  if (pct >= 80) return '#10B981'
  if (pct >= 60) return '#F59E0B'
  return '#EF4444'
}

function StudentAnalyticsSection({ token, onJumpToCourses }: { token: string; onJumpToCourses: () => void }) {
  const [data, setData] = useState<StudentAnalyticsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'score'>('recent')
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'not_started'>('all')

  useEffect(() => {
    setLoading(true); setErr('')
    getStudentAnalytics(token)
      .then(setData)
      .catch(e => setErr(e.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (err) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-8 text-center">
        <p className="text-[0.88rem] text-red-600">{err}</p>
      </div>
    )
  }

  if (!data || data.total_courses === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-2xl px-8 py-16 text-center shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
        <div className="w-14 h-14 mx-auto mb-4 bg-[#F1F3F5] rounded-2xl flex items-center justify-center">
          <ChartIcon />
        </div>
        <p className="text-[0.95rem] font-bold text-[#0C0C0F] mb-1">No learning data yet</p>
        <p className="text-[0.82rem] text-[#94A3B8] mb-4">Enroll in a course and start a quiz to see your progress here.</p>
        <button
          onClick={onJumpToCourses}
          className="px-4 py-2 bg-[#0C0C0F] text-white text-[0.78rem] font-bold rounded-md border-none cursor-pointer hover:bg-[#1E1E23] transition-colors"
        >
          Browse courses
        </button>
      </div>
    )
  }

  const filtered = data.courses.filter(c => {
    if (filter === 'completed') return c.enrollment_status === 'completed'
    if (filter === 'not_started') return c.progress_pct === 0 && c.enrollment_status !== 'completed'
    if (filter === 'in_progress') return c.progress_pct > 0 && c.enrollment_status !== 'completed'
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'progress') return b.progress_pct - a.progress_pct
    if (sortBy === 'score') return b.quiz.avg_score_pct - a.quiz.avg_score_pct
    return new Date(b.enrolled_at).getTime() - new Date(a.enrolled_at).getTime()
  })

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-black text-[#0C0C0F] tracking-tight leading-tight">My Progress</h2>
          <p className="text-[0.82rem] text-[#94A3B8] mt-0.5">
            Tracking {data.total_courses} course{data.total_courses === 1 ? '' : 's'} · last 30 days of activity
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[0.7rem] font-bold text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#FF5533]" /> Lessons
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 border-t-[2px] border-dashed border-[#3B82F6]" /> Quizzes
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Overall progress"
          value={`${data.overall_progress_pct}%`}
          hint={`${data.total_completed} completed · ${data.total_in_progress} active`}
          accent="#FF5533"
        />
        <StatCard
          label="Quiz average"
          value={data.total_quiz_attempts > 0 ? `${data.overall_quiz_avg_pct}%` : '—'}
          hint={`${data.total_quiz_attempts} attempt${data.total_quiz_attempts === 1 ? '' : 's'}`}
          accent="#3B82F6"
        />
        <StatCard
          label="Pass rate"
          value={data.total_quiz_attempts > 0 ? `${data.overall_quiz_pass_rate}%` : '—'}
          hint={`${data.quizzes_passed} passed`}
          accent="#10B981"
        />
        <StatCard
          label="Current streak"
          value={`${data.current_streak_days}d`}
          hint={data.longest_streak_days > 0 ? `Best: ${data.longest_streak_days}d` : '—'}
          accent="#F59E0B"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
            <div>
              <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Learning activity</p>
              <p className="text-[1.1rem] font-black text-[#0C0C0F] leading-tight">Last 30 days</p>
            </div>
            <div className="flex items-end gap-5">
              <div className="text-right">
                <p className="text-[1.2rem] font-black text-[#FF5533] leading-none">{data.lessons_completed_30d}</p>
                <p className="text-[0.66rem] font-semibold text-[#94A3B8] uppercase tracking-wide mt-0.5">lessons</p>
              </div>
              <div className="text-right">
                <p className="text-[1.2rem] font-black text-[#3B82F6] leading-none">{data.quizzes_taken_30d}</p>
                <p className="text-[0.66rem] font-semibold text-[#94A3B8] uppercase tracking-wide mt-0.5">quizzes</p>
              </div>
              <div className="text-right">
                <p className="text-[1.2rem] font-black text-[#0C0C0F] leading-none">{data.active_days_30d}</p>
                <p className="text-[0.66rem] font-semibold text-[#94A3B8] uppercase tracking-wide mt-0.5">active days</p>
              </div>
            </div>
          </div>
          <ActivityChart trend={data.activity_trend} />
        </div>

        {/* Difficulty breakdown */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Quiz performance</p>
          {data.total_quiz_attempts > 0 ? (
            <div className="space-y-3">
              {(['easy', 'medium', 'hard'] as const).map(diff => {
                const stat = data.difficulty_breakdown[diff] ?? { attempts: 0, avg_score_pct: 0, pass_rate: 0 }
                const meta = DIFFICULTY_META[diff]
                return (
                  <div key={diff}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="text-[0.7rem] font-semibold text-[#94A3B8]">{stat.attempts} attempt{stat.attempts === 1 ? '' : 's'}</span>
                      </div>
                      <span className="text-[0.78rem] font-black tabular-nums" style={{ color: stat.attempts > 0 ? scoreColor(stat.avg_score_pct) : '#94A3B8' }}>
                        {stat.attempts > 0 ? `${stat.avg_score_pct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#F1F3F5] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stat.attempts > 0 ? stat.avg_score_pct : 0}%`, background: meta.color }} />
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-[#F1F3F5] mt-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-wide">Best score</span>
                  <span className="text-[1.2rem] font-black tabular-nums" style={{ color: scoreColor(data.best_quiz_score_pct) }}>{data.best_quiz_score_pct}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 mb-2 rounded-full bg-[#F1F3F5] flex items-center justify-center">
                <ChartIcon />
              </div>
              <p className="text-[0.78rem] font-semibold text-[#0C0C0F]">No quizzes yet</p>
              <p className="text-[0.7rem] text-[#94A3B8] mt-0.5">Take a quiz inside any course to see your stats.</p>
            </div>
          )}
        </div>
      </div>

      {/* Highlights + recent attempts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Strongest subject</p>
          {data.strongest_course ? (
            <div>
              <p className="text-[0.95rem] font-black text-[#0C0C0F] truncate">{data.strongest_course.course_title}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-[2rem] font-black leading-none" style={{ color: scoreColor(data.strongest_course.avg_score_pct) }}>
                  {data.strongest_course.avg_score_pct}%
                </span>
                <span className="text-[0.7rem] font-semibold text-[#94A3B8]">avg over {data.strongest_course.attempts} quiz{data.strongest_course.attempts === 1 ? '' : 'zes'}</span>
              </div>
            </div>
          ) : (
            <p className="text-[0.78rem] text-[#94A3B8]">Take quizzes to identify your strengths.</p>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Needs work</p>
          {data.needs_work_course ? (
            <div>
              <p className="text-[0.95rem] font-black text-[#0C0C0F] truncate">{data.needs_work_course.course_title}</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-[2rem] font-black leading-none" style={{ color: scoreColor(data.needs_work_course.avg_score_pct) }}>
                  {data.needs_work_course.avg_score_pct}%
                </span>
                <span className="text-[0.7rem] font-semibold text-[#94A3B8]">avg over {data.needs_work_course.attempts} quiz{data.needs_work_course.attempts === 1 ? '' : 'zes'}</span>
              </div>
            </div>
          ) : (
            <p className="text-[0.78rem] text-[#94A3B8]">All courses are looking strong — keep going.</p>
          )}
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Completion mix</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-[2rem] font-black text-[#0C0C0F] leading-none">{data.total_courses}</span>
            <span className="text-[0.7rem] font-semibold text-[#94A3B8] mb-1">enrolled</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-[#F1F3F5] mb-2">
            {data.total_courses > 0 && (
              <>
                <div style={{ width: `${data.total_completed / data.total_courses * 100}%`, background: '#10B981' }} />
                <div style={{ width: `${data.total_in_progress / data.total_courses * 100}%`, background: '#FF5533' }} />
                <div style={{ width: `${data.total_not_started / data.total_courses * 100}%`, background: '#94A3B8' }} />
              </>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-[0.66rem] font-bold">
            <div className="text-center">
              <span className="block text-emerald-600 text-[0.95rem] font-black tabular-nums">{data.total_completed}</span>
              <span className="text-[#94A3B8] uppercase tracking-wide">Done</span>
            </div>
            <div className="text-center">
              <span className="block text-[#FF5533] text-[0.95rem] font-black tabular-nums">{data.total_in_progress}</span>
              <span className="text-[#94A3B8] uppercase tracking-wide">Active</span>
            </div>
            <div className="text-center">
              <span className="block text-slate-500 text-[0.95rem] font-black tabular-nums">{data.total_not_started}</span>
              <span className="text-[#94A3B8] uppercase tracking-wide">Not yet</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent quiz attempts */}
      <div className="mb-8">
        <h3 className="text-[1.05rem] font-black text-[#0C0C0F] mb-3">Recent quiz attempts</h3>
        {data.recent_attempts.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E5E7EB] rounded-2xl px-6 py-10 text-center">
            <p className="text-[0.82rem] text-[#94A3B8]">You haven't taken any quizzes yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_4px_20px_rgba(12,12,15,0.04)] divide-y divide-[#F1F3F5]">
            {data.recent_attempts.map(a => {
              const meta = DIFFICULTY_META[a.difficulty] ?? DIFFICULTY_META.medium
              return (
                <div key={a.attempt_id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center font-black text-[0.78rem]" style={{ background: a.passed ? '#ECFDF5' : '#FEF2F2', color: a.passed ? '#10B981' : '#EF4444' }}>
                    {a.passed ? (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.88rem] font-bold text-[#0C0C0F] truncate">{a.course_title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      <span className="text-[0.7rem] text-[#94A3B8]">{relTime(a.completed_at)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[1.05rem] font-black tabular-nums" style={{ color: scoreColor(a.score_pct) }}>{a.score_pct}%</p>
                    <p className="text-[0.66rem] font-semibold text-[#94A3B8] tabular-nums">{a.score} / {a.total}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Per-course breakdown */}
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-[1.05rem] font-black text-[#0C0C0F]">Course breakdown</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#F1F3F5] rounded-lg p-0.5">
            {([
              { id: 'all', label: 'All' },
              { id: 'in_progress', label: 'Active' },
              { id: 'completed', label: 'Done' },
              { id: 'not_started', label: 'Not yet' },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 h-7 rounded-md text-[0.7rem] font-bold transition ${filter === f.id ? 'bg-white text-[#0C0C0F] shadow-sm' : 'text-[#94A3B8] hover:text-[#0C0C0F]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 px-3 pr-8 border border-[#E5E7EB] rounded-lg bg-white text-[0.74rem] font-bold text-[#0C0C0F] focus:outline-none focus:ring-2 focus:ring-[#0C0C0F]/10"
          >
            <option value="recent">Sort: Recent</option>
            <option value="progress">Sort: Progress</option>
            <option value="score">Sort: Quiz score</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-6 py-10 text-center">
            <p className="text-[0.82rem] text-[#94A3B8]">No courses match this filter.</p>
          </div>
        ) : sorted.map(course => {
          const progressColor = course.progress_pct >= 75 ? '#10B981' : course.progress_pct >= 25 ? '#FF5533' : '#3B82F6'
          const isDone = course.enrollment_status === 'completed'
          return (
            <div key={course.course_id} className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_4px_20px_rgba(12,12,15,0.04)] overflow-hidden px-5 py-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 shrink-0 rounded-xl bg-[#F1F3F5] overflow-hidden border border-[#E5E7EB]">
                  {course.thumbnail ? (
                    <img src={`http://localhost:8000/uploads/${course.thumbnail}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#94A3B8]"><BookIcon /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="text-[0.95rem] font-black text-[#0C0C0F] truncate">{course.course_title}</p>
                    {isDone ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[0.6rem] font-bold uppercase tracking-wide border border-emerald-200">Completed</span>
                    ) : course.progress_pct === 0 ? (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F1F3F5] text-[#94A3B8] text-[0.6rem] font-bold uppercase tracking-wide">Not started</span>
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-[0.6rem] font-bold uppercase tracking-wide border border-orange-200">In progress</span>
                    )}
                    {course.category_name && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F8F9FA] text-[#0C0C0F] text-[0.6rem] font-bold uppercase tracking-wide border border-[#E5E7EB]">{course.category_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[0.72rem] text-[#94A3B8] flex-wrap">
                    <span>{course.professor_name}</span>
                    <span>·</span>
                    <span>Enrolled {relTime(course.enrolled_at)}</span>
                    {course.quiz.last_attempt_at && (
                      <>
                        <span>·</span>
                        <span>Last quiz {relTime(course.quiz.last_attempt_at)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                  <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Lessons</p>
                  <p className="text-[1.05rem] font-black text-[#0C0C0F] leading-none">{course.completed_items}/{course.total_items}</p>
                </div>
                <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                  <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Quizzes</p>
                  <p className="text-[1.05rem] font-black text-[#3B82F6] leading-none">{course.quiz.attempts}</p>
                </div>
                <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                  <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Avg score</p>
                  <p className="text-[1.05rem] font-black leading-none" style={{ color: course.quiz.attempts > 0 ? scoreColor(course.quiz.avg_score_pct) : '#94A3B8' }}>
                    {course.quiz.attempts > 0 ? `${course.quiz.avg_score_pct}%` : '—'}
                  </p>
                </div>
                <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                  <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Best</p>
                  <p className="text-[1.05rem] font-black leading-none" style={{ color: course.quiz.attempts > 0 ? scoreColor(course.quiz.best_score_pct) : '#94A3B8' }}>
                    {course.quiz.attempts > 0 ? `${course.quiz.best_score_pct}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-[0.68rem] mb-1.5">
                  <span className="text-[#94A3B8] font-semibold">Course progress</span>
                  <span className="font-bold text-[#0C0C0F]">{course.progress_pct}%</span>
                </div>
                <div className="h-2 bg-[#F1F3F5] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${course.progress_pct}%`, background: progressColor }} />
                </div>
              </div>

              {/* Per-difficulty mini bars (only show if there's quiz data) */}
              {course.quiz.attempts > 0 && (
                <div className="mt-4 pt-4 border-t border-[#F1F3F5] grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map(diff => {
                    const stat = course.quiz.by_difficulty[diff] ?? { attempts: 0, avg_score_pct: 0, pass_rate: 0 }
                    const meta = DIFFICULTY_META[diff]
                    return (
                      <div key={diff}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[0.6rem] font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="text-[0.7rem] font-black tabular-nums text-[#0C0C0F]">
                            {stat.attempts > 0 ? `${stat.avg_score_pct}%` : '—'}
                          </span>
                        </div>
                        <div className="h-1 bg-[#F1F3F5] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${stat.attempts > 0 ? stat.avg_score_pct : 0}%`, background: meta.color }} />
                        </div>
                        <p className="text-[0.6rem] font-semibold text-[#94A3B8] mt-0.5">{stat.attempts} attempt{stat.attempts === 1 ? '' : 's'}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const { user, token } = useAuth()
  const [nav, setNav] = useState('home')
  const [mounted, setMounted] = useState<Set<string>>(() => new Set(['home']))
  const [enrolledCourses, setEnrolledCourses] = useState<CourseOut[]>([])
  const [enrolledLoading, setEnrolledLoading] = useState(true)
  const firstName = user?.full_name?.split(' ')[0] || ''

  useEffect(() => {
    setMounted(prev => {
      if (prev.has(nav)) return prev
      const next = new Set(prev)
      next.add(nav)
      return next
    })
  }, [nav])

  const refreshEnrolled = useCallback(async () => {
    if (!token) return
    try {
      const c = await getEnrolledCourses(token)
      setEnrolledCourses(c)
    } catch { /* swallow — surfaced via individual section UIs */ }
  }, [token])

  useEffect(() => {
    if (!token) return
    setEnrolledLoading(true)
    refreshEnrolled().finally(() => setEnrolledLoading(false))
  }, [token, refreshEnrolled])

  const handleEnrollmentConfirmed = useCallback((notif: AppNotification) => {
    if (notif.type === 'enrollment_confirmed') {
      refreshEnrolled()
    }
  }, [refreshEnrolled])

  const resumeCourse = enrolledCourses.reduce<CourseOut | null>(
    (best, c) => {
      const pct = c.progress_pct ?? 0
      const bestPct = best?.progress_pct ?? 0
      return pct > 0 && pct < 100 && pct > bestPct ? c : best
    },
    null,
  )

  const navItems = user?.university_id
    ? [...BASE_NAV.slice(0, -1), ANNOUNCEMENTS_NAV_ITEM, BASE_NAV[BASE_NAV.length - 1]]
    : BASE_NAV

  const knownNavIds = new Set(['home', 'courses', 'my-courses', 'gamification', 'messages', 'find-friends', 'announcements', 'grades'])

  return (
    <DashboardLayout navItems={navItems} activeNav={nav} onNavChange={setNav} roleLabel="Student" onNotification={handleEnrollmentConfirmed}>

      {/* ── Courses ── */}
      <div className={nav !== 'courses' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('courses') && (
          <BrowseCoursesSection
            token={token!}
            enrolled={enrolledCourses}
            refreshEnrolled={refreshEnrolled}
          />
        )}
      </div>

      {/* ── My Courses ── */}
      <div className={nav !== 'my-courses' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('my-courses') && (
          <MyCoursesSection
            token={token!}
            onNavigate={setNav}
            enrolled={enrolledCourses}
            enrolledLoading={enrolledLoading}
            refreshEnrolled={refreshEnrolled}
          />
        )}
      </div>

      {/* ── Messages ── */}
      <div className={nav !== 'messages' ? 'hidden' : 'max-w-[1100px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('messages') && <FriendsMessenger token={token!} currentUserId={user!.id} />}
      </div>

      {/* ── Find Friends ── */}
      <div className={nav !== 'find-friends' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('find-friends') && (
          <>
            <h2 className="text-[1.3rem] font-bold text-[#0C0C0F] mb-6">Find Friends</h2>
            <FindFriends token={token!} />
          </>
        )}
      </div>

      {/* ── Announcements ── */}
      <div className={nav !== 'announcements' ? 'hidden' : 'max-w-[700px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('announcements') && <AnnouncementsSection token={token!} universityName={user?.university_name ?? ''} />}
      </div>

      {/* ── Grades / Analytics ── */}
      <div className={nav !== 'grades' ? 'hidden' : 'max-w-[1200px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('grades') && <StudentAnalyticsSection token={token!} onJumpToCourses={() => setNav('courses')} />}
      </div>

      {/* ── Gamification / Hero Stats ── */}
      <div className={nav !== 'gamification' ? 'hidden' : ''}>
        {mounted.has('gamification') && <GamificationPage />}
      </div>

      {/* ── Coming-soon sections ── */}
      {!knownNavIds.has(nav) && (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-[1.1rem] font-bold text-[#0C0C0F]">{navItems.find(n => n.id === nav)?.label}</h2>
            <p className="text-[0.82rem] text-[#94A3B8] mt-1">Coming soon</p>
          </div>
        </div>
      )}

      {/* ── Home ── */}
      <div className={nav !== 'home' ? 'hidden' : 'max-w-[1080px] mx-auto px-6 md:px-10 py-10'}>

        {/* Header */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[0.66rem] font-bold tracking-[0.18em] uppercase text-[#FF5533] mb-2.5">{getGreeting()}</p>
            <h1 className="text-[1.85rem] sm:text-[2.1rem] font-semibold tracking-[-0.025em] leading-[1.1] text-[#0C0C0F]">
              Welcome back, {firstName || 'student'}.
            </h1>
            <p className="text-[#64748B] text-[0.92rem] mt-2.5 max-w-xl leading-relaxed">
              Continue learning, browse new courses, or revisit lessons you started.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setNav('courses')}
              className="h-10 px-5 rounded-lg bg-[#0C0C0F] text-white font-semibold text-[0.84rem] border-none cursor-pointer hover:bg-[#1E1E23] transition-colors"
            >
              Explore courses
            </button>
            <button
              onClick={() => setNav('my-courses')}
              className="h-10 px-5 rounded-lg border border-[#E5E7EB] bg-white text-[#0C0C0F] font-semibold text-[0.84rem] cursor-pointer hover:border-[#0C0C0F] transition-colors"
            >
              My learning
            </button>
          </div>
        </div>

        {/* Hero Stats — XP / Level / Streak */}
        <div className="mb-10">
          <ProfileStats />
        </div>

        {/* Stats strip */}
        <div className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#E5E7EB] rounded-xl overflow-hidden border border-[#E5E7EB]">
          {[
            { value: enrolledCourses.length, label: 'Enrolled' },
            { value: enrolledCourses.filter(c => c.enrollment_status === 'completed').length, label: 'Completed' },
            { value: enrolledCourses.filter(c => (c.progress_pct ?? 0) > 0 && c.enrollment_status !== 'completed').length, label: 'In progress' },
          ].map(s => (
            <div key={s.label} className="bg-white px-5 py-5">
              <p className="text-[1.65rem] font-semibold tracking-tight text-[#0C0C0F] leading-none tabular-nums">{s.value}</p>
              <p className="text-[0.66rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mt-2.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* University affiliation */}
        <div className="mb-10">
          <UniversityCard token={token!} />
        </div>

        {/* Continue learning */}
        {resumeCourse && (
          <div className="mb-10">
            <h2 className="text-[0.66rem] font-bold tracking-[0.14em] uppercase text-[#94A3B8] mb-4">Pick up where you left off</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="min-w-0 flex-1">
                  {resumeCourse.category_name && (
                    <span className="inline-block text-[0.6rem] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded mb-2 bg-[#F1F3F5] text-[#64748B]">
                      {resumeCourse.category_name}
                    </span>
                  )}
                  <h3 className="text-[1.05rem] font-semibold text-[#0C0C0F] mb-1 leading-snug">{resumeCourse.title}</h3>
                  <p className="text-[0.8rem] text-[#94A3B8]">{resumeCourse.professor_name}</p>
                </div>
                <button
                  onClick={() => setNav('my-courses')}
                  className="px-4 h-9 bg-[#0C0C0F] text-white text-[0.8rem] font-semibold rounded-lg border-none cursor-pointer hover:bg-[#1E1E23] transition-colors shrink-0"
                >
                  Resume
                </button>
              </div>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex-1 h-1 bg-[#F1F3F5] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#FF5533]" style={{ width: `${resumeCourse.progress_pct ?? 0}%` }} />
                </div>
                <span className="text-[0.76rem] font-semibold text-[#0C0C0F] tabular-nums w-10 text-right">{resumeCourse.progress_pct ?? 0}%</span>
              </div>
            </div>
          </div>
        )}

        {/* My courses progress list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[0.66rem] font-bold tracking-[0.14em] uppercase text-[#94A3B8]">My courses</h2>
            {enrolledCourses.length > 0 && (
              <button
                onClick={() => setNav('my-courses')}
                className="text-[0.76rem] font-semibold text-[#64748B] hover:text-[#0C0C0F] bg-transparent border-none cursor-pointer transition-colors"
              >
                See all →
              </button>
            )}
          </div>
          {enrolledCourses.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-xl px-6 py-12 text-center">
              <p className="text-[0.88rem] text-[#0C0C0F] font-medium">No courses yet</p>
              <p className="text-[0.78rem] text-[#94A3B8] mt-1">Browse the catalog to get started.</p>
              <button onClick={() => setNav('courses')} className="mt-5 px-4 h-9 bg-[#0C0C0F] text-white text-[0.8rem] font-semibold rounded-lg border-none cursor-pointer hover:bg-[#1E1E23] transition-colors">
                Browse courses
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#F1F3F5] overflow-hidden">
              {enrolledCourses.map(c => {
                const pct = c.progress_pct ?? 0
                const isDone = c.enrollment_status === 'completed'
                return (
                  <div
                    key={c.id}
                    onClick={() => setNav('my-courses')}
                    className="group flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-[#FAFAFA]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#0C0C0F] text-white flex items-center justify-center text-[0.82rem] font-semibold shrink-0">
                      {c.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.88rem] font-semibold text-[#0C0C0F] truncate group-hover:text-[#FF5533] transition-colors">{c.title}</div>
                      <div className="text-[0.74rem] text-[#94A3B8] truncate">{c.professor_name}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isDone ? (
                        <span className="flex items-center gap-1 text-[0.72rem] font-semibold text-emerald-600">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Completed
                        </span>
                      ) : (
                        <>
                          <div className="w-20 h-1 bg-[#F1F3F5] rounded-full overflow-hidden hidden sm:block">
                            <div className="h-full rounded-full bg-[#FF5533]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[0.78rem] font-semibold text-[#0C0C0F] tabular-nums w-10 text-right">{pct}%</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}

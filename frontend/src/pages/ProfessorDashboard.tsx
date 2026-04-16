import { useState, useEffect, useRef } from 'react'
import Markdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'
import {
  getMyCourses, createCourse, addSection, uploadMaterial, togglePublish, listPublishedCourses,
  getMyStudents, getEnrolledCourses, enrollInCourse, unenrollFromCourse, deleteCourse,
  type CourseOut, type SectionOut, type CourseStudentsOut,
} from '../api/course'
import { listCategories, type CategoryOut } from '../api/category'
import { getIncomingChatRequests, reviewChatRequest, getAutoRefuse, setAutoRefuse, type ChatRequestOut } from '../api/chat'
import ChatRoom from '../components/ChatRoom'
import {
  listUniversities, listRegions, submitJoinRequest, listJoinRequests, cancelJoinRequest,
  type UniversityOut, type JoinRequestOut, type RegionOut,
} from '../api/org'
import {
  submitVerification, listVerifications, cancelVerification,
  type ProfVerificationOut,
} from '../api/prof_verification'

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
const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const TrendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
)
const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)
const ChatIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const GraduationCapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
)

const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'courses', label: 'Courses', icon: <BookIcon /> },
  { id: 'my-courses', label: 'My Courses', icon: <FolderIcon /> },
  { id: 'my-learning', label: 'My Learning', icon: <GraduationCapIcon /> },
  { id: 'students', label: 'Students', icon: <UsersIcon /> },
  { id: 'chat', label: 'Chat Requests', icon: <ChatIcon /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendIcon /> },
]

/* ── Mock data (home only) ── */
const ACTIVITY = [
  { student: 'Amine B.', action: 'submitted Assignment 3 in', course: 'Machine Learning', time: '2m ago' },
  { student: 'Yasmine K.', action: 'asked a question in', course: 'Deep Learning', time: '15m ago' },
  { student: 'Karim M.', action: 'completed Quiz 5 in', course: 'Neural Networks', time: '1h ago' },
]

const MATERIAL_TYPES = [
  { value: 'pdf', label: 'PDF', accept: '.pdf' },
  { value: 'video', label: 'Video', accept: '.mp4,.webm,.mov,.avi' },
  { value: 'audio', label: 'Audio', accept: '.mp3,.wav,.ogg,.m4a' },
  { value: 'exercise', label: 'Exercise', accept: '.pdf,.docx,.zip,.txt' },
]

/* ── Shared input style ── */
const inputCls = 'h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.87rem] text-[#0C0C0F] bg-white outline-none placeholder:text-[#C4C9D4] focus:border-[#0C0C0F] focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-[border-color,box-shadow] w-full'

/* ── Professor Verification Banner ── */
function VerificationBanner({ token }: { token: string }) {
  const { refreshUser } = useAuth()
  const [regions, setRegions] = useState<RegionOut[]>([])
  const [requests, setRequests] = useState<ProfVerificationOut[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    region_id: '',
    birth_date: '',
    first_name: '',
    father_name: '',
    grandfather_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [err, setErr] = useState('')

  const pending = requests.find(r => r.status === 'pending')
  const rejected = requests.find(r => r.status === 'rejected')

  useEffect(() => {
    listRegions(token).then(setRegions).catch(() => {})
    listVerifications(token).then(setRequests).catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.region_id || !form.birth_date || !form.first_name || !form.father_name || !form.grandfather_name) return
    setSaving(true); setErr('')
    try {
      const req = await submitVerification(token, {
        region_id: form.region_id,
        birth_date: form.birth_date,
        first_name: form.first_name.trim(),
        father_name: form.father_name.trim(),
        grandfather_name: form.grandfather_name.trim(),
      })
      setRequests(prev => [req, ...prev])
      setShowForm(false)
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleCancel = async (id: string) => {
    setCancelling(true)
    try {
      await cancelVerification(token, id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { setErr(e.message) }
    finally { setCancelling(false) }
  }

  const inputCls = 'h-10 px-3 border border-amber-200 rounded-lg text-[0.87rem] text-[#0C0C0F] bg-white outline-none placeholder:text-[#C4C9D4] focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.1)] transition-[border-color,box-shadow] w-full'

  return (
    <div className="mb-8 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-[0_8px_24px_rgba(217,119,6,0.1)]">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[0.92rem] font-bold text-amber-900">Account not verified</p>
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[0.7rem] font-bold uppercase tracking-wide">Draft only</span>
          </div>
          <p className="text-[0.84rem] text-amber-700 leading-relaxed">
            You can create and edit courses, but publishing requires verification by a region admin.
            Submit your civil identity details below to request verification.
          </p>

          {/* Pending request state */}
          {pending && !showForm && (
            <div className="mt-3 flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-[0.8rem] font-semibold text-amber-800">Verification request pending</p>
                <p className="text-[0.76rem] text-amber-600 mt-0.5">
                  Region: {pending.region_name} · Submitted {new Date(pending.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleCancel(pending.id)}
                disabled={cancelling}
                className="text-xs font-semibold text-amber-600 hover:text-red-600 bg-transparent border-none cursor-pointer disabled:opacity-50 transition-colors"
              >
                {cancelling ? '...' : 'Cancel'}
              </button>
            </div>
          )}

          {/* Rejected state */}
          {rejected && !pending && !showForm && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-[0.8rem] font-semibold text-red-700">Previous request rejected</p>
              <p className="text-[0.76rem] text-red-500 mt-0.5">You can submit a new request.</p>
            </div>
          )}

          {/* Submit form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[0.7rem] font-bold uppercase tracking-wide text-amber-700 mb-1">Region *</label>
                  <select
                    value={form.region_id}
                    onChange={e => setForm(f => ({ ...f, region_id: e.target.value }))}
                    className="h-10 px-3 border border-amber-200 rounded-lg text-[0.87rem] bg-white outline-none focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(217,119,6,0.1)] transition-all w-full"
                    required
                  >
                    <option value="">Select your region</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[0.7rem] font-bold uppercase tracking-wide text-amber-700 mb-1">Date of birth *</label>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-bold uppercase tracking-wide text-amber-700 mb-1">Your first name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ahmed"
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-bold uppercase tracking-wide text-amber-700 mb-1">Father's name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Mohamed"
                    value={form.father_name}
                    onChange={e => setForm(f => ({ ...f, father_name: e.target.value }))}
                    className={inputCls}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[0.7rem] font-bold uppercase tracking-wide text-amber-700 mb-1">Grandfather's name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Ali"
                    value={form.grandfather_name}
                    onChange={e => setForm(f => ({ ...f, grandfather_name: e.target.value }))}
                    className={inputCls}
                    required
                  />
                </div>
              </div>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-5 rounded-lg bg-amber-600 text-white text-[0.84rem] font-semibold cursor-pointer hover:bg-amber-700 disabled:bg-amber-300 border-none transition-colors"
                >
                  {saving ? 'Submitting...' : 'Submit for verification'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setErr('') }}
                  className="h-9 px-4 rounded-lg text-[0.84rem] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            !pending && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-[0.82rem] font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 bg-transparent border-none cursor-pointer p-0 transition-colors"
              >
                + Request verification from region admin
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

/* ── University affiliation card (request-based) ── */
function UniversityCard({ token }: { token: string }) {
  const { user } = useAuth()
  const [unis, setUnis] = useState<UniversityOut[]>([])
  const [requests, setRequests] = useState<JoinRequestOut[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedUni, setSelectedUni] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const pendingReq = requests.find(r => r.status === 'pending')

  useEffect(() => {
    listUniversities(token).then(setUnis).catch(() => {})
    listJoinRequests(token).then(setRequests).catch(() => {})
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUni) return
    setSaving(true); setErr('')
    try {
      const req = await submitJoinRequest(token, { university_id: selectedUni, note: note.trim() || undefined })
      setRequests(prev => [req, ...prev])
      setShowForm(false); setSelectedUni(''); setNote('')
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await cancelJoinRequest(token, id)
      setRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { setErr(e.message) }
    finally { setCancelling(null) }
  }

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-4 shadow-sm space-y-3">
      <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8]">My University</p>

      {/* Currently assigned */}
      {user?.university_name && (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <div>
            <p className="text-[0.88rem] font-semibold text-[#0C0C0F]">{user.university_name}</p>
            {user.region_name && <p className="text-xs text-[#94A3B8]">{user.region_name}</p>}
          </div>
        </div>
      )}

      {/* Pending request banner */}
      {pendingReq && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-amber-700">Pending request</p>
            <p className="text-[0.8rem] text-amber-600">{pendingReq.university_name}</p>
          </div>
          <button
            onClick={() => handleCancel(pendingReq.id)}
            disabled={cancelling === pendingReq.id}
            className="text-xs text-amber-600 hover:text-red-600 font-semibold bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            {cancelling === pendingReq.id ? '...' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Request form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-2 pt-1">
          <select
            value={selectedUni}
            onChange={e => setSelectedUni(e.target.value)}
            className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.87rem] bg-white outline-none focus:border-[#0C0C0F] focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-all"
          >
            <option value="">Select a university *</option>
            {unis.map(u => (
              <option key={u.id} value={u.id}>{u.name}{u.region_name ? ` · ${u.region_name}` : ''}</option>
            ))}
          </select>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Short note for the admin (optional)"
            className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-[0.87rem] bg-white outline-none focus:border-[#0C0C0F] focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-all"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!selectedUni || saving}
              className="flex-1 h-9 rounded-lg bg-[#0C0C0F] text-white text-[0.84rem] font-semibold cursor-pointer hover:bg-[#1E1E23] disabled:bg-[#D1D5DB] border-none transition-colors"
            >
              {saving ? 'Sending...' : 'Send request'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setSelectedUni(''); setNote(''); setErr('') }}
              className="h-9 px-4 rounded-lg text-[0.84rem] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </form>
      ) : (
        !pendingReq && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-[#FF5533] hover:underline bg-transparent border-none cursor-pointer p-0"
          >
            {user?.university_name ? 'Request to change university' : '+ Request to join a university'}
          </button>
        )
      )}
    </div>
  )
}

/* ── File picker ── */
function FilePicker({ accept, file, onChange, placeholder = 'Click to select file' }: {
  accept: string; file: File | null; onChange: (f: File | null) => void; placeholder?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onClick={() => ref.current?.click()}
      className={`relative h-12 px-4 border-2 border-dashed rounded-xl bg-white cursor-pointer flex items-center gap-3 transition-all duration-200 ${
        file 
          ? 'border-emerald-300 bg-emerald-50/50' 
          : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
      }`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${file ? 'bg-emerald-100' : 'bg-slate-100'}`}>
        {file ? (
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        )}
      </div>
      <span className={`flex-1 text-sm truncate ${file ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
        {file ? file.name : placeholder}
      </span>
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
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  )
}

/* ── Upload Material inline form ── */
function UploadMaterialForm({ token, courseId, section, onDone }: {
  token: string; courseId: string; section: SectionOut; onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [matType, setMatType] = useState('pdf')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const currentAccept = MATERIAL_TYPES.find(t => t.value === matType)?.accept ?? '*'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !file) return
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('mat_type', matType)
      fd.append('order_index', String(section.materials.length))
      fd.append('file', file)
      await uploadMaterial(token, courseId, section.id, fd)
      onDone()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  const typeIcons: Record<string, React.ReactNode> = {
    pdf: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    video: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>,
    audio: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>,
    exercise: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
  }

  return (
    <form 
      onSubmit={handleSubmit} 
      className="mt-4 p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200 rounded-xl flex flex-col gap-4 animate-fadeIn"
      style={{ animation: 'fadeInUp 0.3s ease-out' }}
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-slate-800">Upload new material</span>
      </div>

      {err && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {err}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Material title</label>
        <input 
          className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200" 
          placeholder="e.g. Chapter 1: Introduction" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Material type</label>
        <div className="flex gap-2 flex-wrap">
          {MATERIAL_TYPES.map(t => (
            <button 
              key={t.value} 
              type="button"
              onClick={() => { setMatType(t.value); setFile(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
                matType === t.value 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' 
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {typeIcons[t.value]}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">File</label>
        <FilePicker accept={currentAccept} file={file} onChange={setFile} />
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button 
          type="button" 
          onClick={onDone}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={!title.trim() || !file || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white border-none cursor-pointer hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-slate-900/20"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload
            </>
          )}
        </button>
      </div>
    </form>
  )
}

/* ── Course Manager ── */
function CourseManager({ token, course, onBack, onRefresh }: {
  token: string; course: CourseOut; onBack: () => void; onRefresh: (updated: CourseOut) => void
}) {
  const { user } = useAuth()
  const [sectionTitle, setSectionTitle] = useState('')
  const [addingSec, setAddingSec] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishErr, setPublishErr] = useState('')
  const [current, setCurrent] = useState(course)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const refresh = async () => {
    const courses = await getMyCourses(token)
    const updated = courses.find(c => c.id === current.id)
    if (updated) { setCurrent(updated); onRefresh(updated) }
  }

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionTitle.trim()) return
    setAddingSec(true)
    try {
      await addSection(token, current.id, sectionTitle.trim(), current.sections.length)
      setSectionTitle('')
      await refresh()
    } finally { setAddingSec(false) }
  }

  const handleTogglePublish = async () => {
    setPublishErr('')
    setPublishing(true)
    try {
      const updated = await togglePublish(token, current.id)
      setCurrent(updated); onRefresh(updated)
    } catch (e: any) {
      setPublishErr(e.message || 'Could not toggle publish')
    } finally { setPublishing(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteCourse(token, current.id)
      onBack()
    } finally {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const canPublish = user?.is_verified !== false || current.is_published

  const typeIcons: Record<string, React.ReactNode> = {
    pdf: <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    video: <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>,
    audio: <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>,
    exercise: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>,
  }

  return (
    <div className="max-w-[800px] animate-fadeIn">
      {/* Back + Header */}
      <button onClick={onBack}
        className="group flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 bg-transparent border-none cursor-pointer p-0 transition-all duration-200">
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to courses
      </button>

      {/* Course Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">{current.title}</h2>
            {current.description && (
              <p className="text-sm text-slate-500 leading-relaxed max-w-lg">{current.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                {current.sections.length} section{current.sections.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {current.enrolled_count} student{current.enrolled_count !== 1 ? 's' : ''} enrolled
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 transition-all duration-200"
              title="Delete this course"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete
            </button>
            <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-200 ${
              current.is_published
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${current.is_published ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {current.is_published ? 'Published' : 'Draft'}
            </span>
            {publishErr && (
              <p className="text-xs text-red-500 max-w-[200px] text-right leading-tight">{publishErr}</p>
            )}
            <button
              onClick={handleTogglePublish}
              disabled={publishing || !canPublish}
              title={!canPublish ? 'Verify your account to publish courses' : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border-none cursor-pointer transition-all duration-200 ${
                current.is_published
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : canPublish
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:-translate-y-0.5'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              } disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
            >
              {publishing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : current.is_published ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {current.is_published ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* Sections Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Course sections</h3>
        <span className="text-xs text-slate-400">{current.sections.length} section{current.sections.length !== 1 ? 's' : ''}</span>
      </div>

      {current.sections.length === 0 ? (
        <div className="text-center py-12 mb-6 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 mx-auto mb-4 bg-slate-100 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-900 mb-1">No sections yet</p>
          <p className="text-xs text-slate-500">Add your first section below to start building your course</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6 stagger-children">
          {current.sections.map((section, idx) => (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-slate-900">{section.title}</span>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                    {section.materials.length} item{section.materials.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={() => setUploadingFor(uploadingFor === section.id ? null : section.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    uploadingFor === section.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-[#FF5533]/10 text-[#FF5533] hover:bg-[#FF5533]/20'
                  }`}
                >
                  {uploadingFor === section.id ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Close
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add file
                    </>
                  )}
                </button>
              </div>

              {section.materials.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {section.materials.map(m => (
                    <div key={m.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors duration-200">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        {typeIcons[m.type] ?? <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{m.title}</div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider">{m.type}</div>
                      </div>
                      <a
                        href={`http://localhost:8000/uploads/${m.file_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors duration-200"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        View
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {uploadingFor === section.id && (
                <div className="px-5 pb-5">
                  <UploadMaterialForm
                    token={token}
                    courseId={current.id}
                    section={section}
                    onDone={async () => { setUploadingFor(null); await refresh() }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add section form */}
      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-6 hover:border-slate-300 transition-colors duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Add new section</p>
            <p className="text-xs text-slate-500">Organize your course content into sections</p>
          </div>
        </div>
        <form onSubmit={handleAddSection} className="flex gap-3">
          <input
            className="flex-1 h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
            placeholder="Section title (e.g. Introduction, Module 1)"
            value={sectionTitle}
            onChange={e => setSectionTitle(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!sectionTitle.trim() || addingSec}
            className="flex items-center gap-2 px-5 h-11 bg-slate-900 text-white text-sm font-semibold rounded-xl border-none cursor-pointer hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-slate-900/20 shrink-0"
          >
            {addingSec ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            Add section
          </button>
        </form>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Delete course?</h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              <span className="font-semibold text-slate-700">"{current.title}"</span> and all its sections, materials, and enrollments will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : null}
                {deleting ? 'Deleting…' : 'Delete course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── New Course Modal ── */
function NewCourseModal({ token, onClose, onCreate }: {
  token: string; onClose: () => void; onCreate: (c: CourseOut) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isFree, setIsFree] = useState(true)
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<CategoryOut[]>([])
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    listCategories().then(setCategories).catch(() => {})
    requestAnimationFrame(() => {
      if (overlayRef.current) overlayRef.current.style.opacity = '1'
      if (contentRef.current) {
        contentRef.current.style.opacity = '1'
        contentRef.current.style.transform = 'scale(1) translateY(0)'
      }
    })
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    if (overlayRef.current) overlayRef.current.style.opacity = '0'
    if (contentRef.current) {
      contentRef.current.style.opacity = '0'
      contentRef.current.style.transform = 'scale(0.96) translateY(8px)'
    }
    setTimeout(onClose, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())
      fd.append('is_free', String(isFree))
      if (categoryId) fd.append('category_id', categoryId)
      if (thumbnail) fd.append('thumbnail', thumbnail)
      const course = await createCourse(token, fd)
      onCreate(course)
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && handleClose()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: 0,
        transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        ref={contentRef}
        className="relative w-full max-w-[480px] bg-white rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          opacity: 0,
          transform: 'scale(0.96) translateY(8px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">Create new course</h3>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {err && (
            <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {err}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Title <span className="text-red-500">*</span></label>
              <input
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
                placeholder="e.g. Introduction to Machine Learning"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What will students learn in this course?"
                rows={3}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 resize-none outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Category <span className="text-red-500">*</span></label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200 appearance-none cursor-pointer"
              >
                <option value="">Select a category...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Thumbnail (optional)</label>
              <FilePicker accept=".jpg,.jpeg,.png,.webp" file={thumbnail} onChange={setThumbnail} />
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none py-1">
              <div
                onClick={() => setIsFree(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isFree ? 'bg-slate-900' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isFree ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-sm font-medium text-slate-700">Free course</span>
            </label>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 h-11 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !categoryId || saving}
                className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all duration-200"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </span>
                ) : 'Create course'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ── Browse Courses Section (professor view) ── */
function BrowseCoursesSection({ token, currentUserId }: { token: string; currentUserId: string }) {
  const navigate = useNavigate()
  const [courses, setCourses] = useState<CourseOut[]>([])
  const [categories, setCategories] = useState<CategoryOut[]>([])
  const [activeCat, setActiveCat] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [search, setSearch] = useState('')
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set())
  const [enrollingId, setEnrollingId] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
    getEnrolledCourses(token).then(list => setEnrolledIds(new Set(list.map(c => c.id)))).catch(() => {})
  }, [token])

  useEffect(() => {
    setLoading(true)
    listPublishedCourses(activeCat || undefined).then(setCourses).finally(() => setLoading(false))
  }, [activeCat])

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId); setErr('')
    try {
      await enrollInCourse(token, courseId)
      setEnrolledIds(prev => new Set(prev).add(courseId))
    } catch (e: any) {
      setErr(e.message || 'Could not enroll')
    } finally {
      setEnrollingId(null)
    }
  }

  const filtered = courses.filter(c =>
    !search.trim() ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.professor_name.toLowerCase().includes(search.toLowerCase())
  )

  const typeIcon: Record<string, string> = { pdf: '📄', video: '🎬', audio: '🎵', exercise: '✏️' }

  if (selected) {
    return (
      <div className="max-w-[800px] animate-fadeIn">
        <button onClick={() => setSelected(null)}
          className="group flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-6 bg-transparent border-none cursor-pointer p-0 transition-all duration-200">
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to courses
        </button>
        
        {/* Course Header */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 mb-6">
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
              {selected.enrolled_count} student{selected.enrolled_count !== 1 ? 's' : ''} enrolled
            </span>
          </div>
          {selected.professor_id !== currentUserId && (
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              {enrolledIds.has(selected.id) ? (
                <button
                  onClick={() => navigate(`/learn/${selected.id}`)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0C0C0F] text-white rounded-xl text-sm font-semibold hover:bg-[#1E1E23] transition-colors duration-200 border-none cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polygon strokeLinecap="round" strokeLinejoin="round" points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start Learning
                </button>
              ) : (
                <button
                  onClick={() => handleEnroll(selected.id)}
                  disabled={enrollingId === selected.id}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white rounded-xl text-sm font-semibold hover:shadow-md border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200">
                  {enrollingId === selected.id ? 'Enrolling...' : 'Enroll in this course'}
                </button>
              )}
              {err && <span className="text-xs text-red-500">{err}</span>}
            </div>
          )}
          {selected.professor_id === currentUserId && (
            <div className="mt-5">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200 text-xs font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
                Your course
              </span>
            </div>
          )}
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
            <p className="text-xs text-slate-500">This course doesn't have any materials</p>
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
                          {m.type === 'pdf' && m.content_text && (
                            <button
                              onClick={() => setExpandedMaterial(expandedMaterial === m.id ? null : m.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors duration-200 border-none cursor-pointer">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                              </svg>
                              {expandedMaterial === m.id ? 'Close' : 'Preview'}
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
      </div>
    )
  }

  return (
    <div className="max-w-[900px] animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Browse Courses</h2>
          <p className="text-sm text-slate-500 mt-1">Explore all published courses on the platform</p>
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 rounded-2xl skeleton" />
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
              onClick={() => setSelected(c)}
              className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] hover:border-slate-300 hover:-translate-y-1 transition-all duration-300">
              {c.thumbnail ? (
                <div className="h-32 overflow-hidden">
                  <img src={`http://localhost:8000/uploads/${c.thumbnail}`} alt={c.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
              ) : (
                <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-[#FF5533] transition-colors duration-200">{c.title}</h3>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${c.is_free ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {c.is_free ? 'Free' : 'Paid'}
                  </span>
                </div>
                {c.category_name && (
                  <span className="inline-block text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full mb-2">{c.category_name}</span>
                )}
                <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                    {c.professor_name.charAt(0).toUpperCase()}
                  </span>
                  {c.professor_name}
                </p>
                {c.description && (
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{c.description}</p>
                )}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3 text-slate-400 min-w-0">
                    <span>{c.sections.length} section{c.sections.length !== 1 ? 's' : ''}</span>
                    <span>·</span>
                    <span>{c.enrolled_count} student{c.enrolled_count !== 1 ? 's' : ''}</span>
                  </div>
                  {c.professor_id === currentUserId ? (
                    <span className="shrink-0 text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-1 rounded-full uppercase tracking-wide">
                      Your course
                    </span>
                  ) : enrolledIds.has(c.id) ? (
                    <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Enrolled
                    </span>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); handleEnroll(c.id) }}
                      disabled={!!enrollingId}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white rounded-lg border-none cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
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

/* ── Courses Section ── */
function CoursesSection({ token }: { token: string }) {
  const [courses, setCourses] = useState<CourseOut[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setCourses(await getMyCourses(token)) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [token])

  if (selected) {
    return (
      <CourseManager
        token={token}
        course={selected}
        onBack={() => { setSelected(null); load() }}
        onRefresh={updated => {
          setCourses(prev => prev.map(c => c.id === updated.id ? updated : c))
          setSelected(updated)
        }}
      />
    )
  }

  return (
    <div className="max-w-[900px] animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Courses</h2>
          <p className="text-sm text-slate-500 mt-1">Create and manage your courses</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 transition-all duration-200">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Course
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl skeleton" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">No courses yet</p>
          <p className="text-sm text-slate-500 mb-4">Create your first course to get started</p>
          <button 
            onClick={() => setShowNew(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors duration-200"
          >
            Create course
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {courses.map((c, i) => (
            <div
              key={c.id}
              onClick={() => setSelected(c)}
              className={`group flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-all duration-200 ${i !== courses.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              {/* Course icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate group-hover:text-[#FF5533] transition-colors duration-200">{c.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {c.sections.length} section{c.sections.length !== 1 ? 's' : ''} · {c.enrolled_count} student{c.enrolled_count !== 1 ? 's' : ''}
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${c.is_free ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                  {c.is_free ? 'Free' : 'Paid'}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.is_published ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${c.is_published ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {c.is_published ? 'Published' : 'Draft'}
                </span>
                <svg className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewCourseModal
          token={token}
          onClose={() => setShowNew(false)}
          onCreate={course => { setCourses(prev => [course, ...prev]); setShowNew(false); setSelected(course) }}
        />
      )}
    </div>
  )
}

/* ── Incoming Chat Requests Section ── */
function IncomingChatRequestsSection({ token, currentUserId }: { token: string; currentUserId: string }) {
  const [requests, setRequests] = useState<ChatRequestOut[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefuse, setAutoRefuseState] = useState(false)
  const [autoRefuseLoading, setAutoRefuseLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [openRequest, setOpenRequest] = useState<ChatRequestOut | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      getIncomingChatRequests(token),
      getAutoRefuse(token),
    ])
      .then(([reqs, ar]) => { setRequests(reqs); setAutoRefuseState(ar.auto_refuse) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token])

  const handleAutoRefuseToggle = async () => {
    setAutoRefuseLoading(true)
    try {
      const { auto_refuse } = await setAutoRefuse(token, !autoRefuse)
      setAutoRefuseState(auto_refuse)
    } finally { setAutoRefuseLoading(false) }
  }

  const handleReview = async (requestId: string, action: 'accept' | 'refuse') => {
    setReviewingId(requestId)
    try {
      const updated = await reviewChatRequest(token, requestId, action)
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
    } finally { setReviewingId(null) }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const reviewed = requests.filter(r => r.status !== 'pending')

  const statusStyle: Record<string, string> = {
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    refused: 'bg-red-50 text-red-600 border-red-200',
    closed: 'bg-slate-50 text-slate-500 border-slate-200',
  }

  if (openRequest) {
    return (
      <ChatRoom
        token={token}
        requestId={openRequest.id}
        currentUserId={currentUserId}
        otherName={openRequest.student_full_name}
        initialClosed={openRequest.status === 'closed'}
        isProfessor={true}
        onRoomClosed={() => {
          setRequests(prev => prev.map(r => r.id === openRequest.id ? { ...r, status: 'closed' } : r))
          setOpenRequest(prev => prev ? { ...prev, status: 'closed' } : null)
        }}
        onBack={() => { setOpenRequest(null); load() }}
      />
    )
  }

  return (
    <div className="max-w-[800px] animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Chat Requests</h2>
          <p className="text-sm text-slate-500 mt-1">
            {pending.length} pending · {reviewed.length} reviewed
          </p>
        </div>

        {/* Auto-refuse toggle */}
        <div className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl border-2 transition-all duration-200 ${autoRefuse ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <div>
            <p className={`text-sm font-semibold ${autoRefuse ? 'text-red-700' : 'text-slate-700'}`}>
              Auto-refuse requests
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {autoRefuse ? 'New requests are automatically refused' : 'You review each request manually'}
            </p>
          </div>
          <button
            onClick={handleAutoRefuseToggle}
            disabled={autoRefuseLoading}
            className={`relative w-12 h-6 rounded-full border-none cursor-pointer transition-colors duration-300 disabled:opacity-60 shrink-0 ${autoRefuse ? 'bg-red-500' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${autoRefuse ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">No chat requests</p>
          <p className="text-sm text-slate-500">Student requests will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending requests */}
          {pending.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
                Pending — {pending.length}
              </h3>
              <div className="space-y-3 stagger-children">
                {pending.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-amber-200 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {r.student_full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{r.student_full_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReview(r.id, 'refuse')}
                          disabled={reviewingId === r.id}
                          className="px-4 py-2 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          Refuse
                        </button>
                        <button
                          onClick={() => handleReview(r.id, 'accept')}
                          disabled={reviewingId === r.id}
                          className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                          {reviewingId === r.id ? 'Saving...' : 'Accept'}
                        </button>
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
            </div>
          )}

          {/* Reviewed requests */}
          {reviewed.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1 mt-6">
                Reviewed — {reviewed.length}
              </h3>
              <div className="space-y-3">
                {reviewed.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] opacity-80">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-bold shrink-0">
                          {r.student_full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{r.student_full_name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${statusStyle[r.status] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${r.status === 'accepted' ? 'bg-emerald-500' : r.status === 'closed' ? 'bg-slate-400' : 'bg-red-400'}`} />
                          {r.status === 'accepted' ? 'Active' : r.status === 'closed' ? 'Closed' : 'Refused'}
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
                      <p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 italic">
                        "{r.message}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── My Students Section ── */
function MyStudentsSection({ token }: { token: string }) {
  const [data, setData] = useState<CourseStudentsOut[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    getMyStudents(token).then(setData).finally(() => setLoading(false))
  }, [token])

  const totalStudents = data.reduce((sum, c) => sum + c.students.length, 0)
  const activeCourse = selectedCourse ? data.find(c => c.course_id === selectedCourse) : null
  const displayStudents = activeCourse ? activeCourse.students : data.flatMap(c => c.students.map(s => ({ ...s, _courseTitle: c.course_title })))
  const filtered = displayStudents.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    completed: 'bg-blue-50 text-blue-600 border-blue-200',
    blocked: 'bg-red-50 text-red-600 border-red-200',
  }

  return (
    <div className="max-w-[960px] animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Students</h2>
          <p className="text-sm text-slate-500 mt-1">
            {totalStudents} student{totalStudents !== 1 ? 's' : ''} enrolled across {data.length} course{data.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Course filter pills */}
      {!loading && data.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-5">
          <button
            onClick={() => setSelectedCourse(null)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
              !selectedCourse
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            All courses ({totalStudents})
          </button>
          {data.map(c => (
            <button
              key={c.course_id}
              onClick={() => setSelectedCourse(c.course_id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border-2 transition-all duration-200 ${
                selectedCourse === c.course_id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {c.course_title} ({c.students.length})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {!loading && totalStudents > 0 && (
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students by name or email..."
            className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl skeleton" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">No students yet</p>
          <p className="text-sm text-slate-500">Students will appear here once they enroll in your courses</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <p className="text-base font-semibold text-slate-900 mb-1">No students found</p>
          <p className="text-sm text-slate-500">Try adjusting your search or filter</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_140px_100px] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Student</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedCourse ? 'Email' : 'Course'}
            </span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Enrolled</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
          </div>
          {/* Rows */}
          {filtered.map((s, i) => (
            <div
              key={`${s.id}-${('_courseTitle' in s ? (s as any)._courseTitle : '')}-${i}`}
              className={`grid grid-cols-[1fr_1fr_140px_100px] gap-4 items-center px-5 py-3.5 hover:bg-slate-50/50 transition-colors duration-200 ${
                i !== filtered.length - 1 ? 'border-b border-slate-50' : ''
              }`}
            >
              {/* Student name + email */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                  {s.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{s.full_name}</div>
                  {selectedCourse && <div className="text-xs text-slate-400 truncate">{s.email}</div>}
                </div>
              </div>
              {/* Course name or email */}
              <div className="text-sm text-slate-600 truncate">
                {selectedCourse ? s.email : ('_courseTitle' in s ? (s as any)._courseTitle : '')}
              </div>
              {/* Enrolled date */}
              <div className="text-xs text-slate-500">
                {new Date(s.enrolled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              {/* Status */}
              <span className={`inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border w-fit ${statusColor[s.status] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  s.status === 'active' ? 'bg-emerald-500' : s.status === 'completed' ? 'bg-blue-500' : s.status === 'blocked' ? 'bg-red-500' : 'bg-slate-400'
                }`} />
                {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── My Learning Section (professor's own enrolled courses) ── */
function MyLearningSection({ token }: { token: string }) {
  const navigate = useNavigate()
  const [enrolled, setEnrolled] = useState<CourseOut[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState(false)
  const [unenrollErr, setUnenrollErr] = useState('')

  useEffect(() => {
    setLoading(true)
    getEnrolledCourses(token).then(setEnrolled).finally(() => setLoading(false))
  }, [token])

  const handleUnenroll = async (courseId: string) => {
    setUnenrolling(true); setUnenrollErr('')
    try {
      await unenrollFromCourse(token, courseId)
      setEnrolled(prev => prev.filter(c => c.id !== courseId))
      setConfirmUnenroll(null)
    } catch (e: any) {
      setUnenrollErr(e.message || 'Could not remove course')
    } finally {
      setUnenrolling(false)
    }
  }

  return (
    <div className="max-w-[800px] animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Learning</h2>
        <p className="text-sm text-slate-500 mt-1">Courses you're enrolled in as a learner</p>
      </div>

      {unenrollErr && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm text-red-600 bg-red-50 border border-red-200">{unenrollErr}</div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}
        </div>
      ) : enrolled.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 mb-1">Not enrolled in any course yet</p>
          <p className="text-sm text-slate-500">Browse the catalog and enroll to keep learning alongside teaching</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {enrolled.map(c => (
            <div key={c.id}
              onClick={() => navigate(`/learn/${c.id}`)}
              className="group bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {c.thumbnail ? (
                    <img src={`http://localhost:8000/uploads/${c.thumbnail}`} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate group-hover:text-[#FF5533] transition-colors duration-200">{c.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">by {c.professor_name}</p>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <div className="text-xs text-slate-400">{c.sections.length} section{c.sections.length !== 1 ? 's' : ''}</div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
                      title="Unenroll from this course"
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

/* ── Main Dashboard ── */
export default function ProfessorDashboard() {
  const { user, token } = useAuth()
  const [nav, setNav] = useState('home')
  const firstName = user?.full_name?.split(' ')[0] || ''

  if (nav === 'courses') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <BrowseCoursesSection token={token!} currentUserId={user!.id} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav === 'my-learning') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <MyLearningSection token={token!} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav === 'my-courses') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <CoursesSection token={token!} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav === 'students') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <MyStudentsSection token={token!} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav === 'chat') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
        <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
          <IncomingChatRequestsSection token={token!} currentUserId={user!.id} />
        </div>
      </DashboardLayout>
    )
  }

  if (nav !== 'home') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-[1.1rem] font-bold text-[#0C0C0F]">{NAV.find(n => n.id === nav)?.label}</h2>
            <p className="text-[0.82rem] text-[#94A3B8] mt-1">Coming soon</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Professor">
      <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">

        {/* Hero */}
        <div className="mb-10 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0B0F1F] text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] border border-white/10">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#FF5533]/20 blur-3xl rounded-full" />
          <div className="absolute -left-14 bottom-0 w-64 h-64 bg-[#22D3EE]/10 blur-3xl rounded-full" />
          <div className="relative p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-[0.7rem] font-bold tracking-[0.16em] uppercase text-white/70 mb-1">Professor workspace</p>
                <h1 className="text-[1.9rem] font-black tracking-[-0.03em] leading-tight">Welcome back, {firstName || 'professor'}</h1>
                <p className="text-white/70 text-[0.95rem] max-w-xl mt-2">
                  Launch polished courses, track engagement, and keep students focused in a calmer dashboard.
                </p>
                {/* Affiliation badge */}
                {user?.university_name ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-[0.72rem] font-semibold">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      {user.university_name}
                    </span>
                    {user.region_name && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/60 text-[0.72rem] font-semibold">
                        {user.region_name}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[0.72rem] font-semibold">
                      Independent professor
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setNav('my-courses')}
                  className="h-11 px-5 rounded-xl bg-white text-[#0C0C0F] font-semibold text-[0.9rem] border-none cursor-pointer shadow-md hover:-translate-y-0.5 transition-all"
                >
                  + New course
                </button>
                <button
                  onClick={() => setNav('courses')}
                  className="h-11 px-5 rounded-xl border border-white/40 text-white/90 font-semibold text-[0.9rem] bg-white/10 backdrop-blur cursor-pointer hover:border-white/70 transition-all"
                >
                  Browse catalog
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Active students', value: '1.2k' },
                { label: 'Live courses', value: '12' },
                { label: 'Avg rating', value: '4.8' },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 backdrop-blur px-4 py-3 shadow-inner flex items-center justify-between">
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

        {/* Verification banner — only for unverified professors */}
        {user?.is_verified === false && <VerificationBanner token={token!} />}

        {/* University affiliation */}
        <div className="mb-8">
          <UniversityCard token={token!} />
        </div>

        {/* Activity */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-[0_16px_44px_rgba(12,12,15,0.06)]">
          <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-1 px-5 pt-5">Recent activity</h2>
          <div className="flex flex-col">
            {ACTIVITY.map((a, i) => (
              <div key={i}
                className={`flex items-start gap-3 px-5 py-4 ${i !== ACTIVITY.length - 1 ? 'border-t border-[#F1F3F5]' : 'border-t border-[#F1F3F5]'}`}>
                <div className="w-9 h-9 rounded-full bg-[#F1F3F5] text-[#94A3B8] flex items-center justify-center text-[0.72rem] font-bold uppercase shrink-0">
                  {a.student.split(' ').map(w => w[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.85rem] text-[#0C0C0F] m-0 leading-relaxed">
                    <span className="font-semibold">{a.student}</span>{' '}{a.action}{' '}
                    <span className="font-semibold">{a.course}</span>
                  </p>
                </div>
                <span className="text-[0.72rem] text-[#94A3B8] shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

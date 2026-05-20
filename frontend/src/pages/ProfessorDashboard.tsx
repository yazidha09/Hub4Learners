import { useState, useEffect, useRef, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import RichTextEditor from '../components/RichTextEditor'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGamification } from '../context/GamificationContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'
import {
  getMyCourses, getCourseDetail, createCourse, addSection, addSubsection, togglePublish, listPublishedCourses,
  getMyStudents, getEnrolledCourses, enrollInCourse, unenrollFromCourse, deleteCourse, deleteSection,
  addLessonBlock, deleteLessonBlock, updateLessonBlock, getLearnerAnalytics,
  uploadPdfForGeneration, pollGenerationJob, importGeneratedCourse, regenerateSubsection,
  type CourseOut, type SubsectionOut, type LessonBlockOut, type CourseStudentsOut, type GenerationJob,
  type LearnerAnalyticsOut, type LearnerActivityPoint, type LearnerSummary,
} from '../api/course'
import { listCategories, type CategoryOut } from '../api/category'
import { createCheckoutSession } from '../api/payment'
import { getIncomingChatRequests, reviewChatRequest, getAutoRefuse, setAutoRefuse, type ChatRequestOut } from '../api/chat'
import ChatRoom from '../components/ChatRoom'
import FriendsMessenger from '../components/FriendsMessenger'
import FindFriends from '../components/FindFriends'
import {
  listUniversities, submitJoinRequest, listJoinRequests, cancelJoinRequest,
  type UniversityOut, type JoinRequestOut,
} from '../api/org'
import { getMyAnnouncements, type AnnouncementOut } from '../api/admin'
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
const MessagesIcon = () => (
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
  { id: 'my-courses', label: 'My Courses', icon: <FolderIcon /> },
  { id: 'my-learning', label: 'My Learning', icon: <GraduationCapIcon /> },
  { id: 'gamification', label: 'Hero Stats', icon: <TrophyIcon /> },
  { id: 'students', label: 'Students', icon: <UsersIcon /> },
  { id: 'chat', label: 'Chat Requests', icon: <ChatIcon /> },
  { id: 'messages', label: 'Messages', icon: <MessagesIcon /> },
  { id: 'find-friends', label: 'Find Friends', icon: <AddFriendIcon /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendIcon /> },
]
const ANNOUNCEMENTS_NAV_ITEM: NavItem = { id: 'announcements', label: 'Announcements', icon: <MegaphoneIcon /> }

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

/* ── Lesson block editor ── */
function LessonEditor({ token, courseId, subsection, onRefresh }: {
  token: string; courseId: string; subsection: SubsectionOut; onRefresh: () => void
}) {
  const [blocks, setBlocks] = useState<LessonBlockOut[]>(
    [...(subsection.blocks || [])].sort((a, b) => a.order_index - b.order_index)
  )
  const [addingType, setAddingType] = useState<'text' | 'image' | 'video' | null>(null)
  const [textContent, setTextContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const addTextBlock = async () => {
    if (!textContent.trim()) return
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('block_type', 'text')
      fd.append('content', textContent.trim())
      fd.append('order_index', String(blocks.length))
      const block = await addLessonBlock(token, courseId, subsection.id, fd)
      setBlocks(prev => [...prev, block])
      setTextContent(''); setAddingType(null)
      onRefresh()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const addMediaBlock = async () => {
    if (!mediaFile || !addingType || addingType === 'text') return
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('block_type', addingType)
      fd.append('file', mediaFile)
      if (caption.trim()) fd.append('caption', caption.trim())
      fd.append('order_index', String(blocks.length))
      const block = await addLessonBlock(token, courseId, subsection.id, fd)
      setBlocks(prev => [...prev, block])
      setMediaFile(null); setCaption(''); setAddingType(null)
      onRefresh()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const removeBlock = async (blockId: string) => {
    setDeletingId(blockId)
    try {
      await deleteLessonBlock(token, blockId)
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      onRefresh()
    } catch (e: any) { setErr(e.message) }
    finally { setDeletingId(null) }
  }

  const cancelAdd = () => {
    setAddingType(null); setTextContent(''); setMediaFile(null); setCaption('')
  }

  const startEditBlock = (block: LessonBlockOut) => {
    setEditingBlockId(block.id)
    setEditingContent(block.content ?? '')
    setAddingType(null)
  }

  const cancelEditBlock = () => {
    setEditingBlockId(null); setEditingContent('')
  }

  const saveBlockEdit = async () => {
    if (!editingBlockId) return
    setEditSaving(true); setErr('')
    try {
      const updated = await updateLessonBlock(token, editingBlockId, editingContent)
      setBlocks(prev => prev.map(b => b.id === editingBlockId ? updated : b))
      setEditingBlockId(null); setEditingContent('')
      onRefresh()
    } catch (e: any) { setErr(e.message) }
    finally { setEditSaving(false) }
  }

  return (
    <div className="border-t border-slate-100 bg-[#FAFAFA] px-5 py-5 flex flex-col gap-4">
      {err && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {err}
        </div>
      )}

      {/* Existing blocks */}
      {blocks.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          No content yet — add a text, image, or video block below.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {blocks.map(block => {
            const isEditing = editingBlockId === block.id
            return (
              <div key={block.id} className={`bg-white border rounded-xl overflow-hidden transition-colors duration-150 ${isEditing ? 'border-blue-300' : 'border-slate-200 hover:border-slate-300'}`}>
                {/* Header row */}
                <div className="group flex items-start gap-3 p-3.5">
                  {/* Block type icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${
                    block.block_type === 'text' ? 'bg-blue-50 text-blue-600' :
                    block.block_type === 'image' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-purple-50 text-purple-600'
                  }`}>
                    {block.block_type === 'text' ? 'Aa' :
                     block.block_type === 'image' ? (
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     ) : (
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                     )}
                  </div>

                  {/* Content preview */}
                  <div className="flex-1 min-w-0">
                    {block.block_type === 'text' ? (
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-2" dangerouslySetInnerHTML={{ __html: block.content ?? '' }} />
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {block.file_url?.split('/').pop() ?? 'file'}
                        </p>
                        {block.caption && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{block.caption}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Edit (text blocks only) */}
                  {block.block_type === 'text' && (
                    <button
                      onClick={() => isEditing ? cancelEditBlock() : startEditBlock(block)}
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        isEditing
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'opacity-0 group-hover:opacity-100 bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {isEditing ? 'Cancel' : 'Edit'}
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => removeBlock(block.id)}
                    disabled={deletingId === block.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0"
                  >
                    {deletingId === block.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Inline editor for text blocks */}
                {isEditing && (
                  <div className="border-t border-slate-100">
                    <RichTextEditor
                      value={editingContent}
                      onChange={setEditingContent}
                    />
                    <div className="flex gap-2 justify-end px-4 py-3 border-t border-slate-100 bg-[#F8F9FA]">
                      <button onClick={cancelEditBlock} className="px-4 py-2 text-sm font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                      <button
                        onClick={saveBlockEdit}
                        disabled={editSaving}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {editSaving && <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                        {editSaving ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Inline add forms */}
      {addingType === 'text' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col gap-0">
          <div className="px-4 pt-3 pb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lesson content</label>
          </div>
          <RichTextEditor
            value={textContent}
            onChange={setTextContent}
            placeholder="Write your lesson content here — use the toolbar to add headings, bold, colors…"
          />
          <div className="flex gap-2 justify-end px-4 py-3 border-t border-slate-100 bg-[#F8F9FA]">
            <button onClick={cancelAdd} className="px-4 py-2 text-sm font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={addTextBlock}
              disabled={!textContent || textContent === '<p></p>' || saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
              {saving ? 'Adding…' : 'Add Text Block'}
            </button>
          </div>
        </div>
      )}

      {(addingType === 'image' || addingType === 'video') && (
        <div className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${addingType === 'image' ? 'border-emerald-200' : 'border-purple-200'}`}>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {addingType === 'image' ? 'Image file' : 'Video file'}
          </label>
          <FilePicker
            accept={addingType === 'image' ? '.jpg,.jpeg,.png,.gif,.webp' : '.mp4,.webm,.mov'}
            file={mediaFile}
            onChange={setMediaFile}
            placeholder={addingType === 'image' ? 'Click to select image (JPG, PNG, GIF, WEBP)' : 'Click to select video (MP4, WEBM, MOV)'}
          />
          <input
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 transition-colors"
            placeholder="Caption (optional)"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <button onClick={cancelAdd} className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">Cancel</button>
            <button
              onClick={addMediaBlock}
              disabled={!mediaFile || saving}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                addingType === 'image' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {saving ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
              {saving ? 'Uploading…' : `Add ${addingType === 'image' ? 'Image' : 'Video'}`}
            </button>
          </div>
        </div>
      )}

      {/* Add content buttons */}
      {!addingType && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Add:</span>
          <button
            onClick={() => setAddingType('text')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7"/></svg>
            Text
          </button>
          <button
            onClick={() => setAddingType('image')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Image
          </button>
          <button
            onClick={() => setAddingType('video')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Video
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Course Manager ── */
function CourseManager({ token, course, onBack, onRefresh }: {
  token: string; course: CourseOut; onBack: () => void; onRefresh: (updated: CourseOut) => void
}) {
  const { user } = useAuth()
  const { refresh: refreshGamification } = useGamification()
  const [sectionTitle, setSectionTitle] = useState('')
  const [addingSec, setAddingSec] = useState(false)
  const [editingFor, setEditingFor] = useState<string | null>(null)
  const [subsectionTitles, setSubsectionTitles] = useState<Record<string, string>>({})
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishErr, setPublishErr] = useState('')
  const [current, setCurrent] = useState(course)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const [sectionErr, setSectionErr] = useState('')
  const [subsectionErrs, setSubsectionErrs] = useState<Record<string, string>>({})
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null)
  const [confirmDeleteSectionId, setConfirmDeleteSectionId] = useState<string | null>(null)

  /* ── AI generation modal state ── */
  const [showAI, setShowAI] = useState(false)
  const [aiFile, setAiFile] = useState<File | null>(null)
  const [aiDifficulty, setAiDifficulty] = useState('intermediate')
  const [aiPhase, setAiPhase] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle')
  const [aiJob, setAiJob] = useState<GenerationJob | null>(null)
  const [aiError, setAiError] = useState('')
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /* ── AI editor state (after generation) ── */
  const [editedResult, setEditedResult] = useState<GenerationJob['result'] | null>(null)
  const [expandedAiSection, setExpandedAiSection] = useState<number | null>(0)
  const [editingAiSub, setEditingAiSub] = useState<{ si: number; ssi: number } | null>(null)
  const [regenning, setRegenning] = useState<{ si: number; ssi: number } | null>(null)

  const stopPolling = () => {
    if (aiPollRef.current) { clearInterval(aiPollRef.current); aiPollRef.current = null }
  }

  const resetAI = () => {
    stopPolling()
    setAiFile(null); setAiPhase('idle'); setAiJob(null); setAiError('')
    setEditedResult(null); setExpandedAiSection(0); setEditingAiSub(null); setRegenning(null)
  }

  const handleAIUpload = async () => {
    if (!aiFile) return
    setAiPhase('uploading'); setAiError('')
    try {
      const { job_id } = await uploadPdfForGeneration(token, aiFile, aiDifficulty)
      setAiPhase('processing')
      aiPollRef.current = setInterval(async () => {
        try {
          const job = await pollGenerationJob(token, job_id)
          setAiJob(job)
          if (job.status === 'completed') {
            stopPolling()
            setAiPhase('done')
            setEditedResult(job.result ?? null)
            setExpandedAiSection(0)
          }
          if (job.status === 'failed') { stopPolling(); setAiError(job.error ?? 'Generation failed'); setAiPhase('error') }
        } catch { stopPolling(); setAiError('Lost connection to server'); setAiPhase('error') }
      }, 3000)
    } catch (e: any) { setAiError(e.message); setAiPhase('error') }
  }

  const handleAIImport = async () => {
    if (!aiJob?.job_id) return
    setAiPhase('uploading')
    try {
      await importGeneratedCourse(token, aiJob.job_id, current.id, editedResult ?? undefined)
      await refresh()
      setShowAI(false); resetAI()
    } catch (e: any) { setAiError(e.message); setAiPhase('error') }
  }

  const handleAIRegen = async (si: number, ssi: number) => {
    if (!aiJob?.job_id || regenning) return
    setRegenning({ si, ssi })
    try {
      const res = await regenerateSubsection(token, aiJob.job_id, si, ssi)
      setEditedResult(prev => {
        if (!prev) return prev
        const updated = JSON.parse(JSON.stringify(prev))
        updated.sections[si].subsections[ssi].content = res.content
        return updated
      })
    } catch { /* silently ignore — user can try again */ }
    finally { setRegenning(null) }
  }

  const updateAiSectionTitle = (si: number, title: string) => {
    setEditedResult(prev => {
      if (!prev) return prev
      const updated = JSON.parse(JSON.stringify(prev))
      updated.sections[si].title = title
      return updated
    })
  }

  const updateAiSubTitle = (si: number, ssi: number, title: string) => {
    setEditedResult(prev => {
      if (!prev) return prev
      const updated = JSON.parse(JSON.stringify(prev))
      updated.sections[si].subsections[ssi].title = title
      return updated
    })
  }

  const updateAiSubContent = (si: number, ssi: number, html: string) => {
    setEditedResult(prev => {
      if (!prev) return prev
      const updated = JSON.parse(JSON.stringify(prev))
      updated.sections[si].subsections[ssi].content = html
      return updated
    })
  }

  const refresh = async () => {
    const updated = await getCourseDetail(current.id)
    setCurrent(updated); onRefresh(updated)
  }

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sectionTitle.trim()) return
    setAddingSec(true)
    setSectionErr('')
    try {
      await addSection(token, current.id, sectionTitle.trim(), current.sections.length)
      setSectionTitle('')
      await refresh()
    } catch (e: any) {
      setSectionErr(e.message || 'Failed to add section')
    } finally { setAddingSec(false) }
  }

  const handleAddSubsection = async (sectionId: string) => {
    const title = subsectionTitles[sectionId]?.trim()
    if (!title) return
    setAddingSubFor(sectionId)
    setSubsectionErrs(prev => ({ ...prev, [sectionId]: '' }))
    try {
      const section = current.sections.find(s => s.id === sectionId)
      const order = section?.subsections?.length ?? 0
      await addSubsection(token, current.id, sectionId, title, order)
      setSubsectionTitles(prev => ({ ...prev, [sectionId]: '' }))
      await refresh()
    } catch (e: any) {
      setSubsectionErrs(prev => ({ ...prev, [sectionId]: e.message || 'Failed to add subsection' }))
    } finally { setAddingSubFor(null) }
  }

  const handleDeleteSection = async (sectionId: string) => {
    setDeletingSectionId(sectionId)
    try {
      await deleteSection(token, current.id, sectionId)
      setConfirmDeleteSectionId(null)
      await refresh()
    } catch (e: any) {
      setSectionErr(e.message || 'Failed to delete section')
      setConfirmDeleteSectionId(null)
    } finally { setDeletingSectionId(null) }
  }

  const handleTogglePublish = async () => {
    setPublishErr('')
    setPublishing(true)
    try {
      const updated = await togglePublish(token, current.id)
      setCurrent(updated); onRefresh(updated)
      // Surface XP / achievement / badge toasts for first-time publish.
      void refreshGamification()
    } catch (e: any) {
      setPublishErr(e.message || 'Could not toggle publish')
    } finally { setPublishing(false) }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setDeleteErr('')
    try {
      await deleteCourse(token, current.id)
      onBack()
    } catch (e: any) {
      setDeleteErr(e.message || 'Failed to delete course')
    } finally {
      setDeleting(false)
    }
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
              onClick={() => window.open(`/learn/${current.id}?preview=1`, '_blank')}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-slate-600 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-all duration-200"
              title="Preview as student"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Preview
            </button>
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
              disabled={publishing}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border-none cursor-pointer transition-all duration-200 ${
                current.is_published
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600 hover:-translate-y-0.5'
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
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{current.sections.length} section{current.sections.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => { resetAI(); setShowAI(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 border border-violet-200 transition-all duration-200"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Generate from PDF
          </button>
        </div>
      </div>

      {/* ── AI Generation Modal ── */}
      {showAI && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden transition-all duration-300 ${aiPhase === 'done' ? 'max-w-4xl' : 'max-w-lg'}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Generate from PDF</p>
                  <p className="text-xs text-slate-500">AI builds sections & lessons automatically</p>
                </div>
              </div>
              <button onClick={() => { setShowAI(false); resetAI() }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5">
              {/* IDLE / UPLOADING phase — form */}
              {(aiPhase === 'idle' || aiPhase === 'uploading') && (
                <div className="space-y-4">
                  {/* PDF drop zone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">PDF file</label>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${aiFile ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/50'}`}>
                      <input type="file" accept=".pdf" className="hidden" onChange={e => setAiFile(e.target.files?.[0] ?? null)} />
                      {aiFile ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <svg className="w-7 h-7 text-violet-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                          <p className="text-sm font-semibold text-violet-700">{aiFile.name}</p>
                          <p className="text-xs text-slate-400">{(aiFile.size / 1024 / 1024).toFixed(1)} MB · Click to change</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5">
                          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                          <p className="text-sm font-medium text-slate-600">Click to upload PDF</p>
                          <p className="text-xs text-slate-400">Max 20 MB</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Difficulty level</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
                        <button key={d} type="button" onClick={() => setAiDifficulty(d)}
                          className={`py-2 rounded-xl text-xs font-semibold border transition-all duration-200 capitalize ${aiDifficulty === d ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAIUpload}
                    disabled={!aiFile || aiPhase === 'uploading'}
                    className="w-full py-3 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all duration-200"
                  >
                    {aiPhase === 'uploading' ? 'Uploading…' : 'Start Generation'}
                  </button>
                </div>
              )}

              {/* PROCESSING phase */}
              {aiPhase === 'processing' && (
                <div className="flex flex-col items-center justify-center py-8 gap-5">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-violet-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900 mb-1">AI is building your course…</p>
                    <p className="text-xs text-slate-500 max-w-xs">Extracting content from PDF, generating sections and lesson content. This takes 1–3 minutes.</p>
                  </div>
                  {aiJob && (
                    <div className="w-full bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
                      <p>📄 File: <span className="font-medium text-slate-700">{aiJob.pdf_filename}</span></p>
                      <p>🎯 Difficulty: <span className="font-medium text-slate-700 capitalize">{aiJob.difficulty}</span></p>
                      <p>⏳ Status: <span className="font-medium text-violet-600">Processing…</span></p>
                    </div>
                  )}
                </div>
              )}

              {/* DONE phase — review & edit */}
              {aiPhase === 'done' && editedResult && (
                <div className="space-y-4">
                  {/* Banner */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    <p className="text-xs font-semibold text-emerald-700">Course generated! Review and edit before importing.</p>
                  </div>

                  {/* Editable course title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Course Title</label>
                    <input
                      value={editedResult.title}
                      onChange={e => setEditedResult(prev => prev ? { ...prev, title: e.target.value } : prev)}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-shadow"
                    />
                  </div>

                  {/* Sections accordion */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Sections — {editedResult.sections.length} total
                      </label>
                      <span className="text-xs text-slate-400">Click a section to expand · Edit titles inline · Regen to rewrite</span>
                    </div>
                    <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                      {editedResult.sections.map((section, si) => (
                        <div key={si} className="border border-slate-200 rounded-xl overflow-hidden">
                          {/* Section header */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none"
                            onClick={() => setExpandedAiSection(expandedAiSection === si ? null : si)}
                          >
                            <span className="w-6 h-6 rounded-md bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center shrink-0">{si + 1}</span>
                            <input
                              value={section.title}
                              onClick={e => e.stopPropagation()}
                              onChange={e => updateAiSectionTitle(si, e.target.value)}
                              className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-none focus:outline-none min-w-0"
                            />
                            <span className="text-xs text-slate-400 shrink-0">{section.subsections.length} lessons</span>
                            <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expandedAiSection === si ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </div>

                          {/* Subsections */}
                          {expandedAiSection === si && (
                            <div className="divide-y divide-slate-100 bg-white">
                              {section.subsections.map((sub, ssi) => {
                                const isEditing = editingAiSub?.si === si && editingAiSub?.ssi === ssi
                                const isRegenning = regenning?.si === si && regenning?.ssi === ssi
                                return (
                                  <div key={ssi}>
                                    {/* Subsection row */}
                                    <div className="flex items-center gap-2 px-4 py-2.5">
                                      <span className="text-xs text-violet-500 font-mono font-semibold shrink-0 w-8">{si + 1}.{ssi + 1}</span>
                                      <input
                                        value={sub.title}
                                        onChange={e => updateAiSubTitle(si, ssi, e.target.value)}
                                        className="flex-1 text-sm text-slate-700 bg-transparent border-none focus:outline-none min-w-0"
                                      />
                                      {/* Edit toggle */}
                                      <button
                                        type="button"
                                        onClick={() => setEditingAiSub(isEditing ? null : { si, ssi })}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                                          isEditing ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        {isEditing ? 'Done' : 'Edit'}
                                      </button>
                                      {/* Regenerate button */}
                                      <button
                                        type="button"
                                        onClick={() => handleAIRegen(si, ssi)}
                                        disabled={!!regenning}
                                        title="AI-regenerate this lesson's content"
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 disabled:opacity-40 transition-colors shrink-0"
                                      >
                                        {isRegenning ? (
                                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                        ) : (
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                        )}
                                        Regen
                                      </button>
                                    </div>

                                    {/* Content editor (only when editing this subsection) */}
                                    {isEditing && (
                                      <div className="px-4 pb-4 pt-1">
                                        <RichTextEditor
                                          value={sub.content}
                                          onChange={html => updateAiSubContent(si, ssi, html)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => { setShowAI(false); resetAI() }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleAIImport}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                      Import into Course
                    </button>
                  </div>
                </div>
              )}

              {/* ERROR phase */}
              {aiPhase === 'error' && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900 mb-1">Generation failed</p>
                    <p className="text-xs text-red-500 max-w-xs">{aiError}</p>
                  </div>
                  <button onClick={resetAI} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-700 transition-colors">
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              {/* Section header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                <span className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-slate-900 flex-1">{section.title}</span>
                <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
                  {section.subsections?.length ?? 0} subsection{(section.subsections?.length ?? 0) !== 1 ? 's' : ''}
                </span>
                {confirmDeleteSectionId === section.id ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-500 mr-1">Delete?</span>
                    <button
                      onClick={() => handleDeleteSection(section.id)}
                      disabled={deletingSectionId === section.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors border-none cursor-pointer"
                    >
                      {deletingSectionId === section.id ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      ) : null}
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteSectionId(null)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteSectionId(section.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all shrink-0 cursor-pointer"
                    title="Delete section"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Subsection rows */}
              {(section.subsections || []).length > 0 && (
                <div className="divide-y divide-slate-100">
                  {(section.subsections || []).map((sub, subIdx) => (
                    <div key={sub.id}>
                      <div className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-slate-400 shrink-0 w-8">
                            {idx + 1}.{subIdx + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate">{sub.title}</span>
                          <span className="text-xs text-slate-400 shrink-0">
                            {sub.blocks.length} block{sub.blocks.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <button
                          onClick={() => setEditingFor(editingFor === sub.id ? null : sub.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 shrink-0 ml-3 ${
                            editingFor === sub.id
                              ? 'bg-slate-900 text-white'
                              : 'bg-[#FF5533]/10 text-[#FF5533] hover:bg-[#FF5533]/20'
                          }`}
                        >
                          {editingFor === sub.id ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Close
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                              </svg>
                              Edit lesson
                            </>
                          )}
                        </button>
                      </div>

                      {/* Inline lesson editor for this subsection */}
                      {editingFor === sub.id && (
                        <LessonEditor
                          token={token}
                          courseId={current.id}
                          subsection={sub}
                          onRefresh={async () => { await refresh() }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add subsection row */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                {subsectionErrs[section.id] && (
                  <p className="mb-2 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">{subsectionErrs[section.id]}</p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
                    placeholder={`Add subsection to "${section.title}"…`}
                    value={subsectionTitles[section.id] ?? ''}
                    onChange={e => {
                      setSubsectionTitles(prev => ({ ...prev, [section.id]: e.target.value }))
                      if (subsectionErrs[section.id]) setSubsectionErrs(prev => ({ ...prev, [section.id]: '' }))
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubsection(section.id) } }}
                  />
                  <button
                    onClick={() => handleAddSubsection(section.id)}
                    disabled={!subsectionTitles[section.id]?.trim() || addingSubFor === section.id}
                    className="flex items-center gap-1.5 px-3 h-9 bg-slate-900 text-white text-xs font-semibold rounded-lg border-none cursor-pointer hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shrink-0"
                  >
                    {addingSubFor === section.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                    Add subsection
                  </button>
                </div>
              </div>
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
        {sectionErr && (
          <p className="mb-3 text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{sectionErr}</p>
        )}
        <form onSubmit={handleAddSection} className="flex gap-3">
          <input
            className="flex-1 h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
            placeholder="Section title (e.g. Introduction, Module 1)"
            value={sectionTitle}
            onChange={e => { setSectionTitle(e.target.value); if (sectionErr) setSectionErr('') }}
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
            {deleteErr && (
              <p className="text-xs text-red-500 text-center mb-4 bg-red-50 rounded-lg px-3 py-2">{deleteErr}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteErr('') }}
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
  const [price, setPrice] = useState('10')
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
    if (!isFree) {
      const numeric = Number(price)
      if (!Number.isFinite(numeric) || numeric < 10) {
        setErr('Paid courses must cost at least $10.')
        return
      }
    }
    setSaving(true); setErr('')
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      if (description.trim()) fd.append('description', description.trim())
      fd.append('is_free', String(isFree))
      fd.append('price', isFree ? '0' : String(Number(price)))
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

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Pricing</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsFree(true)}
                  className={`h-9 rounded-lg text-xs font-semibold transition-all duration-150 border-none cursor-pointer ${
                    isFree ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => setIsFree(false)}
                  className={`h-9 rounded-lg text-xs font-semibold transition-all duration-150 border-none cursor-pointer ${
                    !isFree ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Paid
                </button>
              </div>

              {!isFree && (
                <div className="mt-3">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-slate-400">$</span>
                    <input
                      type="number"
                      min={10}
                      step={1}
                      value={price}
                      onChange={e => setPrice(e.target.value)}
                      placeholder="10"
                      className="w-full h-11 pl-9 pr-16 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-300 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 tracking-wider">USD</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-500">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    <span>Secured by Stripe · minimum $10</span>
                  </div>
                </div>
              )}
            </div>

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
                disabled={!title.trim() || !categoryId || saving || (!isFree && (Number(price) < 10 || !Number.isFinite(Number(price))))}
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
    const course = courses.find(c => c.id === courseId)
    try {
      if (course && !course.is_free) {
        const session = await createCheckoutSession(token, courseId)
        window.location.href = session.url
        return
      }
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
              {selected.sections_count} section{selected.sections_count !== 1 ? 's' : ''}
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
              ) : selected.is_free ? (
                <button
                  onClick={() => handleEnroll(selected.id)}
                  disabled={enrollingId === selected.id}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white rounded-xl text-sm font-semibold hover:shadow-md border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200">
                  {enrollingId === selected.id ? 'Enrolling...' : 'Enroll for free'}
                </button>
              ) : (
                <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-baseline gap-1 pr-3 border-r border-slate-100">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">${Number(selected.price).toFixed(0)}</span>
                    <span className="text-[10px] font-medium text-slate-400">USD</span>
                  </div>
                  <button
                    onClick={() => handleEnroll(selected.id)}
                    disabled={enrollingId === selected.id}
                    className="inline-flex items-center gap-1.5 px-4 h-9 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                    </svg>
                    {enrollingId === selected.id ? 'Redirecting…' : 'Enroll · Pay securely'}
                  </button>
                </div>
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
              onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
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
                  {c.is_free ? (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wide">Free</span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-bold text-slate-900 tabular-nums">${Number(c.price).toFixed(0)}</span>
                  )}
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
                    <span>{c.sections_count} section{c.sections_count !== 1 ? 's' : ''}</span>
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
                      className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border-none cursor-pointer shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
                        c.is_free
                          ? 'bg-gradient-to-r from-[#FF5533] to-[#e5482b] text-white'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}>
                      {enrollingId === c.id ? '...' : (c.is_free ? 'Enroll' : `Buy · $${Number(c.price).toFixed(0)}`)}
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
    <div className="max-w-[1080px] animate-fadeIn">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-[1.6rem] font-semibold tracking-[-0.02em] text-[#0C0C0F]">My courses</h2>
          <p className="text-[0.86rem] text-[#64748B] mt-1">Create and manage your courses.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 h-10 px-5 bg-[#0C0C0F] text-white text-[0.84rem] font-semibold rounded-lg hover:bg-[#1E1E23] transition-colors border-none cursor-pointer">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New course
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl skeleton" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-[#E5E7EB]">
          <p className="text-[1rem] font-semibold text-[#0C0C0F] mb-1">No courses yet</p>
          <p className="text-[0.86rem] text-[#64748B] mb-6">Create your first course to get started.</p>
          <button
            onClick={() => setShowNew(true)}
            className="h-10 px-5 text-[0.84rem] font-semibold text-white bg-[#0C0C0F] rounded-lg hover:bg-[#1E1E23] transition-colors border-none cursor-pointer"
          >
            Create course
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F1F3F5] overflow-hidden">
          {courses.map(c => (
            <div
              key={c.id}
              onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
              className="group flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-[#0C0C0F] text-white flex items-center justify-center text-[0.88rem] font-semibold shrink-0">
                {c.title.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[0.9rem] font-semibold text-[#0C0C0F] truncate group-hover:text-[#FF5533] transition-colors">{c.title}</div>
                <div className="text-[0.74rem] text-[#94A3B8] mt-0.5">
                  {c.sections_count} section{c.sections_count !== 1 ? 's' : ''} · {c.enrolled_count} student{c.enrolled_count !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {c.is_free ? (
                  <span className="text-[0.66rem] font-semibold px-2 py-0.5 rounded bg-[#F1F3F5] text-[#64748B] uppercase tracking-wider">Free</span>
                ) : (
                  <span className="text-[0.84rem] font-semibold text-[#0C0C0F] tabular-nums">${Number(c.price).toFixed(0)}</span>
                )}
                <span className={`inline-flex items-center gap-1.5 text-[0.74rem] font-semibold ${c.is_published ? 'text-emerald-600' : 'text-[#94A3B8]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.is_published ? 'bg-emerald-500' : 'bg-[#CBD5E1]'}`} />
                  {c.is_published ? 'Published' : 'Draft'}
                </span>
                <svg className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#0C0C0F] transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
  const [err, setErr] = useState('')

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
    setErr('')
    try {
      const { auto_refuse } = await setAutoRefuse(token, !autoRefuse)
      setAutoRefuseState(auto_refuse)
    } catch (e: any) {
      setErr(e.message || 'Failed to update setting')
    } finally { setAutoRefuseLoading(false) }
  }

  const handleReview = async (requestId: string, action: 'accept' | 'refuse') => {
    setReviewingId(requestId)
    setErr('')
    try {
      const updated = await reviewChatRequest(token, requestId, action)
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
    } catch (e: any) {
      setErr(e.message || 'Failed to update request')
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
      {err && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          {err}
        </div>
      )}
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

/* ── Learner Analytics helpers ── */

function LearnerActivityChart({ trend }: { trend: LearnerActivityPoint[] }) {
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
  const fmt = (s: string) => new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[180px] min-w-[480px]">
        <defs>
          <linearGradient id="learner-lessons-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5533" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF5533" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f} y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f} stroke="#F1F3F5" strokeWidth="1" />
        ))}
        <path d={lessonsArea} fill="url(#learner-lessons-area)" />
        <path d={lessonsPath} fill="none" stroke="#FF5533" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={quizPath} fill="none" stroke="#3B82F6" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((t, i) => (i % labelEvery === 0 || i === trend.length - 1) && (
          <text key={t.date} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600">{fmt(t.date)}</text>
        ))}
      </svg>
    </div>
  )
}

const LEARNER_DIFFICULTY_META: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: 'Easy',   color: '#10B981', bg: '#ECFDF5' },
  medium: { label: 'Medium', color: '#F59E0B', bg: '#FFFBEB' },
  hard:   { label: 'Hard',   color: '#EF4444', bg: '#FEF2F2' },
}

const RISK_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  on_track:        { label: 'On track',        color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  needs_attention: { label: 'Needs attention', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  at_risk:         { label: 'At risk',         color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
}

function learnerScoreColor(pct: number): string {
  if (pct >= 80) return '#10B981'
  if (pct >= 60) return '#F59E0B'
  return '#EF4444'
}

function relTimeShort(iso: string): string {
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

/* ── Learner Analytics Section ── */
function LearnersAnalyticsSection({ token }: { token: string }) {
  const [data, setData] = useState<LearnerAnalyticsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<'all' | 'on_track' | 'needs_attention' | 'at_risk'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'progress' | 'score' | 'name'>('recent')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true); setErr('')
    getLearnerAnalytics(token)
      .then(setData)
      .catch(e => setErr(e.message ?? 'Failed to load learner analytics'))
      .finally(() => setLoading(false))
  }, [token])

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (err) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-8 text-center mb-8">
        <p className="text-[0.88rem] text-red-600">{err}</p>
      </div>
    )
  }

  if (!data || data.total_learners === 0) {
    return null  // fall through to MyStudentsSection's empty state
  }

  const filtered = data.learners.filter(l => {
    if (riskFilter !== 'all' && l.risk_level !== riskFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return l.full_name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'progress') return b.avg_progress_pct - a.avg_progress_pct
    if (sortBy === 'score') return b.quiz_avg_pct - a.quiz_avg_pct
    if (sortBy === 'name') return a.full_name.localeCompare(b.full_name)
    // recent: by last_active_at desc, nulls last
    const at = a.last_active_at ? new Date(a.last_active_at).getTime() : 0
    const bt = b.last_active_at ? new Date(b.last_active_at).getTime() : 0
    return bt - at
  })

  return (
    <div className="mb-10">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-[1.5rem] font-black text-[#0C0C0F] tracking-tight leading-tight">Learner insights</h2>
          <p className="text-[0.82rem] text-[#94A3B8] mt-0.5">
            Tracking {data.total_learners} learner{data.total_learners === 1 ? '' : 's'} · {data.active_learners_30d} active in last 30d
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-[0.7rem] font-bold text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-[#FF5533]" /> Lessons</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 border-t-[2px] border-dashed border-[#3B82F6]" /> Quizzes</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Avg progress" value={`${data.avg_progress_pct}%`} hint={`${data.completed_count} done · ${data.in_progress_count} active`} accent="#FF5533" />
        <MiniStat label="Quiz average" value={data.total_quiz_attempts > 0 ? `${data.overall_quiz_avg_pct}%` : '—'} hint={`${data.total_quiz_attempts} attempt${data.total_quiz_attempts === 1 ? '' : 's'}`} accent="#3B82F6" />
        <MiniStat label="Pass rate" value={data.total_quiz_attempts > 0 ? `${data.overall_quiz_pass_rate}%` : '—'} hint={`${data.lessons_completed_30d} lessons in 30d`} accent="#10B981" />
        <MiniStat label="Need follow-up" value={data.at_risk_count + data.needs_attention_count} hint={`${data.at_risk_count} at risk · ${data.needs_attention_count} attention`} accent="#EF4444" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
            <div>
              <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Cohort activity</p>
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
            </div>
          </div>
          <LearnerActivityChart trend={data.activity_trend} />
        </div>

        {/* Difficulty breakdown */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Quiz performance</p>
          {data.total_quiz_attempts > 0 ? (
            <div className="space-y-3">
              {(['easy', 'medium', 'hard'] as const).map(diff => {
                const stat = data.difficulty_breakdown[diff] ?? { attempts: 0, avg_score_pct: 0, pass_rate: 0 }
                const meta = LEARNER_DIFFICULTY_META[diff]
                return (
                  <div key={diff}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.6rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                        <span className="text-[0.7rem] font-semibold text-[#94A3B8]">{stat.attempts} attempt{stat.attempts === 1 ? '' : 's'}</span>
                      </div>
                      <span className="text-[0.78rem] font-black tabular-nums" style={{ color: stat.attempts > 0 ? learnerScoreColor(stat.avg_score_pct) : '#94A3B8' }}>
                        {stat.attempts > 0 ? `${stat.avg_score_pct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[#F1F3F5] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stat.attempts > 0 ? stat.avg_score_pct : 0}%`, background: meta.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-[0.78rem] font-semibold text-[#0C0C0F]">No quizzes yet</p>
              <p className="text-[0.7rem] text-[#94A3B8] mt-0.5">Once learners take quizzes, breakdown appears here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Top performers + needs attention */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.78rem] font-black text-[#0C0C0F]">Top performers</p>
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">By quiz avg</span>
          </div>
          <div className="space-y-2.5">
            {data.top_performers.length === 0 ? (
              <p className="text-[0.78rem] text-[#94A3B8]">No quiz data yet.</p>
            ) : data.top_performers.map((l, i) => (
              <div key={l.student_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-[0.78rem] font-black text-emerald-700">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.82rem] font-bold text-[#0C0C0F] truncate">{l.full_name}</p>
                  <p className="text-[0.66rem] text-[#94A3B8]">{l.quiz_attempts} quiz{l.quiz_attempts === 1 ? '' : 'zes'} · {l.avg_progress_pct}% progress</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[0.95rem] font-black leading-none" style={{ color: learnerScoreColor(l.avg_quiz_pct) }}>{l.avg_quiz_pct}%</p>
                  <p className="text-[0.6rem] font-semibold text-[#94A3B8] uppercase tracking-wide">avg</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.78rem] font-black text-[#0C0C0F]">Needs attention</p>
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Follow up</span>
          </div>
          <div className="space-y-2.5">
            {data.needs_attention.length === 0 ? (
              <p className="text-[0.78rem] text-[#94A3B8]">All learners on track.</p>
            ) : data.needs_attention.map(l => (
              <div key={l.student_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-700">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008M12 21a9 9 0 100-18 9 9 0 000 18z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.82rem] font-bold text-[#0C0C0F] truncate">{l.full_name}</p>
                  <p className="text-[0.66rem] text-[#94A3B8]">{l.quiz_attempts > 0 ? `${l.avg_quiz_pct}% quizzes` : 'no quizzes'} · {l.avg_progress_pct}% progress</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[0.95rem] font-black text-red-600 leading-none">{l.avg_progress_pct}%</p>
                  <p className="text-[0.6rem] font-semibold text-[#94A3B8] uppercase tracking-wide">progress</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-learner board */}
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-[1.05rem] font-black text-[#0C0C0F]">All learners</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[#F1F3F5] rounded-lg p-0.5">
            {([
              { id: 'all', label: 'All' },
              { id: 'on_track', label: 'On track' },
              { id: 'needs_attention', label: 'Attention' },
              { id: 'at_risk', label: 'At risk' },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setRiskFilter(f.id)}
                className={`px-3 h-7 rounded-md text-[0.7rem] font-bold transition ${riskFilter === f.id ? 'bg-white text-[#0C0C0F] shadow-sm' : 'text-[#94A3B8] hover:text-[#0C0C0F]'}`}
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
            <option value="recent">Sort: Recent activity</option>
            <option value="progress">Sort: Progress</option>
            <option value="score">Sort: Quiz score</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search learners by name or email..."
          className="w-full h-11 pl-11 pr-4 bg-white border border-[#E5E7EB] rounded-xl text-[0.85rem] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
        />
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-6 py-10 text-center">
          <p className="text-[0.82rem] text-[#94A3B8]">No learners match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((l: LearnerSummary) => {
            const isOpen = expanded.has(l.student_id)
            const risk = RISK_META[l.risk_level]
            const progressColor = l.avg_progress_pct >= 75 ? '#10B981' : l.avg_progress_pct >= 25 ? '#FF5533' : '#3B82F6'
            return (
              <div key={l.student_id} className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_4px_20px_rgba(12,12,15,0.04)] overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center text-[0.95rem] font-black">
                      {(l.full_name || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <p className="text-[0.95rem] font-black text-[#0C0C0F] truncate">{l.full_name}</p>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wide border" style={{ background: risk.bg, color: risk.color, borderColor: risk.border }}>{risk.label}</span>
                      </div>
                      <p className="text-[0.72rem] text-[#94A3B8] truncate">{l.email}</p>
                      <div className="flex items-center gap-2 text-[0.7rem] text-[#94A3B8] flex-wrap mt-1">
                        <span>{l.courses_enrolled} course{l.courses_enrolled === 1 ? '' : 's'}</span>
                        <span>·</span>
                        <span>{l.courses_completed} done · {l.courses_in_progress} active</span>
                        {l.last_active_at ? (
                          <>
                            <span>·</span>
                            <span>Active {relTimeShort(l.last_active_at)}</span>
                          </>
                        ) : (
                          <>
                            <span>·</span>
                            <span className="text-red-500 font-bold">Never active</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleExpanded(l.student_id)}
                      className="shrink-0 h-8 px-3 rounded-lg border border-[#E5E7EB] text-[0.72rem] font-bold text-[#0C0C0F] hover:bg-[#F8F9FA] transition"
                    >
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                    <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                      <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Progress</p>
                      <p className="text-[1.05rem] font-black leading-none" style={{ color: progressColor }}>{l.avg_progress_pct}%</p>
                    </div>
                    <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                      <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Quizzes</p>
                      <p className="text-[1.05rem] font-black text-[#3B82F6] leading-none">{l.quiz_attempts}</p>
                    </div>
                    <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                      <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Avg score</p>
                      <p className="text-[1.05rem] font-black leading-none" style={{ color: l.quiz_attempts > 0 ? learnerScoreColor(l.quiz_avg_pct) : '#94A3B8' }}>
                        {l.quiz_attempts > 0 ? `${l.quiz_avg_pct}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                      <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Pass rate</p>
                      <p className="text-[1.05rem] font-black leading-none" style={{ color: l.quiz_attempts > 0 ? learnerScoreColor(l.quiz_pass_rate) : '#94A3B8' }}>
                        {l.quiz_attempts > 0 ? `${l.quiz_pass_rate}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                      <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Active 30d</p>
                      <p className="text-[1.05rem] font-black text-[#0C0C0F] leading-none">{l.active_days_30d}d</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[0.66rem] mb-1">
                      <span className="text-[#94A3B8] font-semibold">Average progress</span>
                      <span className="font-bold text-[#0C0C0F]">{l.courses_completed}/{l.courses_enrolled} completed</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F3F5] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${l.avg_progress_pct}%`, background: progressColor }} />
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] px-5 py-4">
                    <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-3">Per-course breakdown</p>
                    <div className="space-y-2">
                      {l.courses.map(c => {
                        const cColor = c.progress_pct >= 75 ? '#10B981' : c.progress_pct >= 25 ? '#FF5533' : '#3B82F6'
                        return (
                          <div key={c.course_id} className="bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-3">
                            <div className="flex items-center justify-between gap-3 mb-1.5 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-[0.85rem] font-bold text-[#0C0C0F] truncate">{c.course_title}</p>
                                {c.enrollment_status === 'completed' && (
                                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[0.58rem] font-bold uppercase tracking-wide border border-emerald-200">Completed</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[0.7rem] text-[#94A3B8]">
                                <span><span className="font-bold text-[#0C0C0F]">{c.completed_items}/{c.total_items}</span> lessons</span>
                                <span>·</span>
                                <span><span className="font-bold text-[#0C0C0F]">{c.quiz_attempts}</span> quiz{c.quiz_attempts === 1 ? '' : 'zes'}{c.quiz_attempts > 0 ? ` · ${c.quiz_avg_pct}% avg` : ''}</span>
                              </div>
                            </div>
                            <div className="h-1 bg-[#F1F3F5] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${c.progress_pct}%`, background: cColor }} />
                            </div>
                          </div>
                        )
                      })}
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
  const [selected, setSelected] = useState<CourseOut | null>(null)
  const [confirmUnenroll, setConfirmUnenroll] = useState<string | null>(null)
  const [unenrolling, setUnenrolling] = useState(false)
  const [unenrollErr, setUnenrollErr] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getEnrolledCourses(token).then(c => {
      setEnrolled(c)
      if (c.length > 0 && c[0].sections.length > 0) setExpandedSection(c[0].sections[0].id)
    }).finally(() => setLoading(false))
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

  return (
    <div className="max-w-[1080px] animate-fadeIn">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-[1.6rem] font-semibold tracking-[-0.02em] text-[#0C0C0F]">My learning</h2>
          <p className="text-[0.86rem] text-[#64748B] mt-1">Courses you're enrolled in as a learner.</p>
        </div>
        <span className="text-[0.74rem] font-semibold text-[#64748B] bg-white border border-[#E5E7EB] rounded-md px-2.5 py-1">
          {enrolled.length} course{enrolled.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl skeleton" />
          ))}
        </div>
      ) : enrolled.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-[#E5E7EB]">
          <p className="text-[1rem] font-semibold text-[#0C0C0F] mb-1">Not enrolled in any course yet</p>
          <p className="text-[0.86rem] text-[#64748B]">Browse the catalog and enroll to keep learning alongside teaching.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {enrolled.map(c => (
            <div key={c.id} className="group bg-white rounded-xl border border-[#E5E7EB] overflow-hidden flex flex-col transition-all hover:border-[#0C0C0F] hover:shadow-[0_8px_24px_rgba(12,12,15,0.06)]">
              <div
                className="relative aspect-[16/9] cursor-pointer overflow-hidden bg-[#0C0C0F]"
                onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
              >
                {c.thumbnail ? (
                  <img src={`http://localhost:8000/uploads/${c.thumbnail}`} alt={c.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/90 text-[2.5rem] font-semibold tracking-tight">{c.title.charAt(0).toUpperCase()}</span>
                  </div>
                )}

                <div className="absolute top-2.5 right-2.5" onClick={e => e.stopPropagation()}>
                  {confirmUnenroll === c.id ? (
                    <div className="flex items-center gap-1 bg-white rounded-lg shadow-md p-1 border border-[#E5E7EB]">
                      <button onClick={() => handleUnenroll(c.id)} disabled={unenrolling}
                        className="px-2 py-1 text-[0.68rem] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md border-none cursor-pointer transition-colors">
                        {unenrolling ? '…' : 'Remove'}
                      </button>
                      <button onClick={() => setConfirmUnenroll(null)}
                        className="px-2 py-1 text-[0.68rem] font-semibold text-[#64748B] bg-[#F1F3F5] hover:bg-[#E5E7EB] rounded-md border-none cursor-pointer transition-colors">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmUnenroll(c.id)}
                      className="w-7 h-7 rounded-md bg-white/90 backdrop-blur-sm flex items-center justify-center text-[#64748B] hover:text-red-500 border-none cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove course">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <h3
                  className="text-[0.92rem] font-semibold text-[#0C0C0F] leading-snug mb-1.5 line-clamp-2 cursor-pointer group-hover:text-[#FF5533] transition-colors"
                  onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
                >{c.title}</h3>
                <p className="text-[0.76rem] text-[#94A3B8] truncate mb-4">{c.professor_name}</p>

                <p className="mb-4 text-[0.72rem] text-[#94A3B8]">{c.sections_count} section{c.sections_count !== 1 ? 's' : ''}</p>

                <div className="mt-auto flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/learn/${c.id}`)}
                    className="flex-1 h-9 bg-[#0C0C0F] text-white text-[0.78rem] font-semibold rounded-lg hover:bg-[#1E1E23] transition-colors flex items-center justify-center gap-1.5 border-none cursor-pointer">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Continue
                  </button>
                  <button
                    onClick={async () => { const full = await getCourseDetail(c.id); setSelected(full) }}
                    className="h-9 w-9 bg-white text-[#64748B] hover:text-[#0C0C0F] border border-[#E5E7EB] hover:border-[#0C0C0F] rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    title="Course details">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v6" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Announcements Section ── */
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

/* ── Analytics helpers ── */
function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.floor(value)
  const hasHalf = value - full >= 0.25 && value - full < 0.75
  const fullStars = hasHalf ? full : Math.round(value)
  const stars = Array.from({ length: 5 }, (_, i) => {
    if (i < full) return 'full'
    if (i === full && hasHalf) return 'half'
    if (i < fullStars) return 'full'
    return 'empty'
  })
  return (
    <span className="inline-flex items-center gap-0.5">
      {stars.map((kind, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={kind === 'empty' ? 'none' : '#F59E0B'} stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {kind === 'half' ? (
            <>
              <defs>
                <linearGradient id={`half-${i}-${size}`}>
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={`url(#half-${i}-${size})`} />
            </>
          ) : (
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          )}
        </svg>
      ))}
    </span>
  )
}

function MiniStat({ label, value, hint, color, accent }: { label: string; value: string | number; hint?: string; color?: string; accent?: string }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 shadow-[0_4px_20px_rgba(12,12,15,0.04)] relative overflow-hidden">
      {accent && <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent }} />}
      <p className="text-[0.65rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">{label}</p>
      <p className="text-[1.7rem] font-black text-[#0C0C0F] leading-none mb-1" style={color ? { color } : undefined}>{value}</p>
      {hint && <p className="text-[0.7rem] font-semibold text-[#94A3B8]">{hint}</p>}
    </div>
  )
}

function TrendChart({ trend }: { trend: import('../api/course').AnalyticsTrendPoint[] }) {
  const W = 720
  const H = 180
  const PAD_X = 12
  const PAD_TOP = 16
  const PAD_BOTTOM = 24
  const max = Math.max(1, ...trend.map(t => Math.max(t.enrollments, t.completions)))
  const stepX = trend.length > 1 ? (W - PAD_X * 2) / (trend.length - 1) : 0
  const yOf = (v: number) => PAD_TOP + (1 - v / max) * (H - PAD_TOP - PAD_BOTTOM)
  const xOf = (i: number) => PAD_X + i * stepX
  const enrollPath = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(t.enrollments).toFixed(1)}`).join(' ')
  const enrollArea = `${enrollPath} L${xOf(trend.length - 1).toFixed(1)},${(H - PAD_BOTTOM).toFixed(1)} L${xOf(0).toFixed(1)},${(H - PAD_BOTTOM).toFixed(1)} Z`
  const completePath = trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(t.completions).toFixed(1)}`).join(' ')

  const labelEvery = Math.max(1, Math.floor(trend.length / 6))
  const fmtDay = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[180px] min-w-[480px]">
        <defs>
          <linearGradient id="enroll-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5533" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF5533" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f} y2={PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * f} stroke="#F1F3F5" strokeWidth="1" />
        ))}
        <path d={enrollArea} fill="url(#enroll-area)" />
        <path d={enrollPath} fill="none" stroke="#FF5533" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={completePath} fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" />
        {/* X labels */}
        {trend.map((t, i) => (i % labelEvery === 0 || i === trend.length - 1) && (
          <text key={t.date} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600">{fmtDay(t.date)}</text>
        ))}
      </svg>
    </div>
  )
}

function RatingDistributionBars({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map(star => {
        const count = Number(distribution?.[star] ?? 0)
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-[0.7rem] font-bold text-[#0C0C0F] w-3">{star}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1.6" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <div className="flex-1 h-1.5 bg-[#F1F3F5] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: '#F59E0B' }} />
            </div>
            <span className="text-[0.66rem] font-bold text-[#94A3B8] w-7 text-right tabular-nums">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function relativeTime(iso: string): string {
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

/* ── Analytics Section ── */
function AnalyticsSection({ token }: { token: string }) {
  const [data, setData] = useState<import('../api/course').CourseAnalyticsOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'recent' | 'enrolled' | 'rating' | 'completion'>('recent')
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    import('../api/course').then(({ getCourseAnalytics }) => {
      getCourseAnalytics(token).then(setData).catch(() => {}).finally(() => setLoading(false))
    })
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data || data.courses.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-2xl px-8 py-16 text-center shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
        <div className="w-14 h-14 mx-auto mb-4 bg-[#F1F3F5] rounded-2xl flex items-center justify-center">
          <TrendIcon />
        </div>
        <p className="text-[0.9rem] font-semibold text-[#0C0C0F] mb-1">No courses yet</p>
        <p className="text-[0.82rem] text-[#94A3B8]">Create and publish courses to see analytics here.</p>
      </div>
    )
  }

  const filtered = data.courses.filter(c =>
    filter === 'all' ? true : filter === 'published' ? c.is_published : !c.is_published
  )
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'enrolled') return b.enrolled_count - a.enrolled_count
    if (sortBy === 'rating') return b.avg_rating - a.avg_rating || b.rating_count - a.rating_count
    if (sortBy === 'completion') return b.completion_rate - a.completion_rate
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[1.5rem] font-black text-[#0C0C0F] tracking-tight leading-tight">Analytics</h2>
          <p className="text-[0.82rem] text-[#94A3B8] mt-0.5">Performance overview across {data.total_courses} course{data.total_courses === 1 ? '' : 's'} · last 30 days</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[0.7rem] font-bold text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#FF5533]" /> Enrollments
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-[#10B981] [border-top:1px_dashed_#10B981]" style={{ borderTop: '1.5px dashed #10B981', background: 'transparent' }} /> Completions
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Total students" value={data.total_enrolled} hint={`+${data.enrollments_last_7d} this week`} accent="#3B82F6" />
        <MiniStat label="Completion rate" value={`${data.overall_completion_rate}%`} hint={`${data.total_completed} completed`} accent="#10B981" />
        <MiniStat
          label="Average rating"
          value={data.total_reviews > 0 ? data.overall_avg_rating.toFixed(1) : '—'}
          hint={`${data.total_reviews} review${data.total_reviews === 1 ? '' : 's'}`}
          accent="#F59E0B"
        />
        <MiniStat label="Live courses" value={`${data.total_published}/${data.total_courses}`} hint={`${data.total_drafts} draft${data.total_drafts === 1 ? '' : 's'}`} accent="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Trend chart */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em]">Enrollment trend</p>
              <p className="text-[1.1rem] font-black text-[#0C0C0F] leading-tight">Last 30 days</p>
            </div>
            <div className="text-right">
              <p className="text-[1.2rem] font-black text-[#FF5533] leading-none">+{data.enrollments_last_30d}</p>
              <p className="text-[0.66rem] font-semibold text-[#94A3B8] uppercase tracking-wide mt-0.5">enrollments</p>
            </div>
          </div>
          <TrendChart trend={data.trend} />
        </div>

        {/* Overall rating */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Overall rating</p>
          {data.total_reviews > 0 ? (
            <>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[2.2rem] font-black text-[#0C0C0F] leading-none">{data.overall_avg_rating.toFixed(1)}</span>
                <span className="text-[0.78rem] font-semibold text-[#94A3B8]">/ 5.0</span>
              </div>
              <div className="mb-3"><StarRow value={data.overall_avg_rating} size={16} /></div>
              <p className="text-[0.7rem] font-semibold text-[#94A3B8] mb-3">Based on {data.total_reviews} review{data.total_reviews === 1 ? '' : 's'}</p>
              <RatingDistributionBars distribution={data.overall_rating_distribution} total={data.total_reviews} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-10 h-10 mb-2 rounded-full bg-[#F1F3F5] flex items-center justify-center"><StarRow value={0} size={14} /></div>
              <p className="text-[0.78rem] font-semibold text-[#0C0C0F]">No reviews yet</p>
              <p className="text-[0.7rem] text-[#94A3B8] mt-0.5">Reviews appear once students complete a course.</p>
            </div>
          )}
        </div>
      </div>

      {/* Top performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.78rem] font-black text-[#0C0C0F]">Top by enrollment</p>
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-[#3B82F6] bg-blue-50 px-2 py-0.5 rounded-full">Most popular</span>
          </div>
          <div className="space-y-2.5">
            {data.top_courses_by_enrollment.length === 0 ? (
              <p className="text-[0.78rem] text-[#94A3B8]">No data yet.</p>
            ) : data.top_courses_by_enrollment.map((c, i) => (
              <div key={c.course_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#F1F3F5] flex items-center justify-center text-[0.78rem] font-black text-[#0C0C0F]">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.82rem] font-bold text-[#0C0C0F] truncate">{c.course_title}</p>
                  <p className="text-[0.66rem] text-[#94A3B8]">{c.completion_rate}% completion</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[0.95rem] font-black text-[#0C0C0F] leading-none">{c.enrolled_count}</p>
                  <p className="text-[0.6rem] font-semibold text-[#94A3B8] uppercase tracking-wide">students</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 shadow-[0_4px_20px_rgba(12,12,15,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[0.78rem] font-black text-[#0C0C0F]">Top by rating</p>
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Highest rated</span>
          </div>
          <div className="space-y-2.5">
            {data.top_courses_by_rating.length === 0 ? (
              <p className="text-[0.78rem] text-[#94A3B8]">No reviews yet.</p>
            ) : data.top_courses_by_rating.map((c, i) => (
              <div key={c.course_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#FFF7E6] flex items-center justify-center text-[0.78rem] font-black text-amber-700">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.82rem] font-bold text-[#0C0C0F] truncate">{c.course_title}</p>
                  <div className="flex items-center gap-1.5">
                    <StarRow value={c.avg_rating} size={11} />
                    <span className="text-[0.66rem] text-[#94A3B8]">({c.rating_count})</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[0.95rem] font-black text-amber-600 leading-none">{c.avg_rating.toFixed(1)}</p>
                  <p className="text-[0.6rem] font-semibold text-[#94A3B8] uppercase tracking-wide">avg</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-course breakdown */}
      <div className="flex items-end justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-[1.05rem] font-black text-[#0C0C0F]">Course performance</h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F1F3F5] rounded-lg p-0.5">
            {(['all', 'published', 'draft'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 h-7 rounded-md text-[0.7rem] font-bold capitalize transition ${filter === f ? 'bg-white text-[#0C0C0F] shadow-sm' : 'text-[#94A3B8] hover:text-[#0C0C0F]'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 px-3 pr-8 border border-[#E5E7EB] rounded-lg bg-white text-[0.74rem] font-bold text-[#0C0C0F] focus:outline-none focus:ring-2 focus:ring-[#0C0C0F]/10"
          >
            <option value="recent">Sort: Newest</option>
            <option value="enrolled">Sort: Most enrolled</option>
            <option value="rating">Sort: Highest rated</option>
            <option value="completion">Sort: Highest completion</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {sorted.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-6 py-10 text-center">
            <p className="text-[0.82rem] text-[#94A3B8]">No courses match this filter.</p>
          </div>
        ) : sorted.map(course => {
          const isOpen = expanded.has(course.course_id)
          const completionColor = course.completion_rate >= 75 ? '#10B981' : course.completion_rate >= 40 ? '#FF5533' : '#3B82F6'
          return (
            <div key={course.course_id} className="bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_4px_20px_rgba(12,12,15,0.04)] overflow-hidden">
              <div className="px-5 py-5">
                {/* Header row */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 shrink-0 rounded-xl bg-[#F1F3F5] overflow-hidden border border-[#E5E7EB]">
                    {course.thumbnail ? (
                      <img src={`http://localhost:8000${course.thumbnail}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#94A3B8]"><BookIcon /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-[0.95rem] font-black text-[#0C0C0F] truncate">{course.course_title}</p>
                      {course.is_published ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[0.6rem] font-bold uppercase tracking-wide border border-emerald-200">Live</span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F1F3F5] text-[#94A3B8] text-[0.6rem] font-bold uppercase tracking-wide">Draft</span>
                      )}
                      {course.category_name && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#F8F9FA] text-[#0C0C0F] text-[0.6rem] font-bold uppercase tracking-wide border border-[#E5E7EB]">{course.category_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[0.72rem] text-[#94A3B8] flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <StarRow value={course.avg_rating} size={11} />
                        <span className="font-bold text-[#0C0C0F]">{course.rating_count > 0 ? course.avg_rating.toFixed(1) : '—'}</span>
                        <span>({course.rating_count})</span>
                      </span>
                      <span>·</span>
                      <span>{course.total_lessons} lesson{course.total_lessons === 1 ? '' : 's'}</span>
                      {course.enrollments_last_7d > 0 && <><span>·</span><span className="text-emerald-600 font-bold">+{course.enrollments_last_7d} this week</span></>}
                      {course.last_enrollment_at && <><span>·</span><span>last enroll {relativeTime(course.last_enrollment_at)}</span></>}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpanded(course.course_id)}
                    className="shrink-0 h-8 px-3 rounded-lg border border-[#E5E7EB] text-[0.72rem] font-bold text-[#0C0C0F] hover:bg-[#F8F9FA] transition"
                  >
                    {isOpen ? 'Hide' : 'Reviews'}
                  </button>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                  <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                    <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Enrolled</p>
                    <p className="text-[1.05rem] font-black text-[#3B82F6] leading-none">{course.enrolled_count}</p>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                    <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Completed</p>
                    <p className="text-[1.05rem] font-black text-[#10B981] leading-none">{course.completed_count}</p>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                    <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">In progress</p>
                    <p className="text-[1.05rem] font-black text-[#FF5533] leading-none">{course.in_progress_count}</p>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                    <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Avg progress</p>
                    <p className="text-[1.05rem] font-black text-[#8B5CF6] leading-none">{course.avg_progress}%</p>
                  </div>
                  <div className="bg-[#F8F9FA] rounded-xl px-3 py-2.5">
                    <p className="text-[0.6rem] font-bold text-[#94A3B8] uppercase tracking-wide mb-1">Last 30d</p>
                    <p className="text-[1.05rem] font-black text-[#0C0C0F] leading-none">+{course.enrollments_last_30d}</p>
                  </div>
                </div>

                {/* Completion bar */}
                <div>
                  <div className="flex items-center justify-between text-[0.68rem] mb-1.5">
                    <span className="text-[#94A3B8] font-semibold">Completion rate</span>
                    <span className="font-bold text-[#0C0C0F]">{course.completed_count}/{course.enrolled_count} · {course.completion_rate}%</span>
                  </div>
                  <div className="h-2 bg-[#F1F3F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${course.completion_rate}%`, background: completionColor }} />
                  </div>
                </div>
              </div>

              {/* Expanded reviews panel */}
              {isOpen && (
                <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] px-5 py-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Rating summary */}
                    <div>
                      <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Rating breakdown</p>
                      {course.rating_count > 0 ? (
                        <>
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-[2rem] font-black text-[#0C0C0F] leading-none">{course.avg_rating.toFixed(1)}</span>
                            <span className="text-[0.74rem] font-semibold text-[#94A3B8]">/ 5</span>
                          </div>
                          <div className="mb-2"><StarRow value={course.avg_rating} size={14} /></div>
                          <p className="text-[0.7rem] font-semibold text-[#94A3B8] mb-3">{course.rating_count} review{course.rating_count === 1 ? '' : 's'}</p>
                          <RatingDistributionBars distribution={course.rating_distribution} total={course.rating_count} />
                        </>
                      ) : (
                        <p className="text-[0.78rem] text-[#94A3B8]">No reviews yet for this course.</p>
                      )}
                    </div>

                    {/* Recent reviews */}
                    <div className="md:col-span-2">
                      <p className="text-[0.7rem] font-bold text-[#94A3B8] uppercase tracking-[0.08em] mb-2">Recent reviews</p>
                      {course.recent_reviews.length === 0 ? (
                        <div className="bg-white border border-dashed border-[#E5E7EB] rounded-xl px-4 py-6 text-center">
                          <p className="text-[0.78rem] text-[#94A3B8]">Once students complete the course they can leave a review.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                          {course.recent_reviews.map((r, i) => (
                            <div key={i} className="bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-3">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[#FF5533] to-[#FF8B6B] text-white flex items-center justify-center text-[0.68rem] font-black">
                                    {(r.user_name || 'U').slice(0, 1).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[0.78rem] font-bold text-[#0C0C0F] truncate">{r.user_name}</p>
                                    <p className="text-[0.62rem] font-semibold text-[#94A3B8]">{relativeTime(r.created_at)}</p>
                                  </div>
                                </div>
                                <StarRow value={r.rating} size={12} />
                              </div>
                              {r.comment && <p className="text-[0.78rem] text-[#0C0C0F] leading-relaxed mt-1.5">{r.comment}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main Dashboard ── */
export default function ProfessorDashboard() {
  const { user, token } = useAuth()
  const [nav, setNav] = useState('home')
  const [mounted, setMounted] = useState<Set<string>>(() => new Set(['home']))
  const [homeStats, setHomeStats] = useState({ courses: 0, students: 0, published: 0 })
  const firstName = user?.full_name?.split(' ')[0] || ''

  useEffect(() => {
    setMounted(prev => {
      if (prev.has(nav)) return prev
      const next = new Set(prev)
      next.add(nav)
      return next
    })
  }, [nav])

  useEffect(() => {
    if (!token) return
    getMyCourses(token).then(courses => {
      const published = courses.filter(c => c.is_published).length
      const students = courses.reduce((s, c) => s + c.enrolled_count, 0)
      setHomeStats({ courses: courses.length, students, published })
    }).catch(() => {})
  }, [token])

  const navItems = user?.university_id
    ? [...BASE_NAV.slice(0, -1), ANNOUNCEMENTS_NAV_ITEM, BASE_NAV[BASE_NAV.length - 1]]
    : BASE_NAV

  const knownNavIds = new Set(['home', 'courses', 'my-learning', 'my-courses', 'gamification', 'students', 'chat', 'messages', 'find-friends', 'announcements', 'analytics'])

  return (
    <DashboardLayout navItems={navItems} activeNav={nav} onNavChange={setNav} roleLabel="Professor">

      {/* ── Browse Courses ── */}
      <div className={nav !== 'courses' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('courses') && <BrowseCoursesSection token={token!} currentUserId={user!.id} />}
      </div>

      {/* ── My Learning ── */}
      <div className={nav !== 'my-learning' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('my-learning') && <MyLearningSection token={token!} />}
      </div>

      {/* ── My Courses ── */}
      <div className={nav !== 'my-courses' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('my-courses') && <CoursesSection token={token!} />}
      </div>

      {/* ── Students ── */}
      <div className={nav !== 'students' ? 'hidden' : 'max-w-[1200px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('students') && (
          <>
            <LearnersAnalyticsSection token={token!} />
            <MyStudentsSection token={token!} />
          </>
        )}
      </div>

      {/* ── Chat ── */}
      <div className={nav !== 'chat' ? 'hidden' : 'max-w-[960px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('chat') && <IncomingChatRequestsSection token={token!} currentUserId={user!.id} />}
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

      {/* ── Analytics ── */}
      <div className={nav !== 'analytics' ? 'hidden' : 'max-w-[1200px] mx-auto px-6 md:px-10 py-8'}>
        {mounted.has('analytics') && <AnalyticsSection token={token!} />}
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
            <p className="text-[0.66rem] font-bold tracking-[0.18em] uppercase text-[#FF5533] mb-2.5">Professor workspace</p>
            <h1 className="text-[1.85rem] sm:text-[2.1rem] font-semibold tracking-[-0.025em] leading-[1.1] text-[#0C0C0F]">
              Welcome back, {firstName || 'professor'}.
            </h1>
            <p className="text-[#64748B] text-[0.92rem] mt-2.5 max-w-xl leading-relaxed">
              Build courses, track engagement, and keep your students moving forward.
            </p>
            {user?.university_name ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full bg-white border border-[#E5E7EB] text-[#0C0C0F] text-[0.72rem] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />
                  {user.university_name}
                </span>
                {user.region_name && (
                  <span className="inline-flex items-center px-3 h-7 rounded-full bg-white border border-[#E5E7EB] text-[#64748B] text-[0.72rem] font-semibold">
                    {user.region_name}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-4">
                <span className="inline-flex items-center px-3 h-7 rounded-full bg-white border border-[#E5E7EB] text-[#94A3B8] text-[0.72rem] font-semibold">
                  Independent professor
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setNav('my-courses')}
              className="h-10 px-5 rounded-lg bg-[#0C0C0F] text-white font-semibold text-[0.84rem] border-none cursor-pointer hover:bg-[#1E1E23] transition-colors"
            >
              + New course
            </button>
            <button
              onClick={() => setNav('courses')}
              className="h-10 px-5 rounded-lg border border-[#E5E7EB] bg-white text-[#0C0C0F] font-semibold text-[0.84rem] cursor-pointer hover:border-[#0C0C0F] transition-colors"
            >
              Browse catalog
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
            { label: 'Enrolled students', value: homeStats.students },
            { label: 'My courses', value: homeStats.courses },
            { label: 'Published', value: homeStats.published },
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
      </div>
    </DashboardLayout>
  )
}

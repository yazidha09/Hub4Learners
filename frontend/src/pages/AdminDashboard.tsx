import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'
import { listUpgradeRequests, reviewUpgradeRequest, type UpgradeRequestOut } from '../api/upgrade'
import {
  getStats, listUsers, changeUserRole, deleteUser,
  listAllCourses, adminTogglePublish, adminDeleteCourse,
  type AdminUser, type PlatformStats,
} from '../api/admin'
import { listCategories, createCategory, updateCategory, deleteCategory, type CategoryOut } from '../api/category'
import type { CourseOut } from '../api/course'

/* ── Icons ── */
const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const BookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)
const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
const TagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
)

const NAV: NavItem[] = [
  { id: 'home', label: 'Overview', icon: <HomeIcon /> },
  { id: 'users', label: 'Users', icon: <UsersIcon /> },
  { id: 'courses', label: 'Courses', icon: <BookIcon /> },
  { id: 'categories', label: 'Categories', icon: <TagIcon /> },
  { id: 'upgrades', label: 'Upgrade Requests', icon: <ShieldIcon /> },
]

const ROLE_COLORS: Record<string, string> = {
  student: 'text-slate-500',
  professor: 'text-[#FF5533]',
  admin: 'text-blue-600',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', dot: 'bg-red-500' },
}

/* ════════════════════════════════════════════════════════════════════════════
   OVERVIEW PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function OverviewPanel({ token, onNav }: { token: string; onNav: (id: string) => void }) {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([])

  useEffect(() => {
    getStats(token).then(setStats).catch(() => {})
    listUsers(token).then(u => setRecentUsers(u.slice(0, 6))).catch(() => {})
  }, [token])

  const statCards = stats
    ? [
        { label: 'Total Users', value: stats.total_users.toLocaleString() },
        { label: 'Active Courses', value: stats.published_courses.toLocaleString() },
        { label: 'Professors', value: stats.total_professors.toLocaleString() },
        { label: 'Enrollments', value: stats.total_enrollments.toLocaleString() },
      ]
    : [
        { label: 'Total Users', value: '—' },
        { label: 'Active Courses', value: '—' },
        { label: 'Professors', value: '—' },
        { label: 'Enrollments', value: '—' },
      ]

  const pcts = stats
    ? {
        students: stats.total_users ? Math.round((stats.total_students / stats.total_users) * 100) : 0,
        professors: stats.total_users ? Math.round((stats.total_professors / stats.total_users) * 100) : 0,
        admins: stats.total_users ? Math.round((stats.total_admins / stats.total_users) * 100) : 0,
      }
    : { students: 0, professors: 0, admins: 0 }

  return (
    <div className="max-w-[1020px] mx-auto px-6 md:px-10 py-8">
      {/* Hero */}
      <div className="mb-10 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0B0F1F] text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] border border-white/10">
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#FF5533]/20 blur-3xl rounded-full" />
        <div className="absolute -left-14 bottom-0 w-64 h-64 bg-[#22D3EE]/10 blur-3xl rounded-full" />
        <div className="relative p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-[0.7rem] font-bold tracking-[0.16em] uppercase text-white/70 mb-1">Administration</p>
              <h1 className="text-[1.9rem] font-black tracking-[-0.03em] leading-tight">Platform overview</h1>
              <p className="text-white/70 text-[0.95rem] max-w-xl mt-2">
                Manage users, courses, categories, and upgrade requests from one control center.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => onNav('upgrades')} className="h-11 px-5 rounded-xl bg-white text-[#0C0C0F] font-semibold text-[0.9rem] border-none cursor-pointer shadow-md hover:-translate-y-0.5 transition-all">
                Review upgrades
              </button>
              <button onClick={() => onNav('users')} className="h-11 px-5 rounded-xl border border-white/40 text-white/90 font-semibold text-[0.9rem] bg-white/10 backdrop-blur cursor-pointer hover:border-white/70 transition-all">
                Manage users
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {statCards.map(s => (
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
        {/* Recent users */}
        <div>
          <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Recent registrations</h2>
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto shadow-[0_16px_44px_rgba(12,12,15,0.06)]">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-[1fr_1fr_72px_100px] gap-2 px-5 py-3 border-b border-[#F1F3F5] text-[0.62rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">
                <span>Name</span><span>Email</span><span className="text-center">Role</span><span className="text-right">Joined</span>
              </div>
              {recentUsers.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">Loading...</div>
              ) : recentUsers.map(u => (
                <div key={u.id} className="grid grid-cols-[1fr_1fr_72px_100px] gap-2 px-5 py-3 border-b last:border-b-0 border-[#F1F3F5] items-center hover:bg-[#FAFAFA] transition-colors">
                  <span className="text-[0.84rem] font-semibold text-[#0C0C0F] truncate">{u.full_name}</span>
                  <span className="text-[0.78rem] text-[#94A3B8] truncate">{u.email}</span>
                  <span className="text-center">
                    <span className={`text-[0.62rem] font-bold uppercase tracking-[0.08em] ${ROLE_COLORS[u.role] || 'text-slate-400'}`}>{u.role}</span>
                  </span>
                  <span className="text-right text-[0.73rem] text-[#94A3B8]">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-8">
          {/* Role distribution */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-[0_16px_44px_rgba(12,12,15,0.06)] p-5">
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">User distribution</h2>
            <div className="flex h-2 rounded-full overflow-hidden mb-3">
              <div style={{ width: `${pcts.students}%`, background: '#0C0C0F' }} />
              <div style={{ width: `${pcts.professors}%`, background: '#FF5533' }} />
              <div style={{ width: `${pcts.admins}%`, background: '#94A3B8' }} />
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Students', pct: pcts.students, color: '#0C0C0F' },
                { label: 'Professors', pct: pcts.professors, color: '#FF5533' },
                { label: 'Admins', pct: pcts.admins, color: '#94A3B8' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                    <span className="text-[0.78rem] text-[#0C0C0F]">{r.label}</span>
                  </div>
                  <span className="text-[0.78rem] font-bold font-mono text-[#0C0C0F]">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-[0_16px_44px_rgba(12,12,15,0.06)] p-5">
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Quick actions</h2>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Manage Users', nav: 'users' },
                { label: 'Manage Courses', nav: 'courses' },
                { label: 'Manage Categories', nav: 'categories' },
                { label: 'Review Upgrades', nav: 'upgrades' },
              ].map(a => (
                <button
                  key={a.nav}
                  onClick={() => onNav(a.nav)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-slate-100 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                >
                  {a.label}
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   USERS PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function UsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true)
    listUsers(token, roleFilter || undefined, search || undefined)
      .then(setUsers)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token, roleFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load()
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId); setErr('')
    try {
      const updated = await changeUserRole(token, userId, newRole)
      setUsers(prev => prev.map(u => u.id === userId ? updated : u))
    } catch (e: any) { setErr(e.message) }
    finally { setActionLoading(null) }
  }

  const handleDelete = async (userId: string) => {
    setActionLoading(userId); setErr('')
    try {
      await deleteUser(token, userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      setConfirmDelete(null)
    } catch (e: any) { setErr(e.message) }
    finally { setActionLoading(null) }
  }

  return (
    <div className="max-w-[900px] animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h2>
        <p className="text-sm text-slate-500 mt-1">Manage all platform users, change roles, or remove accounts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <form onSubmit={handleSearch} className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
          />
        </form>
        <div className="flex gap-2">
          {['', 'student', 'professor', 'admin'].map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                roleFilter === r
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >{r || 'All'}</button>
          ))}
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

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <p className="text-base font-semibold text-slate-900 mb-1">No users found</p>
          <p className="text-sm text-slate-500">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1fr_1fr_90px_90px_80px] gap-2 px-5 py-3 border-b border-slate-100 text-[0.62rem] font-bold tracking-[0.1em] uppercase text-slate-400">
                <span>Name</span><span>Email</span><span className="text-center">Role</span><span className="text-center">Joined</span><span className="text-center">Actions</span>
              </div>
              {users.map(u => (
                <div key={u.id} className="grid grid-cols-[1fr_1fr_90px_90px_80px] gap-2 px-5 py-3 border-b last:border-b-0 border-slate-50 items-center hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-900 truncate">{u.full_name}</span>
                  </div>
                  <span className="text-xs text-slate-500 truncate">{u.email}</span>
                  <div className="text-center">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      disabled={actionLoading === u.id}
                      className={`text-[0.7rem] font-bold uppercase tracking-wide bg-transparent border-none outline-none cursor-pointer ${ROLE_COLORS[u.role] || 'text-slate-400'}`}
                    >
                      <option value="student">Student</option>
                      <option value="professor">Professor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <span className="text-center text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <div className="text-center">
                    {confirmDelete === u.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={actionLoading === u.id}
                          className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(u.id)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto cursor-pointer hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   COURSES PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function CoursesPanel({ token }: { token: string }) {
  const [courses, setCourses] = useState<CourseOut[]>([])
  const [categories, setCategories] = useState<CategoryOut[]>([])
  const [activeCat, setActiveCat] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {})
  }, [])

  const load = () => {
    setLoading(true)
    listAllCourses(token, activeCat || undefined)
      .then(setCourses)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token, activeCat])

  const filtered = courses.filter(c =>
    !search.trim() ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.professor_name.toLowerCase().includes(search.toLowerCase())
  )

  const handleToggle = async (courseId: string) => {
    setActionLoading(courseId); setErr('')
    try {
      const updated = await adminTogglePublish(token, courseId)
      setCourses(prev => prev.map(c => c.id === courseId ? updated : c))
    } catch (e: any) { setErr(e.message) }
    finally { setActionLoading(null) }
  }

  const handleDelete = async (courseId: string) => {
    setActionLoading(courseId); setErr('')
    try {
      await adminDeleteCourse(token, courseId)
      setCourses(prev => prev.filter(c => c.id !== courseId))
      setConfirmDelete(null)
    } catch (e: any) { setErr(e.message) }
    finally { setActionLoading(null) }
  }

  return (
    <div className="max-w-[900px] animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Courses</h2>
        <p className="text-sm text-slate-500 mt-1">View all courses on the platform, toggle publish status, or remove them</p>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setActiveCat('')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              !activeCat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >All</button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                activeCat === cat.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >{cat.icon} {cat.name}</button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title or professor..."
          className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
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
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <p className="text-base font-semibold text-slate-900 mb-1">No courses found</p>
          <p className="text-sm text-slate-500">{search ? 'Try a different search' : 'No courses in this category'}</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-all">
              {/* Thumbnail */}
              {c.thumbnail ? (
                <img src={`http://localhost:8000/uploads/${c.thumbnail}`} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">{c.title}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs text-slate-500">{c.professor_name}</span>
                  {c.category_name && (
                    <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{c.category_name}</span>
                  )}
                  <span className="text-xs text-slate-400">{c.sections.length} sections</span>
                  <span className="text-xs text-slate-400">{c.enrolled_count} enrolled</span>
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleToggle(c.id)}
                  disabled={actionLoading === c.id}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                    c.is_published
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {c.is_published ? 'Published' : 'Draft'}
                </button>
                {confirmDelete === c.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={actionLoading === c.id}
                      className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center cursor-pointer hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   CATEGORIES PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function CategoriesPanel({ token }: { token: string }) {
  const [categories, setCategories] = useState<CategoryOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formIcon, setFormIcon] = useState('📚')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true)
    listCategories().then(setCategories).catch(e => setErr(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setShowForm(false); setEditingId(null)
    setFormName(''); setFormDesc(''); setFormIcon('📚')
  }

  const startEdit = (cat: CategoryOut) => {
    setEditingId(cat.id)
    setFormName(cat.name)
    setFormDesc(cat.description || '')
    setFormIcon(cat.icon)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return
    setSaving(true); setErr('')
    try {
      if (editingId) {
        const updated = await updateCategory(token, editingId, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          icon: formIcon,
        })
        setCategories(prev => prev.map(c => c.id === editingId ? updated : c))
      } else {
        const created = await createCategory(token, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          icon: formIcon,
        })
        setCategories(prev => [...prev, created])
      }
      resetForm()
    } catch (e: any) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (catId: string) => {
    setActionLoading(catId); setErr('')
    try {
      await deleteCategory(token, catId)
      setCategories(prev => prev.filter(c => c.id !== catId))
      setConfirmDelete(null)
    } catch (e: any) { setErr(e.message) }
    finally { setActionLoading(null) }
  }

  const EMOJI_OPTIONS = ['📚', '🔬', '📐', '💻', '⚙️', '🌍', '📊', '🎨', '🏥', '📖', '🎯', '🧪', '🎓', '📝', '🏗️', '🌐', '🧠', '🎵']

  return (
    <div className="max-w-[700px] animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Categories</h2>
          <p className="text-sm text-slate-500 mt-1">Create and manage course categories so professors can classify their work</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold border-none cursor-pointer hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New category
          </button>
        )}
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {err}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-6 mb-6 animate-fadeIn">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">{editingId ? 'Edit category' : 'New category'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setFormIcon(e)}
                    className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border-2 transition-all cursor-pointer ${
                      formIcon === e ? 'border-slate-900 bg-slate-100' : 'border-slate-100 bg-white hover:border-slate-300'
                    }`}
                  >{e}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Name <span className="text-red-500">*</span></label>
              <input
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. Artificial Intelligence"
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Description</label>
              <input
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Short description of this category..."
                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={resetForm} className="flex-1 h-10 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors border-none cursor-pointer">Cancel</button>
              <button
                type="submit"
                disabled={!formName.trim() || saving}
                className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all border-none cursor-pointer"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
          <p className="text-base font-semibold text-slate-900 mb-1">No categories yet</p>
          <p className="text-sm text-slate-500">Create your first category above</p>
        </div>
      ) : (
        <div className="space-y-2 stagger-children">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_6px_rgba(0,0,0,0.04)] px-5 py-4 flex items-center gap-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all">
              <span className="text-2xl">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{cat.name}</h3>
                <p className="text-xs text-slate-400 truncate">{cat.description || 'No description'}</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full shrink-0">
                {cat.course_count} course{cat.course_count !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(cat)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center cursor-pointer hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                {confirmDelete === cat.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={actionLoading === cat.id}
                      className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(cat.id)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center cursor-pointer hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   UPGRADE REQUESTS PANEL (preserved from original)
   ════════════════════════════════════════════════════════════════════════════ */

function UpgradeRequestsPanel({ token }: { token: string }) {
  const [requests, setRequests] = useState<UpgradeRequestOut[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    listUpgradeRequests(token).then(setRequests).finally(() => setLoading(false))
  }, [token])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      const updated = await reviewUpgradeRequest(token, id, 'approve')
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
    } finally { setActionLoading(null) }
  }

  const handleReject = async (id: string) => {
    setActionLoading(id)
    try {
      const updated = await reviewUpgradeRequest(token, id, 'reject', rejectNotes)
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      setRejectingId(null); setRejectNotes('')
    } finally { setActionLoading(null) }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-2xl skeleton" />)}
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-900 mb-1">No upgrade requests</p>
        <p className="text-sm text-slate-500">Requests from students will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 stagger-children">
      {requests.map(req => {
        const status = STATUS_STYLES[req.status] || STATUS_STYLES.pending
        return (
          <div key={req.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-lg font-bold text-slate-600">
                  {req.user_full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{req.user_full_name}</p>
                  <p className="text-sm text-slate-500">{req.user_email}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${status.bg} ${status.text} ${status.border}`}>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
              </span>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {req.cin_path && (
                  <a href={`http://localhost:8000/uploads/${req.cin_path}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                    </svg>
                    View CIN
                  </a>
                )}
                {req.diploma_path && (
                  <a href={`http://localhost:8000/uploads/${req.diploma_path}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                    </svg>
                    View Diploma
                  </a>
                )}
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>

              {req.message && (
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl mb-4">
                  <svg className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  <p className="text-sm text-slate-600 leading-relaxed italic">"{req.message}"</p>
                </div>
              )}

              {req.reviewer_notes && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl mb-4">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">Admin note</p>
                    <p className="text-sm text-amber-800">{req.reviewer_notes}</p>
                  </div>
                </div>
              )}

              {req.status === 'pending' && (
                <div className="pt-2">
                  {rejectingId === req.id ? (
                    <div className="space-y-3 animate-fadeIn">
                      <textarea
                        value={rejectNotes}
                        onChange={e => setRejectNotes(e.target.value)}
                        placeholder="Reason for rejection (optional)..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 resize-none outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all"
                      />
                      <div className="flex gap-3">
                        <button onClick={() => handleReject(req.id)} disabled={actionLoading === req.id}
                          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl border-none cursor-pointer hover:bg-red-600 transition-all disabled:opacity-50 shadow-lg shadow-red-500/25">
                          {actionLoading === req.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          )}
                          Confirm rejection
                        </button>
                        <button onClick={() => { setRejectingId(null); setRejectNotes('') }}
                          className="px-4 py-2.5 bg-white text-slate-600 text-sm font-semibold rounded-xl border border-slate-200 cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white text-sm font-semibold rounded-xl border-none cursor-pointer hover:bg-emerald-600 hover:-translate-y-0.5 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25">
                        {actionLoading === req.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        )}
                        Approve
                      </button>
                      <button onClick={() => setRejectingId(req.id)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-red-500 text-sm font-semibold rounded-xl border border-red-200 cursor-pointer hover:bg-red-50 hover:border-red-300 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN ADMIN DASHBOARD
   ════════════════════════════════════════════════════════════════════════════ */

export default function AdminDashboard() {
  const { token } = useAuth()
  const [nav, setNav] = useState('home')

  const wrapper = (title: string, subtitle: string, children: React.ReactNode) => (
    <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Admin">
      <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">
        <div className="mb-7">
          <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#FF5533] mb-1">Administration</p>
          <h1 className="text-[1.75rem] font-black tracking-[-0.03em] text-[#0C0C0F]">{title}</h1>
          <p className="text-[0.85rem] text-[#94A3B8] mt-1">{subtitle}</p>
        </div>
        {children}
      </div>
    </DashboardLayout>
  )

  if (nav === 'home') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Admin">
        <OverviewPanel token={token!} onNav={setNav} />
      </DashboardLayout>
    )
  }

  if (nav === 'users') {
    return wrapper('Users', 'Manage all platform users, change roles, or remove accounts.', <UsersPanel token={token!} />)
  }

  if (nav === 'courses') {
    return wrapper('Courses', 'View all courses, toggle publish status, or remove them.', <CoursesPanel token={token!} />)
  }

  if (nav === 'categories') {
    return wrapper('Categories', 'Create and manage course categories.', <CategoriesPanel token={token!} />)
  }

  if (nav === 'upgrades') {
    return wrapper('Upgrade requests', 'Review professor upgrade requests from students.', <UpgradeRequestsPanel token={token!} />)
  }

  return (
    <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Admin">
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-[1.1rem] font-bold text-[#0C0C0F]">{NAV.find(n => n.id === nav)?.label}</h2>
          <p className="text-[0.82rem] text-[#94A3B8] mt-1">Coming soon</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

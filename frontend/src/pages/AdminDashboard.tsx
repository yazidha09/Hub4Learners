import { useState, useEffect, useRef } from 'react'
import { useAuth, hasMinRank, ROLE_RANK, type UserRole } from '../context/AuthContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'
import {
  getStats, listUsers, changeUserRole, deleteUser,
  listAllCourses, adminTogglePublish, adminDeleteCourse,
  listAnnouncements, createAnnouncement,
  type AdminUser, type PlatformStats, type AnnouncementOut, ROLE_LABELS, ALL_ROLES,
} from '../api/admin'
import {
  listRegions, createRegion, deleteRegion,
  listUniversities, createUniversity, deleteUniversity,
  createRegionalAdmin, createUniversityAdmin, createProfessor,
  listJoinRequests, reviewJoinRequest,
  type RegionOut, type UniversityOut, type JoinRequestOut,
} from '../api/org'
import { listCategories, createCategory, updateCategory, deleteCategory, type CategoryOut } from '../api/category'
import type { CourseOut } from '../api/course'
import { listVerifications, reviewVerification, type ProfVerificationOut } from '../api/prof_verification'

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
const OrgIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><path d="M8 13H4a2 2 0 0 0-2 2v2h8" /><path d="M16 13h4a2 2 0 0 1 2 2v2h-8" /><circle cx="12" cy="15" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" />
  </svg>
)
const MegaphoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l19-9-9 19-2-8-8-2z" />
  </svg>
)

const ALL_NAV: NavItem[] = [
  { id: 'home',             label: 'Overview',              icon: <HomeIcon /> },
  { id: 'org',              label: 'Organization',          icon: <OrgIcon /> },
  { id: 'users',            label: 'Users',                 icon: <UsersIcon /> },
  { id: 'courses',          label: 'Courses',               icon: <BookIcon /> },
  { id: 'categories',       label: 'Categories',            icon: <TagIcon /> },
  { id: 'prof-verif',       label: 'Prof. Verifications',   icon: <ShieldIcon /> },
  { id: 'announcements',    label: 'Announcements',         icon: <MegaphoneIcon /> },
]

// Which nav items each role may see
const NAV_ALLOW: Record<string, string[]> = {
  super_admin:      ['home', 'org', 'users', 'categories', 'prof-verif'],
  regional_admin:   ['home', 'org', 'users', 'courses', 'prof-verif'],
  university_admin: ['home', 'org', 'users', 'announcements'],
}

function getNav(role: string): NavItem[] {
  const allowed = NAV_ALLOW[role] ?? ['home', 'users']
  return ALL_NAV.filter(n => allowed.includes(n.id))
}

const ROLE_COLORS: Record<string, string> = {
  student:          'text-slate-500',
  professor:        'text-[#FF5533]',
  university_admin: 'text-blue-600',
  regional_admin:   'text-violet-600',
  super_admin:      'text-emerald-600',
}

/* ════════════════════════════════════════════════════════════════════════════
   OVERVIEW PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function OverviewPanel({ token, userRole, universityName, regionName, onNav }: {
  token: string
  userRole: string
  universityName: string | null
  regionName: string | null
  onNav: (id: string) => void
}) {
  const isSuperAdmin = userRole === 'super_admin'
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([])

  useEffect(() => {
    if (isSuperAdmin) getStats(token).then(setStats).catch(() => {})
    listUsers(token).then(u => setRecentUsers(u.slice(0, 6))).catch(() => {})
  }, [token])

  // ── Scoped overview for regional / university admins ──────────────────────
  if (!isSuperAdmin) {
    const scopeLabel = userRole === 'regional_admin'
      ? `Region: ${regionName ?? 'Your Region'}`
      : `University: ${universityName ?? 'Your University'}${regionName ? ` · ${regionName}` : ''}`

    const quickActions = userRole === 'regional_admin'
      ? [{ label: 'Manage Universities', nav: 'org' }, { label: 'Manage Users', nav: 'users' }, { label: 'Prof. Verifications', nav: 'prof-verif' }]
      : [{ label: 'Create Professors', nav: 'org' }, { label: 'Manage Users', nav: 'users' }]

    return (
      <div className="max-w-[1020px] mx-auto px-6 md:px-10 py-8">
        {/* Scoped hero */}
        <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#111827] to-[#0B0F1F] text-white shadow-[0_25px_80px_rgba(15,23,42,0.35)] border border-white/10">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#FF5533]/20 blur-3xl rounded-full" />
          <div className="relative p-6 sm:p-8">
            <p className="text-[0.7rem] font-bold tracking-[0.16em] uppercase text-white/60 mb-1">{ROLE_LABEL_MAP[userRole]}</p>
            <h1 className="text-[1.75rem] font-black tracking-[-0.03em]">Welcome back</h1>
            <p className="text-white/60 text-[0.9rem] mt-1">{scopeLabel}</p>
            <div className="flex flex-wrap gap-3 mt-5">
              {quickActions.map(a => (
                <button key={a.nav} onClick={() => onNav(a.nav)}
                  className="h-10 px-5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold cursor-pointer hover:bg-white/20 transition-all">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recent users in scope */}
        <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">
          Recent users {userRole === 'regional_admin' ? 'in your region' : 'in your university'}
        </h2>
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto shadow-[0_16px_44px_rgba(12,12,15,0.06)]">
          <div className="min-w-[500px]">
            <div className="grid grid-cols-[1fr_1fr_90px_100px] gap-2 px-5 py-3 border-b border-[#F1F3F5] text-[0.62rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">
              <span>Name</span><span>Email</span><span className="text-center">Role</span><span className="text-right">Joined</span>
            </div>
            {recentUsers.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No users in scope yet.</div>
            ) : recentUsers.map(u => (
              <div key={u.id} className="grid grid-cols-[1fr_1fr_90px_100px] gap-2 px-5 py-3 border-b last:border-b-0 border-[#F1F3F5] items-center hover:bg-[#FAFAFA] transition-colors">
                <span className="text-[0.84rem] font-semibold text-[#0C0C0F] truncate">{u.full_name}</span>
                <span className="text-[0.78rem] text-[#94A3B8] truncate">{u.email}</span>
                <span className="text-center">
                  <span className={`text-[0.62rem] font-bold uppercase tracking-[0.08em] ${ROLE_COLORS[u.role] || 'text-slate-400'}`}>{ROLE_LABELS[u.role] ?? u.role}</span>
                </span>
                <span className="text-right text-[0.73rem] text-[#94A3B8]">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Super admin full overview ─────────────────────────────────────────────
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
        students:          stats.total_users ? Math.round((stats.total_students / stats.total_users) * 100) : 0,
        professors:        stats.total_users ? Math.round((stats.total_professors / stats.total_users) * 100) : 0,
        university_admins: stats.total_users ? Math.round(((stats.total_university_admins ?? 0) / stats.total_users) * 100) : 0,
        regional_admins:   stats.total_users ? Math.round(((stats.total_regional_admins ?? 0) / stats.total_users) * 100) : 0,
        super_admins:      stats.total_users ? Math.round(((stats.total_super_admins ?? 0) / stats.total_users) * 100) : 0,
      }
    : { students: 0, professors: 0, university_admins: 0, regional_admins: 0, super_admins: 0 }

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
                Manage users, courses, categories, and professor verifications from one control center.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => onNav('prof-verif')} className="h-11 px-5 rounded-xl bg-white text-[#0C0C0F] font-semibold text-[0.9rem] border-none cursor-pointer shadow-md hover:-translate-y-0.5 transition-all">
                Prof. verifications
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
                    <span className={`text-[0.62rem] font-bold uppercase tracking-[0.08em] ${ROLE_COLORS[u.role] || 'text-slate-400'}`}>{ROLE_LABELS[u.role] ?? u.role}</span>
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
              <div style={{ width: `${pcts.university_admins}%`, background: '#3B82F6' }} />
              <div style={{ width: `${pcts.regional_admins}%`, background: '#7C3AED' }} />
              <div style={{ width: `${pcts.super_admins}%`, background: '#10B981' }} />
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Students',          pct: pcts.students,          color: '#0C0C0F' },
                { label: 'Professors',         pct: pcts.professors,        color: '#FF5533' },
                { label: 'Univ. Admins',       pct: pcts.university_admins, color: '#3B82F6' },
                { label: 'Regional Admins',    pct: pcts.regional_admins,   color: '#7C3AED' },
                { label: 'Super Admins',       pct: pcts.super_admins,      color: '#10B981' },
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
              {getNav(userRole).filter(n => n.id !== 'home').map(n => ({ label: n.label, nav: n.id })).map(a => (
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

function UsersPanel({ token, userRole }: { token: string; userRole: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [err, setErr] = useState('')

  // Only show roles that this actor can assign (rank strictly below their own)
  const myRank = ROLE_RANK[userRole as UserRole] ?? 0
  const assignableRoles = ALL_ROLES.filter(r => (ROLE_RANK[r as UserRole] ?? 0) < myRank)

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
        <div className="flex flex-wrap gap-2">
          {(['', ...assignableRoles] as string[]).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                roleFilter === r
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >{r ? (ROLE_LABELS[r] ?? r) : 'All'}</button>
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
                      {assignableRoles.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
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

function CoursesPanel({ token, userRole }: { token: string; userRole: string }) {
  const canDelete = userRole !== 'university_admin'
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
                  <span className="text-xs text-slate-400">{c.sections_count} sections</span>
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
                {canDelete && (confirmDelete === c.id ? (
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
                ))}
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
    setFormName(''); setFormDesc('')
  }

  const startEdit = (cat: CategoryOut) => {
    setEditingId(cat.id)
    setFormName(cat.name)
    setFormDesc(cat.description || '')
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
        })
        setCategories(prev => prev.map(c => c.id === editingId ? updated : c))
      } else {
        const created = await createCategory(token, {
          name: formName.trim(),
          description: formDesc.trim() || undefined,
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
   ORGANIZATION PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function OrgPanel({ token, userRole, userRegionId }: { token: string; userRole: string; userRegionId: string | null }) {
  // super_admin → regions, regional_admin → universities, university_admin → professors
  const [tab, setTab] = useState<'regions' | 'universities' | 'admins' | 'professors' | 'join-requests'>(
    userRole === 'super_admin' ? 'regions' : userRole === 'university_admin' ? 'professors' : 'universities'
  )
  const [regions, setRegions] = useState<RegionOut[]>([])
  const [universities, setUniversities] = useState<UniversityOut[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Region form
  const [showRegionForm, setShowRegionForm] = useState(false)
  const [regionName, setRegionName] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [savingRegion, setSavingRegion] = useState(false)

  // University form
  const [showUniForm, setShowUniForm] = useState(false)
  const [uniName, setUniName] = useState('')
  // regional_admin is locked to their own region; others can pick from dropdown
  const [uniRegionId, setUniRegionId] = useState(userRole === 'regional_admin' ? (userRegionId ?? '') : '')
  const [savingUni, setSavingUni] = useState(false)

  // Admin creation form
  // super_admin can create both types; regional_admin can only create university admins
  const [adminType, setAdminType] = useState<'regional' | 'university'>(
    userRole === 'super_admin' ? 'regional' : 'university'
  )
  const [adminForm, setAdminForm] = useState({ full_name: '', email: '', password: '', region_id: '', university_id: '' })
  const [savingAdmin, setSavingAdmin] = useState(false)
  const [adminSuccess, setAdminSuccess] = useState('')

  // Professor creation form (university_admin)
  const [profForm, setProfForm] = useState({ full_name: '', email: '', password: '' })
  const [savingProf, setSavingProf] = useState(false)
  const [profSuccess, setProfSuccess] = useState('')

  // Join requests (university_admin)
  const [joinRequests, setJoinRequests] = useState<JoinRequestOut[]>([])
  const [reviewingReq, setReviewingReq] = useState<string | null>(null)

  const isSuperAdmin = userRole === 'super_admin'
  const isRegionalAdmin = userRole === 'regional_admin'
  const isUniversityAdmin = userRole === 'university_admin'

  useEffect(() => {
    setLoading(true)
    const loads: Promise<any>[] = [
      listRegions(token).then(setRegions).catch(() => {}),
    ]
    if (isSuperAdmin || isRegionalAdmin) {
      loads.push(listUniversities(token).then(setUniversities).catch(() => {}))
    }
    if (isUniversityAdmin) {
      loads.push(listJoinRequests(token).then(setJoinRequests).catch(() => {}))
    }
    Promise.all(loads).finally(() => setLoading(false))
  }, [token])

  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regionName.trim()) return
    setSavingRegion(true); setErr('')
    try {
      const r = await createRegion(token, { name: regionName.trim(), code: regionCode.trim() || undefined })
      setRegions(prev => [...prev, r])
      setRegionName(''); setRegionCode(''); setShowRegionForm(false)
    } catch (e: any) { setErr(e.message) }
    finally { setSavingRegion(false) }
  }

  const handleDeleteRegion = async (id: string) => {
    setErr('')
    try {
      await deleteRegion(token, id)
      setRegions(prev => prev.filter(r => r.id !== id))
      setConfirmDelete(null)
    } catch (e: any) { setErr(e.message) }
  }

  const handleCreateUni = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uniName.trim() || !uniRegionId) return
    setSavingUni(true); setErr('')
    try {
      const u = await createUniversity(token, { name: uniName.trim(), region_id: uniRegionId })
      setUniversities(prev => [...prev, u])
      setUniName(''); setUniRegionId(''); setShowUniForm(false)
    } catch (e: any) { setErr(e.message) }
    finally { setSavingUni(false) }
  }

  const handleDeleteUni = async (id: string) => {
    setErr('')
    try {
      await deleteUniversity(token, id)
      setUniversities(prev => prev.filter(u => u.id !== id))
      setConfirmDelete(null)
    } catch (e: any) { setErr(e.message) }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAdmin(true); setErr(''); setAdminSuccess('')
    try {
      if (adminType === 'regional') {
        await createRegionalAdmin(token, { ...adminForm, region_id: adminForm.region_id })
      } else {
        await createUniversityAdmin(token, { ...adminForm, university_id: adminForm.university_id })
      }
      setAdminSuccess(`${adminType === 'regional' ? 'Regional' : 'University'} admin created successfully`)
      setAdminForm({ full_name: '', email: '', password: '', region_id: '', university_id: '' })
    } catch (e: any) { setErr(e.message) }
    finally { setSavingAdmin(false) }
  }

  const handleCreateProfessor = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProf(true); setErr(''); setProfSuccess('')
    try {
      // university_id is resolved server-side from the JWT for university_admin
      await createProfessor(token, { ...profForm })
      setProfSuccess('Professor account created successfully')
      setProfForm({ full_name: '', email: '', password: '' })
    } catch (e: any) { setErr(e.message) }
    finally { setSavingProf(false) }
  }

  const handleReviewJoinRequest = async (id: string, action: 'approve' | 'reject') => {
    setReviewingReq(id); setErr('')
    try {
      await reviewJoinRequest(token, id, action)
      setJoinRequests(prev => prev.filter(r => r.id !== id))
    } catch (e: any) { setErr(e.message) }
    finally { setReviewingReq(null) }
  }

  const tabs = [
    { id: 'regions' as const,      label: 'Regions',          show: isSuperAdmin },
    { id: 'universities' as const, label: 'Universities',     show: isSuperAdmin || isRegionalAdmin },
    { id: 'admins' as const,       label: 'Create Admins',    show: isSuperAdmin || isRegionalAdmin },
    { id: 'professors' as const,   label: 'Create Professor', show: isUniversityAdmin },
    { id: 'join-requests' as const, label: `Join Requests${joinRequests.length ? ` (${joinRequests.length})` : ''}`, show: isUniversityAdmin },
  ].filter(t => t.show)

  return (
    <div className="max-w-[860px] animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Organization</h2>
        <p className="text-sm text-slate-500 mt-1">Manage regions, universities, and admin accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setErr('') }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >{t.label}</button>
        ))}
      </div>

      {err && (
        <div className="flex items-center gap-3 p-4 mb-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {err}
        </div>
      )}

      {/* ── Regions Tab ── */}
      {tab === 'regions' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{regions.length} region{regions.length !== 1 ? 's' : ''}</p>
            {!showRegionForm && (
              <button onClick={() => setShowRegionForm(true)}
                className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold border-none cursor-pointer hover:bg-slate-800 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                New region
              </button>
            )}
          </div>

          {showRegionForm && (
            <form onSubmit={handleCreateRegion} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">New region</h3>
              <input value={regionName} onChange={e => setRegionName(e.target.value)} placeholder="Region name *"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              <input value={regionCode} onChange={e => setRegionCode(e.target.value)} placeholder="Region code (optional, e.g. NE)"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowRegionForm(false); setRegionName(''); setRegionCode('') }}
                  className="flex-1 h-9 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none cursor-pointer">Cancel</button>
                <button type="submit" disabled={!regionName.trim() || savingRegion}
                  className="flex-1 h-9 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed border-none cursor-pointer">
                  {savingRegion ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}</div>
          ) : regions.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-900">No regions yet</p>
              <p className="text-xs text-slate-400 mt-1">Create your first region above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {regions.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4 hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.code ? `Code: ${r.code} · ` : ''}{r.university_count} universit{r.university_count !== 1 ? 'ies' : 'y'}</p>
                  </div>
                  {confirmDelete === r.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteRegion(r.id)}
                        className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center border-none cursor-pointer hover:bg-red-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(r.id)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center cursor-pointer hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Universities Tab ── */}
      {tab === 'universities' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{universities.length} universit{universities.length !== 1 ? 'ies' : 'y'}</p>
            {!showUniForm && (
              <button onClick={() => setShowUniForm(true)}
                className="h-9 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold border-none cursor-pointer hover:bg-slate-800 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                New university
              </button>
            )}
          </div>

          {showUniForm && (
            <form onSubmit={handleCreateUni} className="bg-white rounded-2xl border border-slate-200 p-5 mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">New university</h3>
              <input value={uniName} onChange={e => setUniName(e.target.value)} placeholder="University name *"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              {isRegionalAdmin ? (
                <div className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 flex items-center">
                  {regions.find(r => r.id === uniRegionId)?.name ?? 'Your region'}
                </div>
              ) : (
                <select value={uniRegionId} onChange={e => setUniRegionId(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 bg-white">
                  <option value="">Select region *</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowUniForm(false); setUniName(''); setUniRegionId(isRegionalAdmin ? (userRegionId ?? '') : '') }}
                  className="flex-1 h-9 rounded-lg text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border-none cursor-pointer">Cancel</button>
                <button type="submit" disabled={!uniName.trim() || !uniRegionId || savingUni}
                  className="flex-1 h-9 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed border-none cursor-pointer">
                  {savingUni ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl skeleton" />)}</div>
          ) : universities.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-900">No universities yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {universities.map(u => (
                <div key={u.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center gap-4 hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-400">Region: {u.region_name ?? u.region_id}</p>
                  </div>
                  {confirmDelete === u.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteUni(u.id)}
                        className="w-7 h-7 rounded-lg bg-red-500 text-white flex items-center justify-center border-none cursor-pointer hover:bg-red-600">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-200">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(u.id)}
                      className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center cursor-pointer hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Professor Tab (university_admin) ── */}
      {tab === 'professors' && (
        <div className="max-w-[520px]">
          {profSuccess && (
            <div className="flex items-center gap-3 p-4 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {profSuccess}
            </div>
          )}
          <form onSubmit={handleCreateProfessor} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Create Professor Account</h3>
            <p className="text-xs text-slate-500">The professor will be automatically assigned to your university.</p>
            <div className="space-y-3">
              <input value={profForm.full_name} onChange={e => setProfForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Full name *"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              <input value={profForm.email} onChange={e => setProfForm(p => ({ ...p, email: e.target.value }))}
                placeholder="Email address *" type="email"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              <input value={profForm.password} onChange={e => setProfForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Password *" type="password"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
            </div>
            <button type="submit" disabled={savingProf || !profForm.full_name.trim() || !profForm.email.trim() || !profForm.password.trim()}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed border-none cursor-pointer transition-all">
              {savingProf ? 'Creating...' : 'Create professor account'}
            </button>
          </form>
        </div>
      )}

      {/* ── Join Requests Tab (university_admin) ── */}
      {tab === 'join-requests' && (
        <div>
          {joinRequests.length === 0 ? (
            <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-semibold text-slate-900">No pending requests</p>
              <p className="text-xs text-slate-400 mt-1">Professors who request to join your university will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {joinRequests.map(req => (
                <div key={req.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{req.professor_name ?? req.professor_id}</p>
                      {req.note && (
                        <p className="text-xs text-slate-500 mt-0.5 italic">"{req.note}"</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleReviewJoinRequest(req.id, 'approve')}
                        disabled={reviewingReq === req.id}
                        className="h-8 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold border-none cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        {reviewingReq === req.id ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReviewJoinRequest(req.id, 'reject')}
                        disabled={reviewingReq === req.id}
                        className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600 text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Create Admin Tab ── */}
      {tab === 'admins' && (
        <div className="max-w-[520px]">
          {/* Type toggle */}
          {isSuperAdmin && (
            <div className="flex gap-2 mb-5">
              {(['regional', 'university'] as const).map(t => (
                <button key={t} onClick={() => setAdminType(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    adminType === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}>
                  {t === 'regional' ? 'Regional Admin' : 'University Admin'}
                </button>
              ))}
            </div>
          )}

          {adminSuccess && (
            <div className="flex items-center gap-3 p-4 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {adminSuccess}
            </div>
          )}

          <form onSubmit={handleCreateAdmin} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Create {adminType === 'regional' ? 'Regional' : 'University'} Admin
            </h3>
            <div className="space-y-3">
              <input value={adminForm.full_name} onChange={e => setAdminForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Full name *"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              <input value={adminForm.email} onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))}
                placeholder="Email address *" type="email"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />
              <input value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Password *" type="password"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100" />

              {adminType === 'regional' && (
                <select value={adminForm.region_id} onChange={e => setAdminForm(p => ({ ...p, region_id: e.target.value }))}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 bg-white">
                  <option value="">Assign to region *</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}

              {adminType === 'university' && (
                <select value={adminForm.university_id} onChange={e => setAdminForm(p => ({ ...p, university_id: e.target.value }))}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-400 bg-white">
                  <option value="">Assign to university *</option>
                  {universities.map(u => <option key={u.id} value={u.id}>{u.name} ({u.region_name})</option>)}
                </select>
              )}
            </div>

            <button type="submit" disabled={savingAdmin}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed border-none cursor-pointer transition-all">
              {savingAdmin ? 'Creating...' : 'Create admin account'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   PROFESSOR VERIFICATION PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function ProfVerificationPanel({ token }: { token: string }) {
  const [requests, setRequests] = useState<ProfVerificationOut[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    listVerifications(token).then(setRequests).finally(() => setLoading(false))
  }, [token])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id)
    try {
      const updated = await reviewVerification(token, id, action)
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
    } finally { setActionLoading(null) }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-2xl skeleton" />)}
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
        <div className="w-14 h-14 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
          <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-900 mb-1">No verification requests</p>
        <p className="text-sm text-slate-500">Pending requests from independent professors will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map(req => {
        const isPending = req.status === 'pending'
        const statusStyle =
          req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          req.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-amber-50 text-amber-700 border-amber-200'

        return (
          <div key={req.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center text-lg font-bold text-amber-700 border border-amber-100">
                  {(req.professor_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{req.professor_name}</p>
                  <p className="text-sm text-slate-500">Region: {req.region_name || '—'}</p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${statusStyle}`}>
                {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
              </span>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400 mb-0.5">First name</p>
                <p className="font-medium text-slate-800">{req.first_name}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Father's name</p>
                <p className="font-medium text-slate-800">{req.father_name}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Grandfather's name</p>
                <p className="font-medium text-slate-800">{req.grandfather_name}</p>
              </div>
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Date of birth</p>
                <p className="font-medium text-slate-800">{new Date(req.birth_date).toLocaleDateString()}</p>
              </div>
            </div>

            {isPending && (
              <div className="px-5 pb-5 flex gap-3">
                <button
                  onClick={() => handleAction(req.id, 'approve')}
                  disabled={actionLoading === req.id}
                  className="h-9 px-5 rounded-xl bg-emerald-500 text-white text-sm font-semibold border-none cursor-pointer hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionLoading === req.id ? '...' : 'Approve'}
                </button>
                <button
                  onClick={() => handleAction(req.id, 'reject')}
                  disabled={actionLoading === req.id}
                  className="h-9 px-5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-semibold cursor-pointer hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {actionLoading === req.id ? '...' : 'Reject'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   ANNOUNCEMENTS PANEL
   ════════════════════════════════════════════════════════════════════════════ */

function AnnouncementsPanel({ token }: { token: string }) {
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [successCount, setSuccessCount] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    listAnnouncements(token)
      .then(setAnnouncements)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const handlePublish = async () => {
    if (!title.trim() || !body.trim()) return
    setSubmitting(true); setErr(''); setSuccessCount(null)
    try {
      const result = await createAnnouncement(token, title.trim(), body.trim())
      setAnnouncements(prev => [result, ...prev])
      setSuccessCount(result.recipient_count)
      setTitle('')
      setBody('')
    } catch (e: any) { setErr(e.message) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-[700px] animate-fadeIn">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Announcements</h2>
        <p className="text-sm text-slate-500 mt-1">Publish a notice — every member of your university will receive it as a notification</p>
      </div>

      {/* Compose form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
        <p className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#FF5533] mb-4">New Announcement</p>
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm outline-none focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-shadow"
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Write your announcement here…"
            rows={4}
            className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm outline-none focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)] transition-shadow resize-none"
          />
          {err && <p className="text-xs text-red-500">{err}</p>}
          {successCount !== null && (
            <p className="text-xs text-emerald-600 font-medium">
              Sent to {successCount} member{successCount !== 1 ? 's' : ''}
            </p>
          )}
          <button
            onClick={handlePublish}
            disabled={submitting || !title.trim() || !body.trim()}
            className="self-end h-10 px-5 rounded-lg text-sm font-semibold bg-[#0C0C0F] text-white hover:bg-[#1E1E23] disabled:bg-[#D1D5DB] disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Past announcements */}
      <div>
        <p className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-slate-400 mb-3">Past Announcements</p>
        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading…</p>
        ) : announcements.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm font-semibold text-slate-900 mb-1">No announcements yet</p>
            <p className="text-xs text-slate-400">Your published announcements will appear here</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {announcements.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.title}</p>
                    <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{a.body}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-400 whitespace-nowrap mt-0.5">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-3">
                  {a.recipient_count} recipient{a.recipient_count !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN ADMIN DASHBOARD
   ════════════════════════════════════════════════════════════════════════════ */

const ROLE_LABEL_MAP: Record<string, string> = {
  super_admin:      'Super Admin',
  regional_admin:   'Regional Admin',
  university_admin: 'Univ. Admin',
  professor:        'Professor',
  student:          'Student',
}

export default function AdminDashboard() {
  const { token, user } = useAuth()
  const role = user?.role ?? ''
  const nav_items = getNav(role)
  const [nav, setNav] = useState(nav_items[0]?.id ?? 'home')

  const roleLabel = ROLE_LABEL_MAP[role] ?? 'Admin'

  // Guard: redirect nav if the current panel is not allowed for this role
  const allowedIds = nav_items.map(n => n.id)
  const activeNav = allowedIds.includes(nav) ? nav : (nav_items[0]?.id ?? 'home')

  const wrapper = (title: string, subtitle: string, children: React.ReactNode) => (
    <DashboardLayout navItems={nav_items} activeNav={activeNav} onNavChange={setNav} roleLabel={roleLabel}>
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

  if (activeNav === 'home') {
    return (
      <DashboardLayout navItems={nav_items} activeNav={activeNav} onNavChange={setNav} roleLabel={roleLabel}>
        <OverviewPanel
          token={token!}
          userRole={role}
          universityName={user?.university_name ?? null}
          regionName={user?.region_name ?? null}
          onNav={setNav}
        />
      </DashboardLayout>
    )
  }

  if (activeNav === 'org') {
    const orgSubtitle = role === 'university_admin'
      ? 'Create professor accounts for your university.'
      : 'Manage regions, universities, and admin accounts.'
    return wrapper('Organization', orgSubtitle, <OrgPanel token={token!} userRole={role} userRegionId={user?.region_id ?? null} />)
  }

  if (activeNav === 'users') {
    const scopeNote = role === 'regional_admin'
      ? `Users in ${user?.region_name ?? 'your region'}`
      : role === 'university_admin'
        ? `Users in ${user?.university_name ?? 'your university'}`
        : 'Manage all platform users, change roles, or remove accounts.'
    return wrapper('Users', scopeNote, <UsersPanel token={token!} userRole={role} />)
  }

  if (activeNav === 'announcements') {
    return wrapper('Announcements', 'Publish notices to all members of your university.', <AnnouncementsPanel token={token!} />)
  }

  if (activeNav === 'courses' && role !== 'university_admin') {
    return wrapper('Courses', 'View all courses, toggle publish status, or remove them.', <CoursesPanel token={token!} userRole={role} />)
  }

  if (activeNav === 'categories') {
    return wrapper('Categories', 'Create and manage course categories.', <CategoriesPanel token={token!} />)
  }

  if (activeNav === 'prof-verif') {
    return wrapper(
      'Professor Verifications',
      'Review civil identity verification requests from independent professors.',
      <ProfVerificationPanel token={token!} />
    )
  }

  return (
    <DashboardLayout navItems={nav_items} activeNav={activeNav} onNavChange={setNav} roleLabel={roleLabel}>
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-[1.1rem] font-bold text-[#0C0C0F]">{nav_items.find(n => n.id === activeNav)?.label}</h2>
          <p className="text-[0.82rem] text-[#94A3B8] mt-1">Coming soon</p>
        </div>
      </div>
    </DashboardLayout>
  )
}

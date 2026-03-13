import { useState } from 'react'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'

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
const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const NAV: NavItem[] = [
  { id: 'home', label: 'Overview', icon: <HomeIcon /> },
  { id: 'users', label: 'Users', icon: <UsersIcon /> },
  { id: 'courses', label: 'Courses', icon: <BookIcon /> },
  { id: 'settings', label: 'Settings', icon: <GearIcon /> },
]

/* ── Mock data ── */
const STATS = [
  { label: 'Total Users', value: '12,847' },
  { label: 'Active Courses', value: '156' },
  { label: 'New This Week', value: '+342' },
  { label: 'Uptime', value: '99.9%' },
]

const USERS = [
  { name: 'Amine Bencherif', email: 'amine.b@univ-alger.dz', role: 'student', joined: 'Today' },
  { name: 'Dr. Fatima Zohra', email: 'f.zohra@univ-oran.dz', role: 'professor', joined: 'Yesterday' },
  { name: 'Karim Mesbah', email: 'k.mesbah@esi-sba.dz', role: 'student', joined: 'Yesterday' },
  { name: 'Nour Benali', email: 'n.benali@usthb.dz', role: 'student', joined: '2 days ago' },
  { name: 'Prof. Hamidi', email: 'a.hamidi@univ-setif.dz', role: 'professor', joined: '3 days ago' },
]

const ROLES = [
  { label: 'Students', pct: 87, color: '#0C0C0F' },
  { label: 'Professors', pct: 11, color: '#FF5533' },
  { label: 'Admins', pct: 2, color: '#94A3B8' },
]

const LOG = [
  { action: 'New user registered', detail: 'amine.b@univ-alger.dz', time: '2m ago' },
  { action: 'Course published', detail: 'Deep Learning with PyTorch', time: '1h ago' },
  { action: 'User role changed', detail: 'f.zohra → professor', time: '3h ago' },
  { action: 'System backup completed', detail: 'All databases', time: '6h ago' },
]

export default function AdminDashboard() {
  const [nav, setNav] = useState('home')

  if (nav !== 'home') {
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

  return (
    <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Admin">
      <div className="max-w-[1020px] mx-auto px-6 md:px-10 py-8">

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-[1.75rem] font-black tracking-[-0.03em] text-[#0C0C0F]">Platform overview</h1>
          <p className="text-[0.85rem] text-[#94A3B8] mt-1">Hub4Learners administration</p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-10 pb-8 border-b border-[#E5E7EB]">
          {STATS.map((s, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-[1.5rem] font-black text-[#0C0C0F] font-mono tracking-tight">{s.value}</span>
              <span className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">{s.label}</span>
              {i < STATS.length - 1 && <span className="ml-4 w-px h-5 bg-[#E5E7EB] hidden sm:block" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10">
          {/* Users table */}
          <div>
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Recent registrations</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-x-auto">
              <div className="min-w-[500px]">
                <div className="grid grid-cols-[1fr_1fr_72px_72px] gap-2 px-5 py-3 border-b border-[#F1F3F5] text-[0.62rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">
                  <span>Name</span>
                  <span>Email</span>
                  <span className="text-center">Role</span>
                  <span className="text-right">Joined</span>
                </div>
                {USERS.map((u, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_72px_72px] gap-2 px-5 py-3 border-b last:border-b-0 border-[#F1F3F5] items-center cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                  >
                    <span className="text-[0.84rem] font-semibold text-[#0C0C0F] truncate">{u.name}</span>
                    <span className="text-[0.78rem] text-[#94A3B8] truncate">{u.email}</span>
                    <span className="text-center">
                      <span className={`text-[0.62rem] font-bold uppercase tracking-[0.08em] ${
                        u.role === 'professor' ? 'text-[#FF5533]' : u.role === 'admin' ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                      }`}>{u.role}</span>
                    </span>
                    <span className="text-right text-[0.73rem] text-[#94A3B8]">{u.joined}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-8">
            {/* Role distribution */}
            <div>
              <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">User distribution</h2>
              <div className="flex h-2 rounded-full overflow-hidden mb-3">
                {ROLES.map(r => (
                  <div key={r.label} style={{ width: `${r.pct}%`, background: r.color }} />
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {ROLES.map(r => (
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

            {/* Platform log */}
            <div>
              <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Platform log</h2>
              <div className="flex flex-col gap-3">
                {LOG.map((l, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.8rem] font-semibold text-[#0C0C0F]">{l.action}</span>
                      <span className="text-[0.68rem] text-[#94A3B8] shrink-0 ml-2">{l.time}</span>
                    </div>
                    <span className="text-[0.72rem] text-[#94A3B8]">{l.detail}</span>
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

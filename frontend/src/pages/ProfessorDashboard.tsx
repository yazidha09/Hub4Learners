import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout, { type NavItem } from '../components/DashboardLayout'

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

const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'courses', label: 'My Courses', icon: <BookIcon /> },
  { id: 'students', label: 'Students', icon: <UsersIcon /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendIcon /> },
]

/* ── Mock data ── */
const COURSES = [
  { id: 1, name: 'Introduction to Machine Learning', students: 156, pending: 12, status: 'Active' as const },
  { id: 2, name: 'Deep Learning with PyTorch', students: 89, pending: 5, status: 'Active' as const },
  { id: 3, name: 'Neural Networks Fundamentals', students: 203, pending: 23, status: 'Active' as const },
]

const ACTIVITY = [
  { student: 'Amine B.', action: 'submitted Assignment 3 in', course: 'Machine Learning', time: '2m ago' },
  { student: 'Yasmine K.', action: 'asked a question in', course: 'Deep Learning', time: '15m ago' },
  { student: 'Karim M.', action: 'completed Quiz 5 in', course: 'Neural Networks', time: '1h ago' },
  { student: 'Nour D.', action: 'submitted Project 2 in', course: 'Machine Learning', time: '3h ago' },
  { student: 'Sofia T.', action: 'enrolled in', course: 'Deep Learning', time: '5h ago' },
]

export default function ProfessorDashboard() {
  const { user } = useAuth()
  const [nav, setNav] = useState('home')
  const firstName = user?.full_name?.split(' ')[0] || ''

  const totalStudents = COURSES.reduce((s, c) => s + c.students, 0)
  const totalPending = COURSES.reduce((s, c) => s + c.pending, 0)

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

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-[1.75rem] font-black tracking-[-0.03em] text-[#0C0C0F]">{firstName}'s workspace</h1>
            <p className="text-[0.85rem] text-[#94A3B8] mt-1">
              {totalPending > 0 ? (
                <><span className="text-[#FF5533] font-bold">{totalPending} items</span> need your review</>
              ) : (
                <>All caught up</>
              )}
            </p>
          </div>
          <button className="px-4 py-2 bg-[#0C0C0F] text-white text-[0.78rem] font-bold rounded-md border-none cursor-pointer hover:bg-[#1E1E23] transition-colors shrink-0">
            + New Course
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-10 pb-8 border-b border-[#E5E7EB]">
          {[
            { value: String(COURSES.length), label: 'Courses' },
            { value: String(totalStudents), label: 'Students' },
            { value: String(totalPending), label: 'Pending' },
          ].map((s, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-[1.4rem] font-black text-[#0C0C0F] font-mono tracking-tight">{s.value}</span>
              <span className="text-[0.65rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">{s.label}</span>
              {i < 2 && <span className="ml-4 w-px h-5 bg-[#E5E7EB] hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Courses table */}
        <div className="mb-10">
          <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Your courses</h2>
          <div className="bg-white border border-[#E5E7EB] rounded-lg overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-3 border-b border-[#F1F3F5] text-[0.62rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">
                <span>Course</span>
                <span className="text-center">Students</span>
                <span className="text-center">Pending</span>
                <span className="text-center">Status</span>
              </div>
              {COURSES.map(c => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_80px_80px_80px] gap-4 px-5 py-4 border-b last:border-b-0 border-[#F1F3F5] cursor-pointer hover:bg-[#FAFAFA] transition-colors items-center"
                >
                  <span className="text-[0.88rem] font-semibold text-[#0C0C0F] truncate">{c.name}</span>
                  <span className="text-[0.85rem] font-bold text-[#0C0C0F] font-mono text-center">{c.students}</span>
                  <span className={`text-[0.85rem] font-bold font-mono text-center ${c.pending > 0 ? 'text-[#FF5533]' : 'text-[#10B981]'}`}>
                    {c.pending}
                  </span>
                  <span className="text-center">
                    <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-bold text-[#10B981]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                      {c.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity */}
        <div>
          <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Recent activity</h2>
          <div className="flex flex-col">
            {ACTIVITY.map((a, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-3 ${
                  i !== ACTIVITY.length - 1 ? 'border-b border-dashed border-[#E5E7EB]' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-[#F1F3F5] text-[#94A3B8] flex items-center justify-center text-[0.6rem] font-bold uppercase shrink-0 mt-0.5">
                  {a.student.split(' ').map(w => w[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[0.82rem] text-[#0C0C0F] m-0">
                    <span className="font-semibold">{a.student}</span>{' '}
                    {a.action}{' '}
                    <span className="font-semibold">{a.course}</span>
                  </p>
                </div>
                <span className="text-[0.7rem] text-[#94A3B8] shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

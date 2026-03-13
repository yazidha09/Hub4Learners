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
const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)
const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)

const NAV: NavItem[] = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'courses', label: 'My Courses', icon: <BookIcon /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarIcon /> },
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

export default function StudentDashboard() {
  const { user } = useAuth()
  const [nav, setNav] = useState('home')
  const firstName = user?.full_name?.split(' ')[0] || ''

  const resumeCourse = COURSES.reduce(
    (best, c) => (c.progress > 0 && c.progress < 100 && c.progress > (best?.progress ?? 0) ? c : best),
    null as (typeof COURSES)[0] | null,
  )

  if (nav !== 'home') {
    return (
      <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
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
    <DashboardLayout navItems={NAV} activeNav={nav} onNavChange={setNav} roleLabel="Student">
      <div className="max-w-[960px] mx-auto px-6 md:px-10 py-8">

        {/* Greeting */}
        <div className="mb-10">
          <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#FF5533] mb-1">{getGreeting()}</p>
          <h1 className="text-[1.75rem] font-black tracking-[-0.03em] text-[#0C0C0F]">{firstName}</h1>
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-10 pb-8 border-b border-[#E5E7EB]">
          {[
            { value: String(COURSES.length), label: 'Enrolled' },
            { value: '54h', label: 'Study time' },
            { value: '7', label: 'Day streak' },
          ].map((s, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className="text-[1.4rem] font-black text-[#0C0C0F] font-mono tracking-tight">{s.value}</span>
              <span className="text-[0.65rem] font-bold tracking-[0.1em] uppercase text-[#94A3B8]">{s.label}</span>
              {i < 2 && <span className="ml-4 w-px h-5 bg-[#E5E7EB] hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Continue learning */}
        {resumeCourse && (
          <div className="mb-10">
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Pick up where you left off</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-lg p-5">
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
            <div className="flex flex-col">
              {COURSES.map((c, i) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-4 py-4 cursor-pointer rounded-lg transition-all ${
                    i !== COURSES.length - 1 ? 'border-b border-dashed border-[#E5E7EB]' : ''
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.88rem] font-semibold text-[#0C0C0F] truncate group-hover:text-[#FF5533] transition-colors">{c.name}</div>
                    <div className="text-[0.73rem] text-[#94A3B8]">{c.instructor}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-14 h-[3px] bg-[#F1F3F5] rounded-full overflow-hidden hidden sm:block">
                      <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: c.color }} />
                    </div>
                    <span className="text-[0.78rem] font-bold text-[#0C0C0F] font-mono w-9 text-right">{c.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Deadlines */}
          <div>
            <h2 className="text-[0.68rem] font-bold tracking-[0.12em] uppercase text-[#94A3B8] mb-4">Upcoming</h2>
            <div className="flex flex-col gap-3">
              {DEADLINES.map((d, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1.5">
                    <span className={`w-2 h-2 rounded-full ${d.urgent ? 'bg-[#FF5533]' : 'bg-[#D1D5DB]'}`} />
                    {i < DEADLINES.length - 1 && <div className="w-px h-8 bg-[#E5E7EB] mt-1" />}
                  </div>
                  <div>
                    <div className="text-[0.82rem] font-semibold text-[#0C0C0F]">{d.task}</div>
                    <div className="text-[0.7rem] text-[#94A3B8]">{d.course} &middot; {d.due}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

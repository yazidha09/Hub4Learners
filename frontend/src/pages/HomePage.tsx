import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, type CategoryOut } from '../api/category'

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)
const FileIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
)
const GlobeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
)
const TagIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
)
const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)
const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
const SparkleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    <path d="M7.8 7.8l2.8 2.8-2.8 2.8M16.2 7.8l-2.8 2.8 2.8 2.8" />
  </svg>
)

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const [categories, setCategories] = useState<CategoryOut[]>([])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    listCategories().then(setCategories).catch(() => {})
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const features = [
    {
      icon: <PlayIcon />,
      title: 'Rich learning formats',
      desc: 'Videos, PDFs, exercises, and live sessions — all in one place.',
    },
    {
      icon: <ShieldIcon />,
      title: 'Verified instructors',
      desc: 'Professor upgrades are reviewed to keep quality high.',
    },
    {
      icon: <GlobeIcon />,
      title: 'Built for every domain',
      desc: 'Tech, science, business, design, languages, and more.',
    },
    {
      icon: <TagIcon />,
      title: 'Free & premium options',
      desc: 'Choose free courses or support instructors with paid content.',
    },
  ]

  const steps = [
    { step: '01', title: 'Create your account', desc: 'Sign up as a student or professor — it takes seconds.' },
    { step: '02', title: 'Browse or publish', desc: 'Enroll in courses or upload your own materials instantly.' },
    { step: '03', title: 'Learn together', desc: 'Progress, ask questions, and collaborate with your instructors.' },
  ]

  const stats = [
    { value: '12k+', label: 'Students' },
    { value: '100+', label: 'Courses' },
    { value: '30+', label: 'Subjects' },
    { value: '4.9', label: 'Avg. rating' },
  ]

  return (
    <div className="min-h-screen bg-[#0b0e16] text-white relative overflow-hidden">
      <div className="page-gradient absolute inset-0 opacity-95" aria-hidden />

      {/* ─── Navbar ─── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/90 backdrop-blur-md border-b border-[#E5E7EB] shadow-[0_12px_32px_rgba(15,23,42,0.08)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="w-2 h-2 rounded-full bg-[#FF5533] shrink-0" />
            <span className={`text-[0.82rem] font-bold tracking-[0.08em] uppercase transition-colors duration-300 ${scrolled ? 'text-[#0C0C0F]' : 'text-white/80'}`}>
              Hub4Learners
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className={`text-[0.85rem] font-semibold no-underline transition-colors duration-300 ${scrolled ? 'text-[#64748B] hover:text-[#0C0C0F]' : 'text-white/70 hover:text-white'}`}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-[0.85rem] font-bold no-underline px-4 py-2.5 bg-[#FF5533] text-white rounded-lg hover:bg-[#e5482b] transition-colors shadow-[0_10px_30px_rgba(255,85,51,0.35)]"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* ─── Hero ─── */}
        <section className="pt-24 pb-20 md:pt-28 md:pb-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="grid gap-12 lg:gap-16 md:grid-cols-[1.05fr_0.95fr] items-center">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[0.76rem] font-semibold bg-white/10 text-white/80 border border-white/10 backdrop-blur">
                  <SparkleIcon />
                  The open learning platform
                </span>

                <h1 className="text-[clamp(2.5rem,5vw,3.9rem)] font-black leading-[1.05] tracking-[-0.04em]">
                  A calm, professional home for learning — not an AI template.
                </h1>

                <p className="text-[1.02rem] text-white/75 leading-[1.7] max-w-[640px]">
                  Hub4Learners connects students and professors in one focused space. Browse polished courses, read PDFs,
                  join live sessions, and publish your own material without the noise.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF5533] text-white text-[0.95rem] font-bold rounded-lg no-underline hover:bg-[#e5482b] transition-all shadow-[0_16px_40px_rgba(255,85,51,0.35)] hover:-translate-y-[2px]"
                  >
                    Start learning <ArrowIcon />
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 border border-white/15 text-white/80 text-[0.95rem] font-bold rounded-lg no-underline hover:border-white/50 hover:text-white transition-all backdrop-blur"
                  >
                    I want to teach
                  </Link>
                  <div className="flex items-center gap-3 text-white/60 text-[0.9rem]">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span>Human-led, verified instructors</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                  {stats.map(s => (
                    <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur">
                      <p className="text-[1.3rem] font-black">{s.value}</p>
                      <p className="text-[0.76rem] uppercase tracking-[0.12em] text-white/50">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="card-dark p-5 shadow-[0_30px_80px_rgba(9,12,20,0.45)]">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[0.78rem] text-white/60 uppercase tracking-[0.12em]">Upcoming live</p>
                      <p className="text-[1.2rem] font-bold text-white">Designing better study flows</p>
                      <p className="text-[0.9rem] text-white/60">with Dr. Amira Khelif · UX</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-white/10 text-[0.75rem] font-semibold text-white/80 border border-white/10">Today · 6PM</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Video lessons', value: '34' },
                      { label: 'Resources', value: '18' },
                      { label: 'Community', value: '1.2k' },
                    ].map(item => (
                      <div key={item.label} className="rounded-lg bg-white/5 border border-white/5 px-3 py-2.5">
                        <p className="text-[1.05rem] font-black">{item.value}</p>
                        <p className="text-[0.74rem] text-white/60 uppercase tracking-[0.1em]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between bg-white/5 rounded-lg border border-white/10 px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-[#FF5533]/20 border border-[#FF5533]/40 text-white flex items-center justify-center font-bold">UX</span>
                      <div>
                        <p className="text-[0.95rem] font-semibold">UI Motion Systems</p>
                        <p className="text-[0.78rem] text-white/60">New drop · Starts now</p>
                      </div>
                    </div>
                    <ArrowIcon />
                  </div>
                </div>

                <div className="card-soft text-[#0C0C0F] p-4">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#0C0C0F] text-white flex items-center justify-center">
                      <SparkleIcon />
                    </span>
                    <div>
                      <p className="text-[0.9rem] font-semibold mb-1">Built for real teams</p>
                      <p className="text-[0.82rem] text-[#64748B] m-0">Share syllabi, track progress, and keep students in sync.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="px-3 py-1.5 rounded-full bg-[#F8FAFC] text-[0.78rem] font-bold text-[#0C0C0F] border border-[#E5E7EB]">Universities</span>
                    <span className="px-3 py-1.5 rounded-full bg-[#F8FAFC] text-[0.78rem] font-bold text-[#0C0C0F] border border-[#E5E7EB]">Bootcamps</span>
                    <span className="px-3 py-1.5 rounded-full bg-[#F8FAFC] text-[0.78rem] font-bold text-[#0C0C0F] border border-[#E5E7EB]">Clubs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── What we offer ─── */}
        <section className="bg-white text-[#0C0C0F] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
              <div>
                <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-3">What you get</p>
                <h2 className="text-[clamp(1.7rem,3vw,2.5rem)] font-black tracking-[-0.03em] leading-[1.1] max-w-[520px]">
                  Everything you need to teach or learn — in one calm interface.
                </h2>
              </div>
              <p className="text-[0.95rem] text-[#64748B] max-w-[420px]">
                No clutter, no noise. Just structured courses, clean resource delivery, and a clear path forward.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f, i) => (
                <div key={i} className="card-soft h-full p-5 flex flex-col">
                  <div className="w-11 h-11 rounded-xl bg-[#0C0C0F] text-white flex items-center justify-center mb-4 shadow-[0_10px_25px_rgba(12,12,15,0.2)]">
                    {f.icon}
                  </div>
                  <h3 className="text-[1rem] font-bold mb-2">{f.title}</h3>
                  <p className="text-[0.9rem] text-[#64748B] leading-[1.6] flex-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Browse by Category ─── */}
        {categories.length > 0 && (
          <section className="bg-[#F6F8FB] text-[#0C0C0F] py-16 md:py-24">
            <div className="max-w-6xl mx-auto px-6 md:px-10">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
                <div>
                  <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-3">Browse by category</p>
                  <h2 className="text-[clamp(1.7rem,3vw,2.5rem)] font-black tracking-[-0.03em] leading-[1.1] max-w-[520px]">
                    Find exactly what you want to learn.
                  </h2>
                </div>
                <p className="text-[0.95rem] text-[#64748B] max-w-[420px]">
                  Courses are organized into clear categories so you can jump straight to your field of interest.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    to="/register"
                    className="card-soft p-5 flex flex-col items-center text-center no-underline text-[#0C0C0F] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.1)] transition-all duration-300"
                  >
                    <h3 className="text-[0.9rem] font-bold mb-1">{cat.name}</h3>
                    <p className="text-[0.78rem] text-[#64748B]">{cat.course_count} course{cat.course_count !== 1 ? 's' : ''}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ─── How it works ─── */}
        <section className="bg-white text-[#0C0C0F] py-16 md:py-24">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
              <div>
                <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-3">How it works</p>
                <h2 className="text-[clamp(1.6rem,2.8vw,2.2rem)] font-black tracking-[-0.03em] leading-[1.12]">Three steps to launch.</h2>
              </div>
              <p className="text-[0.94rem] text-[#64748B] max-w-[420px]">
                Launch a course or enroll as a student in minutes. The workflow is simple, guided, and distraction-free.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {steps.map((s, i) => (
                <div key={s.step} className="card-soft p-5 h-full flex flex-col">
                  <span className="text-[0.78rem] font-black text-[#FF5533] uppercase tracking-[0.16em]">{s.step}</span>
                  <h3 className="text-[1.05rem] font-bold mt-2 mb-2">{s.title}</h3>
                  <p className="text-[0.92rem] text-[#64748B] leading-[1.6] flex-1">{s.desc}</p>
                  {i < 2 && <div className="mt-4 h-[1px] w-14 bg-[#E5E7EB]" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── For professors ─── */}
        <section className="bg-gradient-to-br from-[#0b1224] via-[#0b0f1c] to-[#0b0e16] text-white py-16 md:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,85,51,0.15),transparent_30%)]" aria-hidden />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.16),transparent_28%)]" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-6 md:px-10">
            <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
              <div className="space-y-5">
                <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FFB199]">For professors</p>
                <h2 className="text-[clamp(1.7rem,3vw,2.5rem)] font-black leading-[1.1]">
                  Publish polished courses, manage pricing, and grow your classroom.
                </h2>
                <p className="text-[0.98rem] text-white/70 leading-[1.7] max-w-[560px]">
                  Upload videos and PDFs, control availability, and track engagement — with transparent upgrade reviews to keep your profile trusted.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    'Unlimited courses in any subject',
                    'Upload videos, PDFs, and exercises',
                    'Flexible pricing or free access',
                    'Engagement and progress tracking',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#FF5533]" />
                      <span className="text-[0.9rem] text-white/80">{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF5533] text-white text-[0.95rem] font-bold rounded-lg no-underline hover:bg-[#e5482b] transition-all shadow-[0_16px_40px_rgba(255,85,51,0.32)] hover:-translate-y-[2px]"
                >
                  Start teaching <ArrowIcon />
                </Link>
              </div>

              <div className="card-soft text-[#0C0C0F] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[0.78rem] font-semibold text-[#64748B] uppercase tracking-[0.12em]">Instructor panel</p>
                    <p className="text-[1.1rem] font-bold text-[#0C0C0F]">Course performance</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#EEF2FF] text-[#4338CA] text-[0.8rem] font-bold border border-[#E0E7FF]">Live</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Published', value: '12 courses', tone: 'text-[#0C0C0F]' },
                    { label: 'Avg. rating', value: '4.9 / 5', tone: 'text-[#16A34A]' },
                    { label: 'New enrollments', value: '+184 this month', tone: 'text-[#FF5533]' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-4 py-3">
                      <div>
                        <p className="text-[0.86rem] font-semibold text-[#0F172A]">{item.label}</p>
                        <p className={`text-[0.82rem] text-[#64748B]`}>Updated just now</p>
                      </div>
                      <p className={`text-[1rem] font-black ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-[#0C0C0F] text-white p-4 flex items-center justify-between shadow-[0_12px_30px_rgba(12,12,15,0.4)]">
                  <div>
                    <p className="text-[0.92rem] font-semibold">Upgrade requests stay reviewed</p>
                    <p className="text-[0.82rem] text-white/70">We verify professor profiles to keep quality high.</p>
                  </div>
                  <TagIcon />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA banner ─── */}
        <section className="bg-white text-[#0C0C0F] py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="card-soft flex flex-col md:flex-row items-center justify-between gap-6 p-8 md:p-10">
              <div>
                <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-[-0.03em] leading-[1.1] mb-2">
                  Ready to join the classroom you deserve?
                </h2>
                <p className="text-[0.98rem] text-[#64748B] max-w-[520px]">
                  Create a free account or sign in — courses, resources, and real instructors are waiting.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#0C0C0F] text-white text-[0.92rem] font-bold rounded-lg no-underline hover:bg-[#1E1E23] transition-all shadow-[0_12px_30px_rgba(12,12,15,0.25)]"
                >
                  Create free account <ArrowIcon />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-3 border border-[#E5E7EB] text-[#0F172A] text-[0.92rem] font-bold rounded-lg no-underline hover:border-[#0C0C0F] hover:text-[#0C0C0F] transition-all"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Footer ─── */}
        <footer className="bg-[#0b0e16] text-white/70 border-t border-white/10 py-8">
          <div className="max-w-6xl mx-auto px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] shrink-0" />
              <span className="text-[0.78rem] font-bold tracking-[0.08em] uppercase">Hub4Learners</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/login" className="text-[0.82rem] text-white/60 no-underline hover:text-white">Sign in</Link>
              <Link to="/register" className="text-[0.82rem] text-white/60 no-underline hover:text-white">Register</Link>
            </div>
            <span className="text-[0.78rem] text-white/40">&copy; {new Date().getFullYear()} H4L</span>
          </div>
        </footer>
      </main>
    </div>
  )
}

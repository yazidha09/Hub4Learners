import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

/* ── Inline Icons ── */
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

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#0C0C0F]">

      {/* ─── Navbar ─── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-[1120px] mx-auto px-6 md:px-10 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="w-2 h-2 rounded-full bg-[#FF5533] shrink-0" />
            <span className={`text-[0.78rem] font-bold tracking-[0.08em] uppercase transition-colors duration-300 ${scrolled ? 'text-[#0C0C0F]' : 'text-white/70'}`}>
              Hub4Learners
            </span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              to="/login"
              className={`text-[0.82rem] font-semibold no-underline transition-colors duration-300 ${scrolled ? 'text-[#94A3B8] hover:text-[#0C0C0F]' : 'text-white/50 hover:text-white'}`}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-[0.82rem] font-bold no-underline px-4 py-2 bg-[#FF5533] text-white rounded-md hover:bg-[#e04a2b] transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
        {/* Ghost H4L */}
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[48%] text-[18rem] md:text-[28rem] font-black tracking-[-0.06em] select-none pointer-events-none whitespace-nowrap"
          style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.03)' } as React.CSSProperties}
        >
          H4L
        </span>

        <div className="relative z-10 max-w-[1120px] mx-auto px-6 md:px-10 pt-28 pb-20">
          <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-4">
            The open learning platform
          </p>

          <h1 className="text-[clamp(2.4rem,5.5vw,4.2rem)] font-black leading-[1.06] tracking-[-0.035em] text-white mb-6 max-w-[700px]">
            Learn anything.<br />
            Teach <em className="not-italic text-[#FF5533]">everything.</em>
          </h1>

          <p className="text-[1rem] md:text-[1.1rem] text-white/40 leading-[1.7] max-w-[520px] mb-10">
            A place where students and professors connect. Browse free and paid courses — videos, PDFs,
            live sessions — across every subject and every domain.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-16">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF5533] text-white text-[0.88rem] font-bold rounded-md no-underline hover:bg-[#e04a2b] hover:-translate-y-px transition-all"
            >
              Start learning <ArrowIcon />
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 border-[1.5px] border-white/15 text-white/60 text-[0.88rem] font-bold rounded-md no-underline hover:border-white/40 hover:text-white transition-all"
            >
              I'm a professor
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-6 md:gap-10">
            {[
              { value: '12k+', label: 'Students' },
              { value: '100+', label: 'Courses' },
              { value: '30+', label: 'Subjects' },
              { value: '4.9', label: 'Rating' },
            ].map((s, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="text-[1.5rem] font-black text-white font-mono tracking-tight">{s.value}</span>
                <span className="text-[0.62rem] font-bold tracking-[0.1em] uppercase text-white/30">{s.label}</span>
                {i < 3 && <span className="ml-4 md:ml-6 w-px h-5 bg-white/10 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── What we offer ─── */}
      <section className="bg-white py-20 md:py-28">
        <div className="max-w-[1120px] mx-auto px-6 md:px-10">
          <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-3">What we offer</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-[-0.03em] text-[#0C0C0F] mb-4 max-w-[500px] leading-[1.12]">
            Everything you need to learn or teach
          </h2>
          <p className="text-[0.9rem] text-[#94A3B8] mb-14 max-w-[440px] leading-[1.65]">
            No limits on format, subject, or price. We built the platform to be as flexible as the knowledge shared on it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {[
              {
                icon: <PlayIcon />,
                title: 'Video courses',
                desc: 'Watch full lectures, tutorials, and walkthroughs at your own pace.',
              },
              {
                icon: <FileIcon />,
                title: 'PDFs & documents',
                desc: 'Download notes, guides, and study material. Read anywhere, anytime.',
              },
              {
                icon: <GlobeIcon />,
                title: 'Every domain',
                desc: 'Tech, science, business, arts, languages — whatever you want to learn.',
              },
              {
                icon: <TagIcon />,
                title: 'Free & paid',
                desc: 'Access free content or enroll in premium courses. Professors choose their price.',
              },
            ].map((f, i) => (
              <div key={i} className="flex flex-col">
                <div className="w-10 h-10 rounded-lg bg-[#0C0C0F] text-white flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="text-[0.95rem] font-bold text-[#0C0C0F] mb-2">{f.title}</h3>
                <p className="text-[0.82rem] text-[#94A3B8] leading-[1.6] m-0">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="bg-[#FAFAFA] py-20 md:py-28">
        <div className="max-w-[1120px] mx-auto px-6 md:px-10">
          <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-3">How it works</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-[-0.03em] text-[#0C0C0F] mb-14 leading-[1.12]">
            Three steps to get started
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                step: '01',
                title: 'Create your account',
                desc: 'Sign up as a student or professor. It takes less than a minute.',
              },
              {
                step: '02',
                title: 'Browse or publish',
                desc: 'Students explore courses across every domain. Professors upload content and set prices.',
              },
              {
                step: '03',
                title: 'Learn & interact',
                desc: 'Watch videos, read PDFs, ask questions, and connect directly with your instructors.',
              },
            ].map((s, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-[2.2rem] font-black font-mono text-[#0C0C0F]/[0.07] tracking-tight mb-3">{s.step}</span>
                <h3 className="text-[1rem] font-bold text-[#0C0C0F] mb-2">{s.title}</h3>
                <p className="text-[0.84rem] text-[#94A3B8] leading-[1.6] m-0">{s.desc}</p>
                {i < 2 && <div className="hidden md:block w-full h-px border-b border-dashed border-[#D1D5DB] mt-8" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── For professors ─── */}
      <section className="bg-[#0C0C0F] py-20 md:py-28 relative overflow-hidden">
        <span
          aria-hidden
          className="absolute top-1/2 right-0 translate-x-1/3 -translate-y-1/2 text-[14rem] md:text-[20rem] font-black tracking-[-0.06em] select-none pointer-events-none"
          style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.025)' } as React.CSSProperties}
        >
          TEACH
        </span>

        <div className="relative z-10 max-w-[1120px] mx-auto px-6 md:px-10">
          <div className="max-w-[560px]">
            <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-3">For professors</p>
            <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-black tracking-[-0.03em] text-white mb-6 leading-[1.12]">
              Share your knowledge with thousands
            </h2>
            <p className="text-[0.92rem] text-white/40 leading-[1.7] mb-8">
              Publish your courses, upload videos and PDFs, set your price — or make them free. Track student progress,
              answer questions, and build a real following around your expertise.
            </p>

            <div className="flex flex-col gap-4 mb-10">
              {[
                'Publish unlimited courses in any subject',
                'Upload videos, PDFs, and supplementary materials',
                'Set your own pricing — free or premium',
                'Track student engagement and progress',
                'Interact directly with your students',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] shrink-0" />
                  <span className="text-[0.84rem] text-white/60">{item}</span>
                </div>
              ))}
            </div>

            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF5533] text-white text-[0.88rem] font-bold rounded-md no-underline hover:bg-[#e04a2b] hover:-translate-y-px transition-all"
            >
              Start teaching <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── CTA banner ─── */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1120px] mx-auto px-6 md:px-10 text-center">
          <h2 className="text-[clamp(1.6rem,3.5vw,2.6rem)] font-black tracking-[-0.03em] text-[#0C0C0F] mb-4 leading-[1.12]">
            Ready to start?
          </h2>
          <p className="text-[0.92rem] text-[#94A3B8] mb-8 max-w-[400px] mx-auto leading-[1.65]">
            Join Hub4Learners today — whether you're here to learn or to teach.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0C0C0F] text-white text-[0.88rem] font-bold rounded-md no-underline hover:bg-[#1E1E23] hover:-translate-y-px transition-all"
            >
              Create free account <ArrowIcon />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 border-[1.5px] border-[#E5E7EB] text-[#94A3B8] text-[0.88rem] font-bold rounded-md no-underline hover:border-[#0C0C0F] hover:text-[#0C0C0F] transition-all"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[#0C0C0F] border-t border-white/[0.06] py-8">
        <div className="max-w-[1120px] mx-auto px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533] shrink-0" />
            <span className="text-[0.7rem] font-bold text-white/40 tracking-[0.08em] uppercase">Hub4Learners</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-[0.78rem] text-white/30 no-underline hover:text-white/60 transition-colors">Sign in</Link>
            <Link to="/register" className="text-[0.78rem] text-white/30 no-underline hover:text-white/60 transition-colors">Register</Link>
          </div>
          <span className="text-[0.7rem] text-white/20">&copy; {new Date().getFullYear()} H4L</span>
        </div>
      </footer>
    </div>
  )
}

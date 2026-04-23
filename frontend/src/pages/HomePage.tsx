import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listCategories, type CategoryOut } from '../api/category'

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const features = [
  {
    label: 'Videos & PDFs',
    desc: 'Rich course materials in one place.',
  },
  {
    label: 'Verified instructors',
    desc: 'Every professor profile is reviewed.',
  },
  {
    label: 'All domains',
    desc: 'Tech, science, business, design & more.',
  },
  {
    label: 'Free & paid',
    desc: 'Flexible pricing for every learner.',
  },
]

const steps = [
  { n: '01', title: 'Create your account', desc: 'Sign up in seconds.' },
  { n: '02', title: 'Browse or publish', desc: 'Enroll or upload your materials.' },
  { n: '03', title: 'Learn & grow', desc: 'Progress at your own pace.' },
]

const stats = [
  { v: '12k+', l: 'Students' },
  { v: '100+', l: 'Courses' },
  { v: '30+', l: 'Subjects' },
  { v: '4.9', l: 'Avg. rating' },
]

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const [categories, setCategories] = useState<CategoryOut[]>([])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    listCategories().then(setCategories).catch(() => {})
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#0C0C0F] text-white">

      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] shadow-sm'
          : 'bg-transparent'
      }`}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />
            <span className={`text-[0.8rem] font-black tracking-[0.1em] uppercase transition-colors duration-300 ${scrolled ? 'text-[#0C0C0F]' : 'text-white'}`}>
              Hub4Learners
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className={`text-[0.85rem] font-semibold no-underline transition-colors ${scrolled ? 'text-[#64748B] hover:text-[#0C0C0F]' : 'text-white/70 hover:text-white'}`}>
              Sign in
            </Link>
            <Link to="/register" className="text-[0.85rem] font-bold no-underline px-4 py-2 bg-[#FF5533] text-white rounded-lg hover:bg-[#e5482b] transition-colors">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col justify-center pt-14">
        <div className="max-w-5xl mx-auto px-6 py-24 md:py-32 w-full">
          <div className="max-w-2xl">
            <p className="text-[0.75rem] font-bold tracking-[0.16em] uppercase text-[#FF5533] mb-6">
              Open learning platform
            </p>
            <h1 className="text-[clamp(2.6rem,6vw,4.2rem)] font-black leading-[1.04] tracking-[-0.04em] mb-6">
              Learn from real<br />instructors.
            </h1>
            <p className="text-[1rem] text-white/60 leading-[1.75] mb-10 max-w-[480px]">
              Hub4Learners connects students and professors in one focused space — no noise, just structured courses and clear progress.
            </p>
            <div className="flex items-center gap-3 flex-wrap mb-16">
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF5533] text-white text-[0.9rem] font-bold rounded-lg no-underline hover:bg-[#e5482b] transition-all">
                Start learning <ArrowRight />
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 border border-white/15 text-white/75 text-[0.9rem] font-bold rounded-lg no-underline hover:border-white/40 hover:text-white transition-all">
                Become an instructor
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 flex-wrap">
              {stats.map(s => (
                <div key={s.l}>
                  <p className="text-[1.4rem] font-black leading-none">{s.v}</p>
                  <p className="text-[0.72rem] uppercase tracking-[0.12em] text-white/40 mt-1">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center pb-10">
          <div className="flex flex-col items-center gap-1 opacity-30">
            <div className="w-[1px] h-8 bg-white/60" />
            <div className="w-[1px] h-4 bg-white/30" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white text-[#0C0C0F] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-14">
            <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-4">What you get</p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-black tracking-[-0.03em] leading-[1.1]">
              Everything in one place.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-5">
                <div className="w-8 h-8 rounded-lg bg-[#0C0C0F] flex items-center justify-center mb-4">
                  <CheckIcon />
                </div>
                <h3 className="text-[0.95rem] font-bold mb-1.5">{f.label}</h3>
                <p className="text-[0.82rem] text-[#64748B] leading-[1.55]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="bg-[#F1F3F5] text-[#0C0C0F] py-20 md:py-28">
          <div className="max-w-5xl mx-auto px-6">
            <div className="mb-12">
              <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-4">Browse</p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-black tracking-[-0.03em] leading-[1.1]">
                Pick your subject.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {categories.map(cat => (
                <Link
                  key={cat.id}
                  to="/register"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-[0.88rem] font-semibold text-[#0C0C0F] no-underline hover:border-[#0C0C0F] hover:shadow-sm transition-all"
                >
                  {cat.name}
                  <span className="text-[0.75rem] text-[#94A3B8]">{cat.course_count}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-white text-[#0C0C0F] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-14">
            <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-4">How it works</p>
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-black tracking-[-0.03em] leading-[1.1]">
              Up and running in minutes.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E5E7EB] rounded-xl overflow-hidden border border-[#E5E7EB]">
            {steps.map(s => (
              <div key={s.n} className="bg-white p-7">
                <p className="text-[0.72rem] font-black text-[#FF5533] tracking-[0.16em] mb-4">{s.n}</p>
                <h3 className="text-[1rem] font-bold mb-2">{s.title}</h3>
                <p className="text-[0.88rem] text-[#64748B] leading-[1.6]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For professors — dark */}
      <section className="bg-[#0C0C0F] text-white py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-[0.72rem] font-bold tracking-[0.14em] uppercase text-[#FF5533] mb-5">For professors</p>
              <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-black tracking-[-0.03em] leading-[1.1] mb-5">
                Publish courses.<br />Grow your class.
              </h2>
              <p className="text-[0.95rem] text-white/55 leading-[1.75] mb-8 max-w-[420px]">
                Upload videos and PDFs, set your own pricing, and reach students directly — all in a clean, distraction-free dashboard.
              </p>
              <Link to="/register" className="inline-flex items-center gap-2 px-5 py-3 bg-[#FF5533] text-white text-[0.9rem] font-bold rounded-lg no-underline hover:bg-[#e5482b] transition-all">
                Start teaching <ArrowRight />
              </Link>
            </div>

            <div className="space-y-3">
              {[
                'Unlimited courses in any subject',
                'Upload videos, PDFs, and exercises',
                'Flexible pricing or free access',
                'Verified professor badge',
              ].map(item => (
                <div key={item} className="flex items-center gap-3 border border-white/10 rounded-xl px-5 py-4">
                  <span className="w-5 h-5 rounded-full bg-[#FF5533]/15 border border-[#FF5533]/30 flex items-center justify-center flex-shrink-0 text-[#FF5533]">
                    <CheckIcon />
                  </span>
                  <span className="text-[0.9rem] text-white/75">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white text-[#0C0C0F] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-black tracking-[-0.04em] leading-[1.08] mb-5">
            Ready to start?
          </h2>
          <p className="text-[0.98rem] text-[#64748B] mb-10 max-w-[400px] mx-auto">
            Create a free account and join thousands of students and instructors today.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-[#0C0C0F] text-white text-[0.9rem] font-bold rounded-lg no-underline hover:bg-[#1E1E23] transition-all">
              Create free account <ArrowRight />
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 border border-[#E5E7EB] text-[#0C0C0F] text-[0.9rem] font-bold rounded-lg no-underline hover:border-[#0C0C0F] transition-all">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0C0C0F] border-t border-white/10 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5533]" />
            <span className="text-[0.78rem] font-black tracking-[0.1em] uppercase text-white">Hub4Learners</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-[0.8rem] text-white/40 no-underline hover:text-white/80 transition-colors">Sign in</Link>
            <Link to="/register" className="text-[0.8rem] text-white/40 no-underline hover:text-white/80 transition-colors">Register</Link>
          </div>
          <span className="text-[0.76rem] text-white/25">&copy; {new Date().getFullYear()} H4L</span>
        </div>
      </footer>
    </div>
  )
}

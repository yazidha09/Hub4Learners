import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { getPublicStats, formatCount, type PublicStats } from '../api/public'

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.6-6.6C35.4 2.5 30.1 0 24 0 14.7 0 6.7 5.4 2.8 13.3l7.7 6C12.3 13.2 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 6.9-10.1 7.1-17z"/>
    <path fill="#FBBC05" d="M10.5 28.7A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.7-4.7l-7.7-6A23.9 23.9 0 0 0 0 24c0 3.9.9 7.6 2.5 10.8l8-6.1z"/>
    <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.4 2.2-6.3 0-11.7-3.7-13.5-9l-8 6.1C6.7 42.6 14.7 48 24 48z"/>
  </svg>
)

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [liveStats, setLiveStats] = useState<PublicStats | null>(null)
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    getPublicStats().then(setLiveStats).catch(() => {})
  }, [])

  const stats = [
    { label: 'Students', value: liveStats ? formatCount(liveStats.students) : '—' },
    { label: 'Courses', value: liveStats ? formatCount(liveStats.courses) : '—' },
    { label: 'Rating', value: liveStats?.avg_rating != null ? liveStats.avg_rating.toFixed(1) : '—' },
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await loginUser({ email: form.email, password: form.password })
      login(res.access_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] bg-[#0b0e16] text-white">
      {/* Left panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="page-gradient absolute inset-0 opacity-90" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,85,51,0.18),transparent_28%)]" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.18),transparent_30%)]" aria-hidden />
        <div className="relative flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5533]" />
          <span className="text-[0.78rem] font-bold text-white/70 tracking-[0.08em] uppercase">Hub4Learners</span>
        </div>
        <div className="relative space-y-4 max-w-[480px]">
          <h1 className="text-[clamp(2.2rem,3.8vw,3.1rem)] font-black leading-[1.06] tracking-[-0.03em] text-white">
            Sign in to a smoother, human-crafted classroom.
          </h1>
          <p className="text-[0.98rem] text-white/75 leading-[1.7]">
            No clutter, no AI feel — just focused learning with verified professors and clean resources.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {stats.map(stat => (
              <div key={stat.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[1.25rem] font-black">{stat.value}</p>
                <p className="text-[0.78rem] uppercase tracking-[0.12em] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur flex items-center gap-3 max-w-[420px]">
          <span className="w-9 h-9 rounded-full bg-[#FF5533] text-white flex items-center justify-center font-bold text-[0.9rem]">UX</span>
          <div>
            <p className="text-[0.92rem] font-semibold text-white mb-1">Today’s featured drop</p>
            <p className="text-[0.82rem] text-white/70">Motion Systems · starts in 15 minutes</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="bg-[#F6F8FB] flex flex-col justify-center py-12 px-6 sm:px-10 lg:px-12">
        <div className="max-w-[480px] w-full mx-auto card-soft">
          <div className="p-6 sm:p-8">
            <p className="text-[0.72rem] font-bold tracking-[0.12em] uppercase text-[#FF5533] m-0 mb-[0.6rem]">Welcome back</p>
            <h2 className="text-[2.2rem] font-black tracking-[-0.04em] text-[#0C0C0F] m-0 mb-2 leading-[1.1]">Sign in</h2>
            <p className="text-[0.9rem] text-[#64748B] m-0 mb-8">Enter your credentials to continue.</p>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-fadeIn">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-xs font-semibold tracking-wider uppercase text-slate-600">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white outline-none w-full placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-xs font-semibold tracking-wider uppercase text-slate-600">Password</label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    name="password"
                    placeholder="Your password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    className="h-12 px-4 pr-12 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white outline-none w-full placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-4 bg-transparent border-none p-0 cursor-pointer text-slate-400 flex items-center transition-colors hover:text-slate-900"
                  >
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end -mt-2">
                <a href="#" className="text-sm text-slate-500 no-underline font-medium transition-colors hover:text-slate-900">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 h-12 bg-slate-900 text-white border-none rounded-xl text-sm font-semibold cursor-pointer w-full mt-1 shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </>
                ) : 'Sign in'}
              </button>
            </form>

            <div className="flex items-center gap-3 text-slate-300 text-xs tracking-wide mt-6 mb-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span>or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              className="flex items-center justify-center gap-3 h-12 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-700 cursor-pointer w-full hover:border-slate-400 hover:bg-slate-50 transition-all duration-200"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="text-center text-sm text-slate-500 mt-5">
              No account?{' '}
              <Link
                to="/register"
                className="text-slate-900 font-semibold no-underline border-b border-b-slate-900 pb-[0.5px] transition-colors hover:text-[#FF5533] hover:border-b-[#FF5533]"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

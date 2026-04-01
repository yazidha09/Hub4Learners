import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'

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

function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    if (!password) return 0
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const strength = getStrength()
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const barColors = ['', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500']
  const textColors = ['', 'text-red-400', 'text-orange-400', 'text-yellow-500', 'text-emerald-600']

  if (!password) return null

  return (
    <div className="-mt-3">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${i <= strength ? barColors[strength] : 'bg-[#E5E7EB]'}`}
          />
        ))}
      </div>
      <p className={`text-[0.72rem] font-medium ${textColors[strength]}`}>{labels[strength]}</p>
    </div>
  )
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const passwordsMatch = form.confirm === '' || form.password === form.confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordsMatch) return
    setError('')
    setLoading(true)
    try {
      const res = await registerUser({
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        password: form.password,
      })
      login(res.access_token)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    'h-12 px-4 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white outline-none w-full placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all duration-200'

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] bg-[#0b0e16] text-white">
      {/* Left panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="page-gradient absolute inset-0 opacity-90" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,85,51,0.18),transparent_28%)]" aria-hidden />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(52,211,153,0.18),transparent_30%)]" aria-hidden />
        <div className="relative flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF5533]" />
          <span className="text-[0.78rem] font-bold text-white/70 tracking-[0.08em] uppercase">Hub4Learners</span>
        </div>
        <div className="relative space-y-4 max-w-[500px]">
          <h1 className="text-[clamp(2.2rem,3.8vw,3.1rem)] font-black leading-[1.06] tracking-[-0.03em] text-white">
            Create your account for a smoother learning space.
          </h1>
          <p className="text-[0.98rem] text-white/75 leading-[1.7]">
            Join thousands of learners and professors sharing verified, human-crafted courses — without AI-generated noise.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            {[
              { label: 'Free to start', value: '0 DA' },
              { label: 'Subjects', value: '30+' },
              { label: 'Courses', value: '100+' },
              { label: 'Learners', value: '12k+' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur">
                <p className="text-[1.1rem] font-black">{stat.value}</p>
                <p className="text-[0.78rem] uppercase tracking-[0.12em] text-white/60">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative rounded-2xl bg-white/5 border border-white/10 p-4 backdrop-blur flex items-center gap-3 max-w-[420px]">
          <span className="w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-[0.9rem]">New</span>
          <div>
            <p className="text-[0.92rem] font-semibold text-white mb-1">Professor upgrades reviewed</p>
            <p className="text-[0.82rem] text-white/70">We keep quality high so your learning stays sharp.</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="bg-[#F6F8FB] flex flex-col justify-center py-12 px-6 sm:px-10 lg:px-12">
        <div className="max-w-[520px] w-full mx-auto card-soft">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#FF5533] mb-2">Get started</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Create account</h2>
            <p className="text-sm text-slate-500 mb-8">Free forever. No credit card required.</p>

            <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 animate-fadeIn">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="firstName" className="text-xs font-semibold tracking-wider uppercase text-slate-600">First name</label>
                  <input
                    id="firstName"
                    type="text"
                    name="firstName"
                    placeholder="John"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                    className={inputBase}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="lastName" className="text-xs font-semibold tracking-wider uppercase text-slate-600">Last name</label>
                  <input
                    id="lastName"
                    type="text"
                    name="lastName"
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                    className={inputBase}
                  />
                </div>
              </div>

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
                  className={inputBase}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-xs font-semibold tracking-wider uppercase text-slate-600">Password</label>
                <div className="relative flex items-center">
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    name="password"
                    placeholder="Min. 8 characters"
                    value={form.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={`${inputBase} pr-12`}
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
                <PasswordStrength password={form.password} />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="confirm" className="text-xs font-semibold tracking-wider uppercase text-slate-600">Confirm password</label>
                <div className="relative flex items-center">
                  <input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    name="confirm"
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    className={`${inputBase} pr-12 ${!passwordsMatch ? 'border-red-400 ring-4 ring-red-100' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute right-4 bg-transparent border-none p-0 cursor-pointer text-slate-400 flex items-center transition-colors hover:text-slate-900"
                  >
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {!passwordsMatch && (
                  <span className="text-xs text-red-500">Passwords do not match</span>
                )}
              </div>

              <button
                type="submit"
                disabled={!passwordsMatch || loading}
                className="flex items-center justify-center gap-2 h-12 bg-slate-900 text-white border-none rounded-xl text-sm font-semibold cursor-pointer w-full mt-1 shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0 transition-all duration-200"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </>
                ) : 'Create account'}
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
              Sign up with Google
            </button>

            <p className="text-center text-sm text-slate-500 mt-5">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-slate-900 font-semibold no-underline border-b border-b-slate-900 pb-[0.5px] transition-colors hover:text-[#FF5533] hover:border-b-[#FF5533]"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

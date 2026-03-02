import { useState } from 'react'
import { Link } from 'react-router-dom'

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const passwordsMatch = form.confirm === '' || form.password === form.confirm

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordsMatch) return
    // TODO: connect to backend
  }

  const inputBase =
    'h-11 px-[0.9rem] border-[1.5px] border-[#E5E7EB] rounded-lg text-[0.9rem] text-[#0C0C0F] bg-white transition-[border-color,box-shadow] outline-none w-full placeholder:text-[#C4C9D4] focus:border-[#0C0C0F] focus:shadow-[0_0_0_3px_rgba(12,12,15,0.07)]'

  return (
    <div className="min-h-screen grid grid-cols-1 min-[861px]:grid-cols-2">

      {/* ── Left panel ── */}
      <div className="relative bg-[#0C0C0F] hidden min-[861px]:flex flex-col justify-between py-12 px-14 overflow-hidden">
        {/* Ghost H4L decoration */}
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[48%] text-[22rem] font-black tracking-[-0.06em] select-none pointer-events-none whitespace-nowrap"
          style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.045)' } as React.CSSProperties}
        >H4L</span>

        {/* Brand */}
        <div className="relative z-[1] flex items-center gap-[0.6rem]">
          <span className="w-2 h-2 rounded-full bg-[#FF5533] shrink-0" />
          <span className="text-[0.8rem] font-bold text-white/70 tracking-[0.08em] uppercase">Hub4Learners</span>
        </div>

        {/* Headline */}
        <div className="relative z-[1]">
          <h1 className="text-[clamp(2.2rem,3.8vw,3.2rem)] font-black leading-[1.08] tracking-[-0.03em] text-white m-0 mb-6">
            Your next skill<br />
            starts <em className="not-italic text-[#FF5533]">today.</em>
          </h1>
          <p className="text-[0.9rem] text-white/40 leading-[1.65] max-w-[320px] m-0">
            Join thousands of learners building real skills through hands-on courses and expert mentorship.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-[1] flex items-center gap-8">
          <div className="flex flex-col gap-[0.15rem]">
            <span className="text-[1.4rem] font-extrabold text-white tracking-[-0.03em]">Free</span>
            <span className="text-[0.72rem] text-white/35 uppercase tracking-[0.07em]">To join</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col gap-[0.15rem]">
            <span className="text-[1.4rem] font-extrabold text-white tracking-[-0.03em]">100+</span>
            <span className="text-[0.72rem] text-white/35 uppercase tracking-[0.07em]">Courses</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col gap-[0.15rem]">
            <span className="text-[1.4rem] font-extrabold text-white tracking-[-0.03em]">12k+</span>
            <span className="text-[0.72rem] text-white/35 uppercase tracking-[0.07em]">Learners</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="bg-white flex flex-col justify-center py-14 px-[4.5rem] max-[860px]:py-16 max-[860px]:px-8 max-[860px]:justify-start max-[860px]:pt-16 max-[480px]:py-10 max-[480px]:px-6">
        <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#FF5533] m-0 mb-[0.6rem]">Get started</p>
        <h2 className="text-[2.4rem] max-[480px]:text-[2rem] font-black tracking-[-0.04em] text-[#0C0C0F] m-0 mb-2 leading-[1.1]">Create account</h2>
        <p className="text-[0.88rem] text-[#94A3B8] m-0 mb-9">Free forever. No credit card required.</p>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {/* Name row */}
          <div className="grid grid-cols-2 max-[480px]:grid-cols-1 gap-4">
            <div className="flex flex-col gap-[0.45rem]">
              <label htmlFor="firstName" className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#374151]">First name</label>
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
            <div className="flex flex-col gap-[0.45rem]">
              <label htmlFor="lastName" className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#374151]">Last name</label>
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

          {/* Email */}
          <div className="flex flex-col gap-[0.45rem]">
            <label htmlFor="email" className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#374151]">Email</label>
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

          {/* Password */}
          <div className="flex flex-col gap-[0.45rem]">
            <label htmlFor="password" className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#374151]">Password</label>
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
                className={`${inputBase} pr-[2.8rem]`}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                className="absolute right-[0.85rem] bg-transparent border-none p-0 cursor-pointer text-[#C4C9D4] flex items-center transition-colors hover:text-[#0C0C0F]"
              >
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <PasswordStrength password={form.password} />
          </div>

          {/* Confirm password */}
          <div className="flex flex-col gap-[0.45rem]">
            <label htmlFor="confirm" className="text-[0.7rem] font-bold tracking-[0.1em] uppercase text-[#374151]">Confirm password</label>
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
                className={`${inputBase} pr-[2.8rem] ${!passwordsMatch ? 'border-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.08)]' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-[0.85rem] bg-transparent border-none p-0 cursor-pointer text-[#C4C9D4] flex items-center transition-colors hover:text-[#0C0C0F]"
              >
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {!passwordsMatch && (
              <span className="text-[0.75rem] text-[#EF4444]">Passwords do not match</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!passwordsMatch}
            className="h-12 bg-[#0C0C0F] text-white border-none rounded-lg text-[0.9rem] font-bold cursor-pointer tracking-[0.02em] transition-[background-color,transform] w-full mt-1 hover:bg-[#1E1E23] hover:-translate-y-px active:translate-y-0 disabled:bg-[#D1D5DB] disabled:cursor-not-allowed disabled:translate-y-0"
          >
            Create account
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[#D1D5DB] text-[0.75rem] tracking-[0.04em] mt-6 mb-4">
          <div className="flex-1 h-px bg-[#F1F3F5]" />
          <span>or</span>
          <div className="flex-1 h-px bg-[#F1F3F5]" />
        </div>

        {/* OAuth */}
        <button
          type="button"
          className="flex items-center justify-center gap-[0.6rem] h-11 border-[1.5px] border-[#E5E7EB] rounded-lg bg-white text-[0.875rem] font-semibold text-[#374151] cursor-pointer transition-[border-color,background-color] w-full hover:border-[#0C0C0F] hover:bg-[#FAFAFA]"
        >
          <GoogleIcon />
          Sign up with Google
        </button>

        <p className="text-center text-[0.85rem] text-[#94A3B8] mt-5">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-[#0C0C0F] font-bold no-underline border-b border-b-[#0C0C0F] pb-[0.5px] transition-[color,border-color] hover:text-[#FF5533] hover:border-b-[#FF5533]"
          >
            Sign in
          </Link>
        </p>
      </div>

    </div>
  )
}

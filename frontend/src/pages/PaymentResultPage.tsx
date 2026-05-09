import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { confirmPayment } from '../api/payment'

/* ── Shared shell ─────────────────────────────────────────────────────────── */

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F1F3F5] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center justify-center gap-2 mb-6 text-slate-500">
          <span className="w-7 h-7 rounded-lg bg-[#0C0C0F] text-white flex items-center justify-center text-[11px] font-black tracking-tight">H4L</span>
          <span className="text-xs font-medium tracking-wider uppercase">Hub4Learners</span>
        </div>
        {children}
        <p className="mt-6 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Payments are processed by Stripe. We never store your card details.
        </p>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.06)] overflow-hidden">
      {children}
    </div>
  )
}

/* ── Success ──────────────────────────────────────────────────────────────── */

export function PaymentSuccessPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id') || ''
  const courseId = params.get('course_id') || ''

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !sessionId) {
      setStatus('error')
      setError('Missing session or login.')
      return
    }
    confirmPayment(token, sessionId)
      .then(() => setStatus('success'))
      .catch((e: Error) => {
        setError(e.message || 'Could not confirm payment.')
        setStatus('error')
      })
  }, [token, sessionId])

  if (status === 'verifying') {
    return (
      <PageShell>
        <Card>
          <div className="px-8 pt-10 pb-8 text-center">
            <div className="relative w-12 h-12 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-slate-100" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0C0C0F] animate-spin" />
            </div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight mb-1">Confirming your payment</h1>
            <p className="text-sm text-slate-500">This usually takes a second.</p>
          </div>
        </Card>
      </PageShell>
    )
  }

  if (status === 'error') {
    return (
      <PageShell>
        <Card>
          <div className="px-8 pt-10 pb-8 text-center">
            <div className="w-11 h-11 mx-auto mb-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight mb-1.5">We couldn't confirm your payment</h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error}</p>
            <p className="text-[12px] text-slate-400 mb-5">
              If your card was charged, contact support and we'll resolve it.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center w-full h-11 rounded-xl text-sm font-semibold bg-[#0C0C0F] text-white hover:bg-[#1E1E23] transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <Card>
        <div className="px-8 pt-10 pb-2 text-center">
          <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight mb-1.5">Payment confirmed</h1>
          <p className="text-sm text-slate-500">You're enrolled and ready to start learning.</p>
        </div>

        <div className="mx-8 my-6 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold text-slate-900 leading-tight">Course unlocked</p>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
              Lifetime access · Receipt sent to your email by Stripe
            </p>
          </div>
        </div>

        <div className="px-8 pb-8 flex flex-col gap-2">
          {courseId && (
            <button
              onClick={() => navigate(`/learn/${courseId}`)}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-[#0C0C0F] text-white hover:bg-[#1E1E23] border-none cursor-pointer transition-colors"
            >
              Start learning
            </button>
          )}
          <Link
            to="/dashboard"
            className="w-full h-11 inline-flex items-center justify-center rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </Card>
    </PageShell>
  )
}

/* ── Cancel ───────────────────────────────────────────────────────────────── */

export function PaymentCancelPage() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const courseId = params.get('course_id') || ''

  return (
    <PageShell>
      <Card>
        <div className="px-8 pt-10 pb-8 text-center">
          <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 tracking-tight mb-1.5">Checkout cancelled</h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            No charge was made to your card. You can pick up where you left off whenever you're ready.
          </p>

          <div className="flex flex-col gap-2">
            <Link
              to="/dashboard"
              className="w-full h-11 inline-flex items-center justify-center rounded-xl text-sm font-semibold bg-[#0C0C0F] text-white hover:bg-[#1E1E23] transition-colors"
            >
              Back to courses
            </Link>
            {courseId && (
              <Link
                to={`/dashboard?course=${courseId}`}
                className="w-full h-11 inline-flex items-center justify-center rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Try again
              </Link>
            )}
          </div>
        </div>
      </Card>
    </PageShell>
  )
}

import { useCallback, useState } from 'react'
import { subscribeToPro } from '../api/billing'
import { useAuth } from '../context/AuthContext'

interface Props {
  open: boolean
  onClose: () => void
  /** Optional headline reason (e.g. "Unlock the full AI digest"). */
  reason?: string
}

const PERKS: { title: string; body: string }[] = [
  { title: 'Full AI discussion digests', body: 'See the complete summary of every lesson thread, plus on-demand refresh.' },
  { title: 'Medium & hard quizzes',       body: 'Unlock 8- and 10-question quizzes for deeper application and analysis.' },
  { title: 'Unlimited PDF imports',       body: 'Professors: generate as many courses from PDF as you need each month.' },
  { title: 'Priority AI generation',      body: 'Your AI requests get scheduled ahead of free-tier traffic.' },
]

export default function UpgradeProModal({ open, onClose, reason }: Props) {
  const { token } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleUpgrade = useCallback(async () => {
    if (!token || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const { url } = await subscribeToPro(token)
      if (!url) throw new Error('Checkout URL missing from response.')
      window.location.assign(url)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start checkout.'
      setError(msg)
      setSubmitting(false)
    }
  }, [token, submitting])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[#0F1117] border border-[#1E2028] rounded-3xl w-full max-w-md max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-[#1A0F0A] via-[#0F1117] to-[#0F1117] border-b border-[#1E2028]">
          <button
            onClick={onClose}
            aria-label="Close upgrade modal"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-[#64748B] hover:text-white hover:bg-[#1E2028] transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5533] to-[#FF7755] flex items-center justify-center shadow-lg shadow-[#FF5533]/30">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#FF7755]">Hub4Learners Pro</p>
              <p className="text-[0.7rem] text-[#64748B]">30-day access · billed once</p>
            </div>
          </div>
          {reason && (
            <p className="text-[0.92rem] font-semibold text-white leading-snug mb-1">{reason}</p>
          )}
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-[2rem] font-bold text-white leading-none">$9.99</span>
            <span className="text-[0.78rem] text-[#94A3B8]">/ 30 days</span>
          </div>
        </div>

        {/* Perks */}
        <div className="px-6 py-5 flex-1 overflow-y-auto">
          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p.title} className="flex items-start gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#FF5533]/15 border border-[#FF5533]/30 text-[#FF7755] flex items-center justify-center shrink-0">
                  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[0.84rem] font-semibold text-white leading-tight">{p.title}</p>
                  <p className="text-[0.74rem] text-[#94A3B8] mt-0.5 leading-snug">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 pt-2 pb-5 border-t border-[#1E2028]">
          {error && (
            <p className="text-[0.74rem] text-rose-400 mb-2.5 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
              {error}
            </p>
          )}
          <button
            onClick={handleUpgrade}
            disabled={submitting || !token}
            className="w-full h-11 rounded-xl bg-[#FF5533] text-white text-[0.86rem] font-semibold hover:bg-[#E64422] disabled:bg-[#1E2028] disabled:text-[#475569] disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Redirecting…
              </>
            ) : (
              'Upgrade to Pro'
            )}
          </button>
          <p className="mt-2.5 text-center text-[0.66rem] text-[#475569]">
            Secure checkout via Stripe · No auto-renewal
          </p>
        </div>
      </div>
    </div>
  )
}

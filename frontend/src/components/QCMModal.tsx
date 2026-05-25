import { useState } from 'react'
import {
  generateQCM,
  submitQCM,
  type QCMDifficulty,
  type QCMQuestion,
  type QCMSubmitOut,
} from '../api/qcm'
import { useGamification } from '../context/GamificationContext'
import { useAuth } from '../context/AuthContext'
import UpgradeProModal from './UpgradeProModal'

type Stage = 'pick' | 'loading' | 'quiz' | 'results' | 'error'

interface Props {
  token: string
  courseId: string
  sectionId?: string  // omit for course-wide final exam
  scopeLabel: string  // e.g. "Section: Linear Algebra" or "Final Exam"
  onClose: () => void
}

const DIFFICULTIES: { id: QCMDifficulty; label: string; questions: number; tagline: string; color: string; proOnly: boolean }[] = [
  { id: 'easy',   label: 'Easy',   questions: 5,  tagline: 'Basic recall & definitions',     color: '#10B981', proOnly: false },
  { id: 'medium', label: 'Medium', questions: 8,  tagline: 'Application & comprehension',    color: '#FF5533', proOnly: true  },
  { id: 'hard',   label: 'Hard',   questions: 10, tagline: 'Analysis & scenario reasoning',  color: '#A855F7', proOnly: true  },
]

export default function QCMModal({ token, courseId, sectionId, scopeLabel, onClose }: Props) {
  const { refresh: refreshGamification } = useGamification()
  const { user } = useAuth()
  const isPro = !!user?.is_pro
  const [stage, setStage] = useState<Stage>('pick')
  const [difficulty, setDifficulty] = useState<QCMDifficulty>('easy')
  const [questions, setQuestions] = useState<QCMQuestion[]>([])
  const [answers, setAnswers] = useState<number[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<QCMSubmitOut | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const start = async (diff: QCMDifficulty) => {
    // Client-side gate so the upsell shows instantly; the backend still
    // enforces the same rule with HTTP 402.
    const cfg = DIFFICULTIES.find(d => d.id === diff)
    if (cfg?.proOnly && !isPro) {
      setShowUpgrade(true)
      return
    }
    setDifficulty(diff)
    setStage('loading')
    setErrorMsg('')
    try {
      const data = await generateQCM(token, courseId, diff, sectionId)
      setQuestions(data.questions)
      setAnswers(new Array(data.questions.length).fill(-1))
      setCurrentIdx(0)
      setStage('quiz')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate quiz.'
      if (/pro feature|pro subscription required/i.test(msg)) {
        setShowUpgrade(true)
        setStage('pick')
        return
      }
      setErrorMsg(msg)
      setStage('error')
    }
  }

  const choose = (optionIdx: number) => {
    setAnswers(prev => {
      const next = [...prev]
      next[currentIdx] = optionIdx
      return next
    })
  }

  const next = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1)
  }

  const prev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1)
  }

  const finish = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const out = await submitQCM(token, courseId, difficulty, questions, answers, sectionId)
      setResults(out)
      setStage('results')
      // Surface XP/level/achievement toasts the backend awarded for this attempt.
      void refreshGamification()
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to submit quiz.')
      setStage('error')
    } finally {
      setSubmitting(false)
    }
  }

  const retake = () => {
    setStage('pick')
    setQuestions([])
    setAnswers([])
    setResults(null)
    setCurrentIdx(0)
  }

  const allAnswered = answers.length > 0 && answers.every(a => a >= 0)
  const progressPct = questions.length ? ((currentIdx + 1) / questions.length) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F1117] border border-[#1E2028] rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1E2028] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#FF5533] to-[#FF7755] flex items-center justify-center shrink-0">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[0.66rem] font-bold text-[#475569] uppercase tracking-[0.12em]">Knowledge Check</p>
              <h3 className="text-[0.95rem] font-bold text-white truncate">{scopeLabel}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#1E2028] text-[#64748B] hover:text-white transition-colors shrink-0">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">

          {/* ─── STAGE: pick difficulty ─── */}
          {stage === 'pick' && (
            <div className="p-6">
              <p className="text-[0.85rem] text-[#94A3B8] mb-1">Pick a difficulty.</p>
              <p className="text-[0.72rem] text-[#475569] mb-6">
                Pass with at least <span className="text-emerald-400 font-semibold">70%</span>. Each attempt generates fresh questions.
              </p>
              <div className="space-y-3">
                {DIFFICULTIES.map(d => {
                  const locked = d.proOnly && !isPro
                  return (
                    <button
                      key={d.id}
                      onClick={() => start(d.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-150 group ${
                        locked
                          ? 'bg-[#15171D] border-[#1E2028] hover:border-[#FF5533]/40'
                          : 'bg-[#1A1D25] border-[#252830] hover:border-[#FF5533]/40 hover:bg-[#1E2028]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                            <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                            <p className={`text-[0.92rem] font-bold ${locked ? 'text-[#94A3B8]' : 'text-white'}`}>{d.label}</p>
                            <span className="text-[0.65rem] text-[#475569] font-mono">{d.questions} Qs</span>
                            {locked && (
                              <span className="text-[0.58rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FF5533]/15 text-[#FF7755] border border-[#FF5533]/25 flex items-center gap-1">
                                <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                Pro
                              </span>
                            )}
                          </div>
                          <p className="text-[0.76rem] text-[#64748B]">
                            {locked ? `${d.tagline} · Upgrade to unlock` : d.tagline}
                          </p>
                        </div>
                        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} className="group-hover:stroke-[#FF5533] shrink-0 transition-colors">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── STAGE: loading ─── */}
          {stage === 'loading' && (
            <div className="p-12 flex flex-col items-center justify-center gap-4 min-h-[280px]">
              <div className="w-12 h-12 border-4 border-[#FF5533] border-t-transparent rounded-full animate-spin" />
              <p className="text-[0.88rem] text-[#CBD5E1] font-semibold">Generating your quiz…</p>
              <p className="text-[0.74rem] text-[#475569] text-center max-w-xs">
                The AI is crafting fresh questions from your course material. This can take 10–20 seconds.
              </p>
            </div>
          )}

          {/* ─── STAGE: quiz ─── */}
          {stage === 'quiz' && questions.length > 0 && (() => {
            const q = questions[currentIdx]
            const chosen = answers[currentIdx]
            return (
              <div className="p-6">
                {/* Progress bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[0.7rem] font-bold text-[#64748B] uppercase tracking-wider">
                      Question {currentIdx + 1} / {questions.length}
                    </span>
                    <span className="text-[0.7rem] text-[#475569] font-mono">
                      {answers.filter(a => a >= 0).length}/{questions.length} answered
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#1A1D25] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#FF5533] to-[#FF7755] rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {/* Question */}
                <h4 className="text-[1rem] font-semibold text-white leading-snug mb-5">{q.question}</h4>

                {/* Options */}
                <div className="space-y-2.5 mb-6">
                  {q.options.map((opt, idx) => {
                    const isSelected = chosen === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => choose(idx)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center gap-3 ${
                          isSelected
                            ? 'bg-[#FF5533]/12 border-[#FF5533]/40 text-white'
                            : 'bg-[#1A1D25] border-[#252830] text-[#CBD5E1] hover:border-[#FF5533]/25 hover:bg-[#1E2028]'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.7rem] font-bold shrink-0 ${
                          isSelected ? 'bg-[#FF5533] text-white' : 'bg-[#252830] text-[#64748B]'
                        }`}>
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-[0.85rem] leading-snug">{opt}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Nav buttons */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={prev}
                    disabled={currentIdx === 0}
                    className="px-4 py-2 rounded-xl bg-[#1A1D25] border border-[#252830] text-[#94A3B8] text-[0.8rem] font-semibold hover:bg-[#1E2028] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  {currentIdx < questions.length - 1 ? (
                    <button
                      onClick={next}
                      disabled={chosen < 0}
                      className="px-5 py-2 rounded-xl bg-[#FF5533] text-white text-[0.8rem] font-semibold hover:bg-[#E64422] disabled:bg-[#1E2028] disabled:text-[#334155] disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      onClick={finish}
                      disabled={!allAnswered || submitting}
                      className="px-5 py-2 rounded-xl bg-emerald-500 text-white text-[0.8rem] font-semibold hover:bg-emerald-600 disabled:bg-[#1E2028] disabled:text-[#334155] disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Grading…
                        </>
                      ) : (
                        'Submit Quiz'
                      )}
                    </button>
                  )}
                </div>
                {!allAnswered && currentIdx === questions.length - 1 && (
                  <p className="text-[0.7rem] text-amber-400 text-right mt-2">
                    Answer all questions before submitting.
                  </p>
                )}
              </div>
            )
          })()}

          {/* ─── STAGE: results ─── */}
          {stage === 'results' && results && (
            <div className="p-6">
              {/* Score banner */}
              <div className={`p-6 rounded-2xl border mb-6 text-center ${
                results.passed
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}>
                <p className={`text-[0.7rem] font-bold uppercase tracking-wider mb-2 ${results.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {results.passed ? '✓ Passed' : '✗ Did not pass'}
                </p>
                <p className="text-[2.4rem] font-bold text-white leading-none mb-1.5">
                  {results.score} <span className="text-[#475569]">/ {results.total}</span>
                </p>
                <p className={`text-[0.95rem] font-semibold ${results.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {results.score_pct}%
                </p>
                <p className="text-[0.72rem] text-[#64748B] mt-2">
                  Pass threshold: {results.pass_threshold_pct}%
                </p>
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-3 mb-6">
                <p className="text-[0.7rem] font-bold text-[#475569] uppercase tracking-wider">Review</p>
                {results.results.map((r, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${
                    r.is_correct
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : 'bg-red-500/5 border-red-500/20'
                  }`}>
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        r.is_correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {r.is_correct ? (
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </span>
                      <p className="text-[0.85rem] font-semibold text-white leading-snug flex-1">{r.question}</p>
                    </div>
                    <div className="ml-9 space-y-1.5">
                      {r.options.map((opt, oi) => {
                        const isCorrect = oi === r.correct_index
                        const isChosen = oi === r.chosen_index
                        let cls = 'text-[#64748B]'
                        let prefix = ''
                        if (isCorrect) { cls = 'text-emerald-400 font-medium'; prefix = '✓ ' }
                        else if (isChosen) { cls = 'text-red-400 font-medium'; prefix = '✗ ' }
                        return (
                          <div key={oi} className={`text-[0.78rem] flex items-start gap-1.5 ${cls}`}>
                            <span className="font-mono text-[0.72rem] shrink-0">{String.fromCharCode(65 + oi)}.</span>
                            <span>{prefix}{opt}</span>
                          </div>
                        )
                      })}
                    </div>
                    {r.explanation && (
                      <p className="ml-9 mt-2.5 text-[0.76rem] text-[#94A3B8] italic leading-relaxed">
                        💡 {r.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 py-2.5 rounded-xl bg-[#1A1D25] border border-[#252830] text-[#CBD5E1] text-[0.82rem] font-semibold hover:bg-[#1E2028] transition-colors"
                >
                  Retake Quiz
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF5533] text-white text-[0.82rem] font-semibold hover:bg-[#E64422] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* ─── STAGE: error ─── */}
          {stage === 'error' && (
            <div className="p-8 flex flex-col items-center text-center min-h-[240px] justify-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.732 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-[0.88rem] font-semibold text-white mb-1.5">Could not generate quiz</p>
              <p className="text-[0.78rem] text-[#94A3B8] mb-5 max-w-sm">{errorMsg}</p>
              <div className="flex gap-3">
                <button onClick={() => setStage('pick')} className="px-5 py-2 rounded-xl bg-[#FF5533] text-white text-[0.8rem] font-semibold hover:bg-[#E64422] transition-colors">
                  Try again
                </button>
                <button onClick={onClose} className="px-5 py-2 rounded-xl bg-[#1A1D25] border border-[#252830] text-[#CBD5E1] text-[0.8rem] font-semibold hover:bg-[#1E2028] transition-colors">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <UpgradeProModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="Unlock medium & hard quizzes"
      />
    </div>
  )
}

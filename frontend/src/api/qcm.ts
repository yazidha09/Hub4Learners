const API_BASE = 'http://localhost:8000/api'

export type QCMDifficulty = 'easy' | 'medium' | 'hard'

export interface QCMQuestion {
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

export interface QCMGenerateOut {
  course_id: string
  section_id?: string | null
  difficulty: QCMDifficulty
  questions: QCMQuestion[]
}

export interface QCMQuestionResult {
  question: string
  options: string[]
  correct_index: number
  chosen_index: number
  is_correct: boolean
  explanation: string
}

export interface QCMSubmitOut {
  attempt_id: string
  score: number
  total: number
  score_pct: number
  passed: boolean
  pass_threshold_pct: number
  results: QCMQuestionResult[]
  completed_at: string
}

export interface QCMAttemptOut {
  id: string
  course_id: string
  section_id?: string | null
  difficulty: QCMDifficulty
  score: number
  total: number
  score_pct: number
  passed: boolean
  completed_at: string
}

async function request<T>(path: string, token?: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.detail ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function generateQCM(
  token: string,
  courseId: string,
  difficulty: QCMDifficulty,
  sectionId?: string,
): Promise<QCMGenerateOut> {
  return request<QCMGenerateOut>('/ai/qcm/generate', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_id: courseId,
      section_id: sectionId ?? null,
      difficulty,
    }),
  })
}

export function submitQCM(
  token: string,
  courseId: string,
  difficulty: QCMDifficulty,
  questions: QCMQuestion[],
  answers: number[],
  sectionId?: string,
): Promise<QCMSubmitOut> {
  return request<QCMSubmitOut>('/ai/qcm/submit', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      course_id: courseId,
      section_id: sectionId ?? null,
      difficulty,
      questions,
      answers,
    }),
  })
}

export function getQCMHistory(token: string, courseId: string): Promise<QCMAttemptOut[]> {
  return request<QCMAttemptOut[]>(`/ai/qcm/history?course_id=${encodeURIComponent(courseId)}`, token)
}

// ── AI course summary (markdown recap of the whole course) ──────────────────

export interface CourseSummaryOut {
  course_id: string
  summary?: string | null
  generated_at?: string | null
}

export function getCourseSummary(token: string, courseId: string): Promise<CourseSummaryOut> {
  return request<CourseSummaryOut>(`/ai/course-summary/${encodeURIComponent(courseId)}`, token)
}

export function regenerateCourseSummary(token: string, courseId: string): Promise<CourseSummaryOut> {
  return request<CourseSummaryOut>(`/ai/course-summary/${encodeURIComponent(courseId)}`, token, {
    method: 'POST',
  })
}

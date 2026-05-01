const API_BASE = 'http://localhost:8000/api'

export interface MaterialOut {
  id: string
  section_id: string
  title: string
  type: 'pdf' | 'video' | 'audio' | 'exercise' | 'lesson'
  file_url: string
  content_text?: string
  order_index: number
  created_at: string
}

export interface LessonBlockOut {
  id: string
  subsection_id?: string
  section_id?: string
  block_type: 'text' | 'image' | 'video'
  content?: string
  file_url?: string
  caption?: string
  order_index: number
  created_at: string
}

export interface SubsectionOut {
  id: string
  section_id: string
  title: string
  order_index: number
  created_at: string
  blocks: LessonBlockOut[]
}

export interface GenerationJob {
  job_id: string
  status: 'processing' | 'completed' | 'failed'
  pdf_filename: string
  difficulty: string
  result?: {
    title: string
    sections: Array<{
      title: string
      subsections: Array<{ title: string; content: string }>
    }>
  }
  error?: string
}

export interface ImportResult {
  detail: string
  course_id: string
  sections_created: number
  lessons_created: number
}

export interface SectionOut {
  id: string
  course_id: string
  title: string
  order_index: number
  created_at: string
  materials: MaterialOut[]
  blocks: LessonBlockOut[]
  subsections: SubsectionOut[]
}

export interface CourseOut {
  id: string
  title: string
  description?: string
  thumbnail?: string
  is_free: boolean
  professor_id: string
  professor_name: string
  category_id?: string
  category_name?: string
  is_published: boolean
  created_at: string
  updated_at: string
  sections: SectionOut[]
  sections_count: number
  enrolled_count: number
  enrollment_status?: string
  progress_pct?: number
}

export interface CourseProgressOut {
  course_id: string
  completed_subsection_ids: string[]
  completed_material_ids: string[]
  total_items: number
  completed_items: number
  progress_pct: number
}

export interface AnalyticsReviewItem {
  user_name: string
  rating: number
  comment?: string | null
  created_at: string
}

export interface CourseAnalyticsItem {
  course_id: string
  course_title: string
  thumbnail?: string | null
  category_name?: string | null
  is_published: boolean
  created_at: string
  enrolled_count: number
  completed_count: number
  in_progress_count: number
  completion_rate: number
  avg_progress: number
  avg_rating: number
  rating_count: number
  rating_distribution: Record<string, number>
  recent_reviews: AnalyticsReviewItem[]
  enrollments_last_7d: number
  enrollments_last_30d: number
  last_enrollment_at?: string | null
  total_lessons: number
}

export interface AnalyticsTrendPoint {
  date: string
  enrollments: number
  completions: number
}

export interface CourseAnalyticsOut {
  courses: CourseAnalyticsItem[]
  total_courses: number
  total_published: number
  total_drafts: number
  total_enrolled: number
  total_completed: number
  total_in_progress: number
  overall_completion_rate: number
  overall_avg_rating: number
  total_reviews: number
  overall_rating_distribution: Record<string, number>
  enrollments_last_7d: number
  enrollments_last_30d: number
  completions_last_30d: number
  trend: AnalyticsTrendPoint[]
  top_courses_by_enrollment: CourseAnalyticsItem[]
  top_courses_by_rating: CourseAnalyticsItem[]
}

export interface EnrollmentOut {
  id: string
  student_id: string
  course_id: string
  status: string
  enrolled_at: string
}

export interface StudentOut {
  id: string
  full_name: string
  email: string
  enrolled_at: string
  status: string
}

export interface CourseStudentsOut {
  course_id: string
  course_title: string
  is_published: boolean
  students: StudentOut[]
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

export function listPublishedCourses(categoryId?: string): Promise<CourseOut[]> {
  const query = categoryId ? `?category_id=${categoryId}` : ''
  return request<CourseOut[]>(`/courses${query}`)
}

export function getCourseDetail(courseId: string): Promise<CourseOut> {
  return request<CourseOut>(`/courses/${courseId}`)
}

export function getMyCourses(token: string): Promise<CourseOut[]> {
  return request<CourseOut[]>('/courses/my', token)
}

export function createCourse(token: string, formData: FormData): Promise<CourseOut> {
  return request<CourseOut>('/courses', token, { method: 'POST', body: formData })
}

export function addSection(
  token: string,
  courseId: string,
  title: string,
  order_index: number,
): Promise<SectionOut> {
  return request<SectionOut>(`/courses/${courseId}/sections`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, order_index }),
  })
}

export function addSubsection(
  token: string,
  courseId: string,
  sectionId: string,
  title: string,
  order_index: number,
): Promise<SubsectionOut> {
  return request<SubsectionOut>(`/courses/${courseId}/sections/${sectionId}/subsections`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, order_index }),
  })
}

export function uploadMaterial(
  token: string,
  courseId: string,
  sectionId: string,
  formData: FormData,
): Promise<MaterialOut> {
  return request<MaterialOut>(
    `/courses/${courseId}/sections/${sectionId}/materials`,
    token,
    { method: 'POST', body: formData },
  )
}

export function togglePublish(token: string, courseId: string): Promise<CourseOut> {
  return request<CourseOut>(`/courses/${courseId}/publish`, token, { method: 'PATCH' })
}

export function enrollInCourse(token: string, courseId: string): Promise<EnrollmentOut> {
  return request<EnrollmentOut>(`/courses/${courseId}/enroll`, token, { method: 'POST' })
}

export function getEnrolledCourses(token: string): Promise<CourseOut[]> {
  return request<CourseOut[]>('/courses/enrolled', token)
}

export function getMyStudents(token: string): Promise<CourseStudentsOut[]> {
  return request<CourseStudentsOut[]>('/courses/my/students', token)
}

export function unenrollFromCourse(token: string, courseId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/courses/${courseId}/enroll`, token, { method: 'DELETE' })
}

export function deleteCourse(token: string, courseId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/courses/${courseId}`, token, { method: 'DELETE' })
}

export function deleteSection(token: string, courseId: string, sectionId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/courses/${courseId}/sections/${sectionId}`, token, { method: 'DELETE' })
}

export function addLessonBlock(
  token: string,
  courseId: string,
  subsectionId: string,
  formData: FormData,
): Promise<LessonBlockOut> {
  return request<LessonBlockOut>(
    `/courses/${courseId}/subsections/${subsectionId}/blocks`,
    token,
    { method: 'POST', body: formData },
  )
}

export function deleteLessonBlock(token: string, blockId: string): Promise<{ detail: string }> {
  return request<{ detail: string }>(`/courses/blocks/${blockId}`, token, { method: 'DELETE' })
}

export function updateLessonBlock(
  token: string,
  blockId: string,
  content: string,
  caption?: string,
): Promise<LessonBlockOut> {
  return request<LessonBlockOut>(`/courses/blocks/${blockId}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, caption }),
  })
}

// ── Progress tracking ────────────────────────────────────────────────────────

export function getCourseProgress(token: string, courseId: string): Promise<CourseProgressOut> {
  return request<CourseProgressOut>(`/courses/${courseId}/progress`, token)
}

export function markItemCompleted(
  token: string,
  courseId: string,
  subsectionId?: string,
  materialId?: string,
): Promise<CourseProgressOut> {
  return request<CourseProgressOut>(`/courses/${courseId}/progress`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subsection_id: subsectionId ?? null, material_id: materialId ?? null }),
  })
}

export function getCourseAnalytics(token: string): Promise<CourseAnalyticsOut> {
  return request<CourseAnalyticsOut>('/courses/my/analytics', token)
}

// ── Feedback ─────────────────────────────────────────────────────────────────

export interface FeedbackOut {
  id: string
  course_id: string
  user_id: string
  user_name: string
  rating: number
  comment?: string
  created_at: string
}

export function getCourseFeedback(courseId: string): Promise<FeedbackOut[]> {
  return request<FeedbackOut[]>(`/courses/${courseId}/feedback`)
}

export function getCourseFeedbackSummaries(): Promise<Record<string, { avg_rating: number; count: number }>> {
  return request('/courses/feedback-summaries')
}

export function submitFeedback(
  token: string,
  courseId: string,
  rating: number,
  comment?: string,
): Promise<FeedbackOut> {
  return request<FeedbackOut>(`/courses/${courseId}/feedback`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, comment: comment ?? null }),
  })
}

// ── AI course generation ──────────────────────────────────────────────────────

export function uploadPdfForGeneration(
  token: string,
  file: File,
  difficulty: string,
): Promise<{ job_id: string; status: string; message: string }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('difficulty', difficulty)
  return request('/course-gen/upload', token, { method: 'POST', body: fd })
}

export function pollGenerationJob(token: string, jobId: string): Promise<GenerationJob> {
  return request<GenerationJob>(`/course-gen/${jobId}`, token)
}

export function importGeneratedCourse(
  token: string,
  jobId: string,
  courseId: string,
  editedResult?: GenerationJob['result'],
): Promise<ImportResult> {
  return request<ImportResult>(`/course-gen/${jobId}/import/${courseId}`, token, {
    method: 'POST',
    headers: editedResult ? { 'Content-Type': 'application/json' } : {},
    body: editedResult ? JSON.stringify({ result: editedResult }) : undefined,
  })
}

export function regenerateSubsection(
  token: string,
  jobId: string,
  sectionIdx: number,
  subsectionIdx: number,
): Promise<{ section_index: number; subsection_index: number; subsection_title: string; content: string }> {
  return request(
    `/course-gen/${jobId}/sections/${sectionIdx}/subsections/${subsectionIdx}/regenerate`,
    token,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
  )
}

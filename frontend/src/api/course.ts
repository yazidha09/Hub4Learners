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
  enrolled_count: number
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
): Promise<ImportResult> {
  return request<ImportResult>(`/course-gen/${jobId}/import/${courseId}`, token, {
    method: 'POST',
  })
}

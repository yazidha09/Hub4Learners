import { useAuth } from '../context/AuthContext'
import StudentDashboard from './StudentDashboard'
import ProfessorDashboard from './ProfessorDashboard'
import AdminDashboard from './AdminDashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <span className="w-2 h-2 rounded-full bg-[#FF5533] animate-pulse" />
      </div>
    )
  }

  if (user.role === 'professor') return <ProfessorDashboard />
  if (['super_admin', 'regional_admin', 'university_admin'].includes(user.role)) return <AdminDashboard />
  return <StudentDashboard />
}

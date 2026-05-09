import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CourseLearningPage from './pages/CourseLearningPage'
import { PaymentSuccessPage, PaymentCancelPage } from './pages/PaymentResultPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoadingScreen from './components/LoadingScreen'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return token ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicRoute><HomePage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/learn/:courseId" element={<PrivateRoute><CourseLearningPage /></PrivateRoute>} />
          <Route path="/payment/success" element={<PrivateRoute><PaymentSuccessPage /></PrivateRoute>} />
          <Route path="/payment/cancel" element={<PrivateRoute><PaymentCancelPage /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

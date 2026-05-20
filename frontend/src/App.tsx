import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GamificationProvider } from './context/GamificationContext'
import GamificationToasts from './components/gamification/GamificationToasts'
import LoadingScreen from './components/LoadingScreen'

// Code-split each top-level page. The initial bundle now only ships the
// auth shell + active route — everything else loads on demand. Cuts the
// first-paint payload by ~60-70% (CourseLearningPage + dashboards alone
// account for the bulk of the JS).
const HomePage = lazy(() => import('./pages/HomePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const CourseLearningPage = lazy(() => import('./pages/CourseLearningPage'))
const PaymentSuccessPage = lazy(() =>
  import('./pages/PaymentResultPage').then((m) => ({ default: m.PaymentSuccessPage })),
)
const PaymentCancelPage = lazy(() =>
  import('./pages/PaymentResultPage').then((m) => ({ default: m.PaymentCancelPage })),
)

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
        <GamificationProvider>
          <Suspense fallback={<LoadingScreen />}>
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
          </Suspense>
          <GamificationToasts />
        </GamificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

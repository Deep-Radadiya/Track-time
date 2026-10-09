import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import LoginPage from '@/pages/LoginPage'
import SignupPage from '@/pages/SignupPage'
import DashboardPage from '@/pages/DashboardPage'
import TasksPage from '@/pages/TasksPage'
import VoicePage from '@/pages/VoicePage'
import SettingsPage from '@/pages/SettingsPage'
import UpdatesPage from '@/pages/UpdatesPage'
import TaskUpdatePage from '@/pages/TaskUpdatePage'
import { useAuthStore } from '@/stores/authStore'
import { useTokenRefresh } from '@/hooks/useTokenRefresh'

interface ProtectedRouteProps {
  children: React.ReactElement
}

// Pages behind this need a logged-in user. Anyone else is sent to /login.
function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()

  // Proactively refresh the access token before it expires so the user is
  // never silently logged out when the tab is inactive.
  useTokenRefresh()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Layout>{children}</Layout>
}

// Every page that needs a login. /update/:taskId is opened by clicking a reminder notification.
const PROTECTED_PAGES = [
  { path: '/dashboard', page: <DashboardPage /> },
  { path: '/update/:taskId', page: <TaskUpdatePage /> },
  { path: '/tasks', page: <TasksPage /> },
  { path: '/voice', page: <VoicePage /> },
  { path: '/updates', page: <UpdatesPage /> },
  { path: '/settings', page: <SettingsPage /> },
]

export default function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {PROTECTED_PAGES.map(({ path, page }) => (
        <Route key={path} path={path} element={<ProtectedRoute>{page}</ProtectedRoute>} />
      ))}

      {/* Any unknown address goes to the dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

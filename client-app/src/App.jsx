import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import LoadingScreen from './components/LoadingScreen.jsx'
import BottomNav from './components/BottomNav.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import WorkoutSession from './pages/WorkoutSession.jsx'
import History from './pages/History.jsx'
import Cafeteria from './pages/Cafeteria.jsx'
import NotFound from './pages/NotFound.jsx'

function RequireAuth({ children }) {
  const { isAuthenticated, initializing } = useAuth()
  const location = useLocation()

  if (initializing) return <LoadingScreen label="Checking your session…" />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function RequireMembership({ children }) {
  const { member } = useAuth()
  if (!member?.has_active_membership) return <Navigate to="/" replace />
  return children
}

function AppShell({ children, showNav }) {
  return (
    <div className="app-shell">
      <div className="content-scroll">{children}</div>
      {showNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  const { isAuthenticated, member } = useAuth()
  const canUseDashboard = isAuthenticated && member?.has_active_membership

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell showNav={canUseDashboard}>
              <Home />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/workout/session/:sessionId"
        element={
          <RequireAuth>
            <RequireMembership>
              <WorkoutSession />
            </RequireMembership>
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <RequireMembership>
              <AppShell showNav={canUseDashboard}>
                <History />
              </AppShell>
            </RequireMembership>
          </RequireAuth>
        }
      />
      <Route
        path="/cafeteria"
        element={
          <RequireAuth>
            <RequireMembership>
              <AppShell showNav={canUseDashboard}>
                <Cafeteria />
              </AppShell>
            </RequireMembership>
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

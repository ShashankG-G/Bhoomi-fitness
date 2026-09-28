import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import StaffLayout from './components/StaffLayout.jsx'
import Login from './pages/Login.jsx'

// Scanner pulls in html5-qrcode (a sizeable camera/decoding library), so it
// and the other tabs are code-split out of the login/app-shell bundle.
const Scanner = lazy(() => import('./pages/Scanner.jsx'))
const Lookup = lazy(() => import('./pages/Lookup.jsx'))
const Cafeteria = lazy(() => import('./pages/Cafeteria.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const SuperAdmin = lazy(() => import('./pages/SuperAdmin.jsx'))

function PageLoading() {
  return <p className="hint">Loading…</p>
}

function RequireAuth({ children }) {
  const { isAuthenticated, initializing } = useAuth()
  if (initializing) return <PageLoading />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function RequireSuperAdmin({ children }) {
  const { isSuperAdmin } = useAuth()
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { isAuthenticated, initializing } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={!initializing && isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <StaffLayout />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<PageLoading />}>
              <Scanner />
            </Suspense>
          }
        />
        <Route
          path="lookup"
          element={
            <Suspense fallback={<PageLoading />}>
              <Lookup />
            </Suspense>
          }
        />
        <Route
          path="cafeteria"
          element={
            <Suspense fallback={<PageLoading />}>
              <Cafeteria />
            </Suspense>
          }
        />
        <Route
          path="reports"
          element={
            <Suspense fallback={<PageLoading />}>
              <Reports />
            </Suspense>
          }
        />
        <Route
          path="super-admin"
          element={
            <RequireSuperAdmin>
              <Suspense fallback={<PageLoading />}>
                <SuperAdmin />
              </Suspense>
            </RequireSuperAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

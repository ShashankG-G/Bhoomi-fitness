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

function PageLoading() {
  return <p className="hint">Loading…</p>
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

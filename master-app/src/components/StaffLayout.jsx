import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import BottomNav from './BottomNav.jsx'

export default function StaffLayout() {
  const { logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-mark">B</span>
          <span className="topbar-title">Bhoomi Fitness</span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={logout}
          aria-label="Log out"
        >
          Log out
        </button>
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}

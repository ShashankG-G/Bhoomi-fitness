import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import BottomNav from './BottomNav.jsx'

const ROLE_LABELS = {
  reception: 'Reception',
  trainer: 'Trainer',
  head_trainer: 'Head Trainer',
  owner: 'Owner',
}

export default function StaffLayout() {
  const { logout, staff } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-mark">B</span>
          <span className="topbar-title">Bhoomi Fitness</span>
          {staff && (
            <span className="topbar-role">
              {staff.name || staff.identifier} · {ROLE_LABELS[staff.role] || staff.role}
            </span>
          )}
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

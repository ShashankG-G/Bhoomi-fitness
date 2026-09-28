import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const BASE_TABS = [
  { to: '/', label: 'Scanner', icon: ScannerIcon, end: true },
  { to: '/lookup', label: 'Lookup', icon: LookupIcon },
  { to: '/cafeteria', label: 'Cafeteria', icon: CafeteriaIcon },
  { to: '/reports', label: 'Reports', icon: ReportsIcon },
]

const TRAINER_TAB = { to: '/personal-trainer', label: 'Trainer', icon: TrainerIcon }
const SUPER_ADMIN_TAB = { to: '/super-admin', label: 'Super Admin', icon: SuperAdminIcon }

export default function BottomNav() {
  const { isSuperAdmin, isTrainer } = useAuth()
  let tabs = BASE_TABS
  if (isTrainer) tabs = [...tabs, TRAINER_TAB]
  if (isSuperAdmin) tabs = [...tabs, SUPER_ADMIN_TAB]

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => 'bottom-nav-item' + (isActive ? ' active' : '')}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function ScannerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M4 12h16"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LookupIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CafeteriaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M5 3v7a3 3 0 0 0 3 3v8M5 3v6M7 3v6M9 3v6M17 3c-2.2 0-3 2-3 4.5S15.5 12 17 12s3-1 3-4.5S19.2 3 17 3ZM17 12v9"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v5h5M8 13h8M8 17h8M8 9h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function TrainerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 4.2l1.5-1.5M15 4.2l-1.5-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SuperAdminIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 12.2l1.8 1.8 3.2-3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

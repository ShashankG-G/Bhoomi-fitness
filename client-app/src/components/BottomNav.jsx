import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const BASE_ITEMS = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/history', label: 'History', icon: '📋' },
  { to: '/cafeteria', label: 'Cafeteria', icon: '🍽' },
]

const TRAINER_ITEM = { to: '/trainer-plan', label: 'Trainer', icon: '🏋' }

export default function BottomNav() {
  const { member } = useAuth()
  const items = member?.is_personal_training ? [...BASE_ITEMS, TRAINER_ITEM] : BASE_ITEMS

  return (
    <nav className="tab-bar">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => 'tab-bar__item' + (isActive ? ' active' : '')}
        >
          <span className="tab-bar__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

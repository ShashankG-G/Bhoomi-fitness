import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/history', label: 'History', icon: '📋' },
  { to: '/cafeteria', label: 'Cafeteria', icon: '🍽' },
]

export default function BottomNav() {
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

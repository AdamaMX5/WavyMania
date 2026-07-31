import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Waves', icon: '🌊', end: true },
  { to: '/karte', label: 'Karte', icon: '🗺️' },
  { to: '/erstellen', label: 'Erstellen', icon: '✨' },
  { to: '/marktplatz', label: 'Markt', icon: '🛍️' },
  { to: '/profil', label: 'Profil', icon: '👤' },
]

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 flex border-t border-neutral-800 bg-neutral-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive ? 'text-cyan-400' : 'text-neutral-500'
            }`
          }
        >
          <span className="text-lg leading-none">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}

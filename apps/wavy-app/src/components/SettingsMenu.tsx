import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Array-driven so future entries ("und später weitere") are a one-line add.
const ENTRIES: { to: string; label: string; icon: string }[] = [
  { to: '/profil/bearbeiten', label: 'Profil & Avatar', icon: '🧑‍🎨' },
  { to: '/profil/einstellungen', label: 'Einstellungen', icon: '⚙️' },
]

export function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profil-Einstellungen"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-700 text-lg text-neutral-300"
      >
        ⚙️
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg"
        >
          {ENTRIES.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-neutral-200 hover:bg-neutral-800"
            >
              <span>{entry.icon}</span>
              {entry.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

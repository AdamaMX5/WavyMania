import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { isOrganizer, isMerchant } from '../auth/roles'

export function TopNav() {
  const { user, logout } = useAuth()
  const showEvents = isOrganizer(user?.roles)
  const showProducts = isMerchant(user?.roles)

  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-6 py-4 backdrop-blur">
      <Link to="/" className="text-lg font-semibold text-neutral-100">
        Wavy<span className="text-cyan-400">Business</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        {showEvents && (
          <>
            <Link to="/" className="text-neutral-400 hover:text-neutral-100">
              Meine Events
            </Link>
            <Link
              to="/erstellen"
              className="rounded-lg bg-cyan-500 px-3 py-1.5 font-medium text-neutral-950 hover:bg-cyan-400"
            >
              + Neues Event
            </Link>
          </>
        )}
        {showProducts && (
          <>
            <Link to="/produkte" className="text-neutral-400 hover:text-neutral-100">
              Meine Produkte
            </Link>
            <Link
              to="/produkte/neu"
              className="rounded-lg bg-cyan-500 px-3 py-1.5 font-medium text-neutral-950 hover:bg-cyan-400"
            >
              + Neues Produkt
            </Link>
          </>
        )}
        {/* Always shown once past the Gate — both Events- and Produkte-publishing
            depend on the same Stripe Connect onboarding. */}
        <Link to="/auszahlungen" className="text-neutral-400 hover:text-neutral-100">
          Auszahlungen
        </Link>
        <span className="text-neutral-500">{user?.email}</span>
        <button type="button" onClick={() => logout()} className="text-neutral-400 underline hover:text-neutral-100">
          Abmelden
        </button>
      </nav>
    </header>
  )
}

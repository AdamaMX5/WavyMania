import { useAuth } from '../auth/AuthContext'

// Shown when a user is authenticated but their AuthService account lacks every
// role WavyBusiness gates on (`organizer` for Events, `merchant`/`creator` for
// Produkte). Role assignment is admin-only (AuthService.md: `/admin/set_roles`) —
// there is no self-service upgrade path from here.
export function NoAccessView() {
  const { user, logout } = useAuth()

  return (
    <div className="mx-auto max-w-sm space-y-3 p-6 text-center">
      <h2 className="text-lg font-semibold text-neutral-100">Kein Business-Zugang</h2>
      <p className="text-sm text-neutral-400">
        {user?.email} hat noch keine Organizer- oder Merchant-Rolle für WavyBusiness. Wende dich
        an den Support, um eine Rolle freischalten zu lassen.
      </p>
      <button type="button" onClick={() => logout()} className="text-sm text-cyan-400 underline">
        Abmelden
      </button>
    </div>
  )
}

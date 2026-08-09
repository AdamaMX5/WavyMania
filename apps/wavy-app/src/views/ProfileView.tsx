import { useAuth } from '../auth/AuthContext'
import { LoginForm } from '../auth/LoginForm'
import { useAvatar } from '../avatar/AvatarContext'
import { AvatarBadge } from '../components/AvatarBadge'
import { SettingsMenu } from '../components/SettingsMenu'

export function ProfileView() {
  const auth = useAuth()
  const { avatar } = useAvatar()

  if (auth.status === 'anon') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center p-4">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarBadge avatar={avatar} />
          <div>
            <p className="font-medium text-neutral-100">{auth.user?.email}</p>
            <p className="text-sm text-neutral-500">Level 1 · 0 XP</p>
          </div>
        </div>
        <SettingsMenu />
      </div>

      {auth.verifyEmailPending && (
        <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Meine Tickets
        </h2>
        <div className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
          Noch keine Tickets — aktive und abgelaufene Tickets erscheinen hier, sobald WavyTickets live ist.
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Meine Käufe
        </h2>
        <div className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
          Noch keine Käufe — Bestellungen aus dem Marktplatz erscheinen hier.
        </div>
      </section>

      <button
        onClick={() => auth.logout()}
        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300"
      >
        Abmelden
      </button>
    </div>
  )
}

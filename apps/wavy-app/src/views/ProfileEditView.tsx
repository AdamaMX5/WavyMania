import { useAuth } from '../auth/AuthContext'
import { LoginForm } from '../auth/LoginForm'
import { useAvatar } from '../avatar/AvatarContext'
import { AVATAR_ITEMS } from '../avatar/avatarCatalog'
import { AvatarBadge } from '../components/AvatarBadge'
import type { AvatarSlot } from '../types'

const SLOTS: AvatarSlot[] = ['head', 'outfit', 'badge']
const SLOT_LABELS: Record<AvatarSlot, string> = {
  head: 'Kopf',
  outfit: 'Outfit',
  badge: 'Abzeichen',
}

export function ProfileEditView() {
  const { status } = useAuth()
  const { avatar, loading, error, equip } = useAvatar()

  if (status !== 'authenticated') {
    return (
      <div className="p-4">
        <h1 className="mb-4 text-xl font-semibold text-neutral-100">Profil & Avatar</h1>
        <LoginForm />
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-sm text-neutral-500">Avatar wird geladen …</div>
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Profil & Avatar</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
      )}

      <div className="mb-6 flex justify-center">
        <AvatarBadge avatar={avatar} size="lg" />
      </div>

      {SLOTS.map((slot) => {
        const items = AVATAR_ITEMS.filter((item) => item.slot === slot)
        return (
          <section key={slot} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {SLOT_LABELS[slot]}
            </h2>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const unlocked = avatar.unlockedItemIds.includes(item.id)
                const isEquipped = avatar.equipped[slot] === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => equip(slot, isEquipped ? null : item.id)}
                    title={!unlocked ? (item.earnHint ?? 'Noch nicht freigeschaltet') : item.name}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      isEquipped
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                        : unlocked
                          ? 'border-neutral-700 bg-neutral-800 text-neutral-200'
                          : 'cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-600'
                    }`}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    {item.name}
                    {!unlocked && <span className="text-xs">🔒</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

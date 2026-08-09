import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Avatar, AvatarSlot } from '../types'
import { STARTER_ITEM_IDS } from './avatarCatalog'
import * as avatarClient from './avatarClient'
import { myCheckins } from '../checkin/activationClient'
import { getWave } from '../waves/waveClient'

interface AvatarContextValue {
  avatar: Avatar
  loading: boolean
  error: string | null
  equip: (slot: AvatarSlot, itemId: string | null) => void
}

const AvatarContext = createContext<AvatarContextValue | null>(null)

function emptyAvatar(): Avatar {
  return { equipped: {}, unlockedItemIds: [...STARTER_ITEM_IDS] }
}

// The brief's example ("volunteered to clean up a forest → gets an item") is
// wired to data this app already has: an ActivationService check-in at a
// Wave whose category is "help" (categoryEmoji.help is already 🌳 in
// types.ts — cleanup-style volunteering is what this codebase calls "help").
// Best-effort by design: a failure here should never block the profile page.
async function detectEarnedItemIds(accessToken: string): Promise<string[]> {
  try {
    const checkins = await myCheckins(accessToken, { limit: 50 })
    const waveIds = [...new Set(checkins.map((c) => c.waveId).filter((id): id is string => Boolean(id)))]
    const waves = await Promise.all(waveIds.map((id) => getWave(id).catch(() => null)))
    return waves.some((wave) => wave?.category === 'help') ? ['badge-waldretter'] : []
  } catch {
    return []
  }
}

// Single instance shared across every view (mounted once in App.tsx, like
// WavesProvider) — ProfileView and ProfileEditView both read the same
// state instead of each running its own fetch-and-maybe-create, which used
// to race two independent hook instances into creating two ObjectService
// documents for the same user.
export function AvatarProvider({ children }: { children: ReactNode }) {
  const { status, user, accessToken } = useAuth()
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<Avatar>(emptyAvatar)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !user || !accessToken) {
      setAvatar(emptyAvatar())
      setAvatarId(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const [existing, earnedIds] = await Promise.all([
          avatarClient.getMyAvatar(user.id, accessToken),
          detectEarnedItemIds(accessToken),
        ])
        if (cancelled) return

        const existingUnlocked = existing?.data.unlockedItemIds ?? []
        const unlockedItemIds = [...new Set([...existingUnlocked, ...STARTER_ITEM_IDS, ...earnedIds])]
        // Compare by membership, not length — a stale/duplicate id already
        // sitting in the stored array would otherwise mask a genuinely new
        // unlock (same length, different contents).
        const gainedNew = unlockedItemIds.some((id) => !existingUnlocked.includes(id))
        const next: Avatar = { equipped: existing?.data.equipped ?? {}, unlockedItemIds }

        setAvatar(next)
        setAvatarId(existing?.id ?? null)

        if (!existing) {
          const created = await avatarClient.createAvatar(user.id, next, accessToken)
          if (!cancelled) setAvatarId(created.id)
        } else if (gainedNew) {
          await avatarClient.patchAvatar(existing.id, next, accessToken)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Avatar konnte nicht geladen werden.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, user, accessToken])

  // `next` is computed from the current `avatar` value up front and setAvatar
  // is called with that plain value, not an updater function — React 18
  // StrictMode double-invokes updater functions to catch impurity, and the
  // previous version ran patchAvatar/createAvatar *inside* the updater,
  // which meant every equip click fired two requests (and, before an
  // avatarId existed yet, created two ObjectService documents).
  const equip = useCallback(
    (slot: AvatarSlot, itemId: string | null) => {
      if (!accessToken || !user) return
      if (itemId && !avatar.unlockedItemIds.includes(itemId)) return

      const equipped = { ...avatar.equipped }
      if (itemId) equipped[slot] = itemId
      else delete equipped[slot]
      const next: Avatar = { ...avatar, equipped }

      setAvatar(next)

      const persisted = avatarId
        ? avatarClient.patchAvatar(avatarId, next, accessToken)
        : avatarClient.createAvatar(user.id, next, accessToken).then((created) => {
            setAvatarId(created.id)
            return created
          })
      persisted.catch(() => setError('Speichern fehlgeschlagen.'))
    },
    [avatar, avatarId, accessToken, user],
  )

  const value = useMemo<AvatarContextValue>(
    () => ({ avatar, loading, error, equip }),
    [avatar, loading, error, equip],
  )

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
}

export function useAvatar() {
  const ctx = useContext(AvatarContext)
  if (!ctx) throw new Error('useAvatar must be used within AvatarProvider')
  return ctx
}

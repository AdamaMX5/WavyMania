import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Wave } from '../types'
import { categoryEmoji } from '../types'
import { useAuth } from '../auth/AuthContext'
import * as waveIconClient from './waveIconClient'
import { findWaveIcon } from './waveIconCatalog'

interface WaveIconsContextValue {
  // The stored icon id for a Wave, or undefined if its creator never picked
  // one (or the bulk fetch hasn't resolved yet) — used to pre-select the
  // picker in EditView.
  iconIdFor: (waveId: string) => string | undefined
  // The Wave's display emoji: the creator's chosen icon if one was set,
  // otherwise the same category-derived fallback every Wave used before this
  // feature existed (see categoryEmoji in types.ts) — so older Waves without
  // a stored icon keep looking exactly as they did.
  iconFor: (wave: Pick<Wave, 'id' | 'category'>) => string
  // Creates or updates the icon document for a Wave. Throws on failure —
  // callers decide whether that should block their own flow.
  setIcon: (waveId: string, iconId: string) => Promise<void>
}

const WaveIconsContext = createContext<WaveIconsContextValue | null>(null)

// Single instance shared across every view (mounted once in App.tsx, like
// WavesProvider) — one bulk ObjectService fetch instead of each view running
// its own.
export function WaveIconsProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth()
  // waveId -> { docId, icon (catalog id) }
  const [icons, setIcons] = useState<Map<string, { docId: string; icon: string }>>(new Map())

  useEffect(() => {
    let cancelled = false
    waveIconClient
      .listWaveIcons()
      .then((items) => {
        if (cancelled) return
        setIcons(new Map(items.map((item) => [item.waveId, { docId: item.id, icon: item.icon }])))
      })
      .catch(() => {
        // Best-effort, same as AvatarContext's detectEarnedItemIds — a failed
        // fetch just leaves every Wave on its categoryEmoji fallback rather
        // than blocking the Waves/Map views.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const iconIdFor = useCallback((waveId: string) => icons.get(waveId)?.icon, [icons])

  const iconFor = useCallback(
    (wave: Pick<Wave, 'id' | 'category'>) => findWaveIcon(icons.get(wave.id)?.icon)?.emoji ?? categoryEmoji[wave.category],
    [icons],
  )

  const setIcon = useCallback(
    async (waveId: string, iconId: string) => {
      if (!accessToken || !user) throw new Error('Bitte melde dich an, um ein Icon zu wählen.')
      const existing = icons.get(waveId)
      const saved = existing
        ? await waveIconClient.updateWaveIcon(existing.docId, iconId, accessToken)
        : await waveIconClient.createWaveIcon(waveId, user.id, iconId, accessToken)
      setIcons((prev) => new Map(prev).set(waveId, { docId: saved.id, icon: saved.icon }))
    },
    [icons, accessToken, user],
  )

  const value = useMemo<WaveIconsContextValue>(() => ({ iconIdFor, iconFor, setIcon }), [iconIdFor, iconFor, setIcon])

  return <WaveIconsContext.Provider value={value}>{children}</WaveIconsContext.Provider>
}

export function useWaveIcons() {
  const ctx = useContext(WaveIconsContext)
  if (!ctx) throw new Error('useWaveIcons must be used within WaveIconsProvider')
  return ctx
}

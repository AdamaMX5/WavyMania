import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Wave } from '../types'
import { useAuth } from '../auth/AuthContext'
import * as waveClient from './waveClient'
import type { WaveCreateInput, WavePatchInput } from './waveClient'

interface WavesContextValue {
  waves: Wave[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createWave: (input: WaveCreateInput) => Promise<Wave>
  updateWave: (id: string, input: WavePatchInput) => Promise<Wave>
  joinWave: (id: string) => Promise<void>
  leaveWave: (id: string) => Promise<void>
  shareWave: (id: string) => Promise<{ shareUrl: string; ref: string }>
}

const WavesContext = createContext<WavesContextValue | null>(null)

export function WavesProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [waves, setWaves] = useState<Wave[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // limit: 100 (the backend's max) — no pagination UI yet, so fetch as many
      // live waves as the API allows in one go rather than silently truncating at 20.
      const { items } = await waveClient.listWaves({ limit: 100 })
      setWaves(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Waves konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requireToken = useCallback(() => {
    if (!accessToken) throw new Error('Bitte melde dich an, um diese Aktion auszuführen.')
    return accessToken
  }, [accessToken])

  const value = useMemo<WavesContextValue>(
    () => ({
      waves,
      loading,
      error,
      refresh,

      createWave: async (input) => {
        const token = requireToken()
        const created = await waveClient.createWave(input, token)
        // Only an 'adhoc' Wave ("Jetzt") should go live the moment it's created — a
        // 'scheduled' one stays in `draft` (autoPublish carries it to `live` at startsAt
        // via WaveService's cron, see waveClient.ts's WaveCreateInput) so its creator can
        // still edit title/venue/capacity up until then (see EditView.tsx's isDraft branch)
        // instead of it immediately being locked to state=live's restricted PATCH fields.
        const wave = input.type === 'adhoc' ? await waveClient.publishWave(created.id, token) : created
        if (wave.state === 'live') {
          setWaves((prev) => [wave, ...prev])
        }
        return wave
      },

      updateWave: async (id, input) => {
        const token = requireToken()
        const updated = await waveClient.patchWave(id, input, token)
        setWaves((prev) => prev.map((w) => (w.id === id ? updated : w)))
        return updated
      },

      joinWave: async (id) => {
        const token = requireToken()
        await waveClient.joinWave(id, token)
        setWaves((prev) =>
          prev.map((w) => (w.id === id ? { ...w, stats: { ...w.stats, joins: w.stats.joins + 1 } } : w)),
        )
      },

      leaveWave: async (id) => {
        const token = requireToken()
        await waveClient.leaveWave(id, token)
        setWaves((prev) =>
          prev.map((w) =>
            w.id === id ? { ...w, stats: { ...w.stats, joins: Math.max(0, w.stats.joins - 1) } } : w,
          ),
        )
      },

      shareWave: async (id) => {
        const token = requireToken()
        const result = await waveClient.shareWave(id, token)
        setWaves((prev) =>
          prev.map((w) => (w.id === id ? { ...w, stats: { ...w.stats, shares: w.stats.shares + 1 } } : w)),
        )
        return result
      },
    }),
    [waves, loading, error, refresh, requireToken],
  )

  return <WavesContext.Provider value={value}>{children}</WavesContext.Provider>
}

export function useWaves() {
  const ctx = useContext(WavesContext)
  if (!ctx) throw new Error('useWaves must be used within WavesProvider')
  return ctx
}

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Wave } from '../types'
import { initialWaves } from './waves'

interface WavesContextValue {
  waves: Wave[]
  addWave: (wave: Wave) => void
  joinWave: (waveId: string) => void
  shareWave: (waveId: string) => void
}

const WavesContext = createContext<WavesContextValue | null>(null)

export function WavesProvider({ children }: { children: ReactNode }) {
  const [waves, setWaves] = useState<Wave[]>(initialWaves)

  const value = useMemo<WavesContextValue>(
    () => ({
      waves,
      addWave: (wave) => setWaves((prev) => [wave, ...prev]),
      joinWave: (waveId) =>
        setWaves((prev) =>
          prev.map((w) => (w.id === waveId ? { ...w, stats: { ...w.stats, joins: w.stats.joins + 1 } } : w)),
        ),
      shareWave: (waveId) =>
        setWaves((prev) =>
          prev.map((w) => (w.id === waveId ? { ...w, stats: { ...w.stats, shares: w.stats.shares + 1 } } : w)),
        ),
    }),
    [waves],
  )

  return <WavesContext.Provider value={value}>{children}</WavesContext.Provider>
}

export function useWaves() {
  const ctx = useContext(WavesContext)
  if (!ctx) throw new Error('useWaves must be used within WavesProvider')
  return ctx
}

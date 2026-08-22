import { useState } from 'react'
import type { Wave } from '../types'
import { useWaves } from '../waves/WavesContext'
import { useWaveIcons } from '../waves/WaveIconsContext'
import { WaveDetailSheet } from '../components/WaveDetailSheet'

const categoryLabel: Record<Wave['category'], string> = {
  event: 'Event',
  commerce: 'Commerce',
  help: 'Hilfe',
  nature: 'Natur',
  recruiting: 'Aufruf',
  culture: 'Kultur',
}

export function WavesView() {
  const { waves, loading, error } = useWaves()
  const { iconFor } = useWaveIcons()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = waves.find((w) => w.id === selectedId) ?? null

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Waves in deiner Nähe</h1>

      {loading && <p className="text-sm text-neutral-500">Waves werden geladen …</p>}
      {error && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {!loading && !error && waves.length === 0 && (
        <p className="text-sm text-neutral-500">Gerade keine live Waves in deiner Nähe.</p>
      )}

      <div className="space-y-3">
        {waves.map((wave) => (
          <button
            key={wave.id}
            onClick={() => setSelectedId(wave.id)}
            className="w-full rounded-xl bg-neutral-900 p-4 text-left transition hover:bg-neutral-800"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">{iconFor(wave)}</span>
              <div className="flex-1">
                <p className="font-medium text-neutral-100">{wave.title}</p>
                <p className="text-xs text-neutral-500">{wave.venue.name}</p>
              </div>
              {wave.state === 'live' && (
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs font-medium text-cyan-400">
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <span className="rounded-full bg-neutral-800 px-2 py-0.5">{categoryLabel[wave.category]}</span>
              <span>{wave.stats.joins} dabei</span>
            </div>
          </button>
        ))}
      </div>

      {selected && <WaveDetailSheet wave={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

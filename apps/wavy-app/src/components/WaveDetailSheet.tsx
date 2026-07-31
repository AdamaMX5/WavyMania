import type { Wave } from '../types'
import { useWaves } from '../mock/WavesContext'

const categoryLabel: Record<Wave['category'], string> = {
  event: 'Event',
  commerce: 'Commerce',
  help: 'Hilfe',
  nature: 'Natur',
  recruiting: 'Aufruf',
  culture: 'Kultur',
}

function formatWindow(wave: Wave) {
  const starts = new Date(wave.startsAt)
  const now = Date.now()
  if (wave.type === 'adhoc' && starts.getTime() <= now) {
    return 'Jetzt live'
  }
  return starts.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function WaveDetailSheet({ wave, onClose }: { wave: Wave; onClose: () => void }) {
  const { joinWave, shareWave } = useWaves()

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-neutral-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
              {categoryLabel[wave.category]}
            </span>
            <h2 className="mt-2 text-xl font-semibold text-neutral-100">
              {wave.imageEmoji} {wave.title}
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-500">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-neutral-300">{wave.description}</p>
        <div className="mb-4 space-y-1 text-sm text-neutral-400">
          <p>📍 {wave.venue.name}</p>
          <p>🕒 {formatWindow(wave)}</p>
          {wave.maxParticipants ? <p>👥 max. {wave.maxParticipants} Teilnehmer</p> : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => joinWave(wave.id)}
            className="flex-1 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950"
          >
            Beitreten ({wave.stats.joins})
          </button>
          <button
            onClick={() => shareWave(wave.id)}
            className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 font-medium text-neutral-200"
          >
            Teilen ({wave.stats.shares})
          </button>
        </div>
      </div>
    </div>
  )
}

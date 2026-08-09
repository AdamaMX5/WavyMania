import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Wave } from '../types'
import { categoryEmoji } from '../types'
import { useWaves } from '../waves/WavesContext'
import { useAuth } from '../auth/AuthContext'
import { WaveApiError } from '../waves/waveClient'

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
  const { status, user } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState<'join' | 'share' | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const isCreator = status === 'authenticated' && user?.id === wave.creatorId

  async function handleJoin() {
    if (status !== 'authenticated') {
      setFeedback('Bitte melde dich an, um beizutreten.')
      return
    }
    setPending('join')
    setFeedback(null)
    try {
      await joinWave(wave.id)
    } catch (err) {
      setFeedback(err instanceof WaveApiError ? err.message : 'Beitritt fehlgeschlagen.')
    } finally {
      setPending(null)
    }
  }

  async function handleShare() {
    if (status !== 'authenticated') {
      setFeedback('Bitte melde dich an, um zu teilen.')
      return
    }
    setPending('share')
    setFeedback(null)
    try {
      const result = await shareWave(wave.id)
      setShareUrl(result.shareUrl)
    } catch (err) {
      setFeedback(err instanceof WaveApiError ? err.message : 'Teilen fehlgeschlagen.')
    } finally {
      setPending(null)
    }
  }

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
              {categoryEmoji[wave.category]} {wave.title}
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

        {feedback && (
          <p className="mb-3 rounded-lg border border-amber-800 bg-amber-950/40 p-2 text-sm text-amber-200">
            {feedback}
          </p>
        )}
        {shareUrl && (
          <button
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            className="mb-3 w-full truncate rounded-lg border border-cyan-800 bg-cyan-950/40 p-2 text-left text-sm text-cyan-200"
          >
            🔗 {shareUrl} (antippen zum Kopieren)
          </button>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleJoin}
            disabled={pending !== null}
            className="flex-1 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            {pending === 'join' ? 'Beitreten …' : `Beitreten (${wave.stats.joins})`}
          </button>
          <button
            onClick={handleShare}
            disabled={pending !== null}
            className="flex-1 rounded-lg border border-neutral-700 px-3 py-2 font-medium text-neutral-200 disabled:opacity-50"
          >
            {pending === 'share' ? 'Teilen …' : `Teilen (${wave.stats.shares})`}
          </button>
        </div>

        {isCreator && (
          <button
            onClick={() => navigate(`/waves/${wave.id}/bearbeiten`)}
            className="mt-2 w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300"
          >
            ✏️ Wave bearbeiten
          </button>
        )}
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WaveCategory } from '../types'
import { useWaves } from '../waves/WavesContext'
import { useAuth } from '../auth/AuthContext'
import { WaveApiError } from '../waves/waveClient'
import { LoginForm } from '../auth/LoginForm'

const categories: { value: WaveCategory; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'help', label: 'Hilfe' },
  { value: 'nature', label: 'Natur' },
  { value: 'recruiting', label: 'Aufruf' },
  { value: 'culture', label: 'Kultur' },
]

// Default Berlin coordinates — used if the browser denies/lacks geolocation.
const FALLBACK_LOCATION = { lat: 52.52, lng: 13.405 }

export function CreateView() {
  const { status } = useAuth()
  const { createAndPublishWave } = useWaves()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<WaveCategory>('event')
  const [timing, setTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [venueName, setVenueName] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [maxParticipants, setMaxParticipants] = useState('')
  const [locating, setLocating] = useState(false)
  const [upsellNote, setUpsellNote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocation(FALLBACK_LOCATION)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocation(FALLBACK_LOCATION)
        setLocating(false)
      },
      { timeout: 5000 },
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const venue = { name: venueName, ...(location ?? FALLBACK_LOCATION) }
    const now = Date.now()
    const startsAt = timing === 'now' ? new Date(now).toISOString() : new Date(scheduledAt).toISOString()
    const endsAt =
      timing === 'now'
        ? new Date(now + 4 * 60 * 60 * 1000).toISOString()
        : new Date(new Date(scheduledAt).getTime() + 4 * 60 * 60 * 1000).toISOString()

    setSubmitting(true)
    try {
      await createAndPublishWave({
        title,
        description,
        category,
        type: timing === 'now' ? 'adhoc' : 'scheduled',
        venue,
        startsAt,
        endsAt,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
      })
      navigate('/')
    } catch (err) {
      setFormError(err instanceof WaveApiError ? err.message : 'Wave konnte nicht erstellt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status !== 'authenticated') {
    return (
      <div className="p-4">
        <h1 className="mb-4 text-xl font-semibold text-neutral-100">Wave erstellen</h1>
        <p className="mb-4 text-sm text-neutral-400">Melde dich an, um eine Wave zu erstellen.</p>
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Wave erstellen</h1>

      <div className="mb-4 rounded-xl border border-cyan-800 bg-cyan-950/40 p-3 text-sm text-cyan-200">
        Für Privatpersonen gedacht — spontan oder mit Termin. Tickets verkaufen, Produkte
        verknüpfen und den KI-Werbemittel-Generator nutzen geht mit einem Business-Konto.{' '}
        <button
          type="button"
          onClick={() => setUpsellNote(true)}
          className="font-medium underline"
        >
          Mehr erfahren
        </button>
        {upsellNote && (
          <p className="mt-2 text-cyan-300/80">
            Das WavyBusiness-Onboarding folgt in einer späteren Phase.
          </p>
        )}
      </div>

      {formError && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Titel</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Beschreibung</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Kategorie</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WaveCategory)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Wann?</label>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setTiming('now')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                timing === 'now' ? 'border-cyan-500 bg-neutral-800 text-cyan-300' : 'border-neutral-700 text-neutral-400'
              }`}
            >
              Jetzt
            </button>
            <button
              type="button"
              onClick={() => setTiming('scheduled')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                timing === 'scheduled' ? 'border-cyan-500 bg-neutral-800 text-cyan-300' : 'border-neutral-700 text-neutral-400'
              }`}
            >
              Datum wählen
            </button>
          </div>
          {timing === 'scheduled' && (
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Ort</label>
          <input
            required
            placeholder="z. B. Görlitzer Park"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className="mb-2 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="text-sm text-cyan-400 underline disabled:opacity-50"
          >
            {locating ? 'Ermittle Standort …' : location ? '📍 Standort erfasst' : '📍 Aktuellen Standort verwenden'}
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Max. Teilnehmer (optional)</label>
          <input
            type="number"
            min={1}
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {submitting ? 'Wird veröffentlicht …' : 'Wave veröffentlichen'}
        </button>
      </form>
    </div>
  )
}

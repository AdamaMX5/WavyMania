import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WaveCategory } from '../types'
import { useWaves } from '../waves/WavesContext'
import { useWaveIcons } from '../waves/WaveIconsContext'
import { WAVE_ICON_OPTIONS, DEFAULT_ICON_ID_BY_CATEGORY } from '../waves/waveIconCatalog'
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

// WavyBusiness is a separate app/domain (see ../../CLAUDE.md), not a backend
// service — hardcoded default, overridable via VITE_WAVY_BUSINESS_URL (root
// .env) same as the shared-platform service clients.
const WAVY_BUSINESS_URL = import.meta.env.VITE_WAVY_BUSINESS_URL || 'https://business.freischule.info'

export function CreateView() {
  const { status } = useAuth()
  const { createWave } = useWaves()
  const { setIcon } = useWaveIcons()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<WaveCategory>('event')
  const [icon, setIconChoice] = useState(DEFAULT_ICON_ID_BY_CATEGORY.event)
  const [timing, setTiming] = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [venueName, setVenueName] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [maxParticipants, setMaxParticipants] = useState('')
  // Tracks whether the creator has touched the icon picker themselves — until
  // then, changing the category keeps the icon in sync with it (see categories
  // select's onChange below), matching the pre-picker behavior where the icon
  // was purely derived from category.
  const [iconTouched, setIconTouched] = useState(false)
  const [locating, setLocating] = useState(false)
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
      const wave = await createWave({
        title,
        description,
        category,
        type: timing === 'now' ? 'adhoc' : 'scheduled',
        venue,
        startsAt,
        endsAt,
        // See WavesContext.tsx's createWave: only 'scheduled' needs this — 'adhoc' is
        // published immediately instead, regardless of this flag.
        autoPublish: timing === 'scheduled',
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
      })
      // Best-effort, same as AvatarContext's equip: the Wave itself is already
      // saved at this point, so a failed icon write shouldn't block navigation —
      // it just leaves the Wave on its categoryEmoji fallback (see WaveIconsContext).
      await setIcon(wave.id, icon).catch(() => {})
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
            onChange={(e) => {
              const next = e.target.value as WaveCategory
              setCategory(next)
              if (!iconTouched) setIconChoice(DEFAULT_ICON_ID_BY_CATEGORY[next])
            }}
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
          <label className="mb-1 block text-sm text-neutral-400">Icon</label>
          <div className="grid grid-cols-8 gap-1.5">
            {WAVE_ICON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.label}
                aria-label={opt.label}
                aria-pressed={icon === opt.id}
                onClick={() => {
                  setIconChoice(opt.id)
                  setIconTouched(true)
                }}
                className={`flex aspect-square items-center justify-center rounded-lg border text-xl ${
                  icon === opt.id ? 'border-cyan-500 bg-neutral-800' : 'border-neutral-700 bg-neutral-900'
                }`}
              >
                {opt.emoji}
              </button>
            ))}
          </div>
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
            <>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Die Wave wird erst zum gewählten Zeitpunkt live — bis dahin kannst du sie noch vollständig bearbeiten.
              </p>
            </>
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
          {submitting
            ? timing === 'now'
              ? 'Wird veröffentlicht …'
              : 'Wird geplant …'
            : timing === 'now'
              ? 'Wave veröffentlichen'
              : 'Wave planen'}
        </button>

        <a
          href={WAVY_BUSINESS_URL}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-sm text-cyan-400 underline"
        >
          Unternehmerkonto erstellen
        </a>
      </form>
    </div>
  )
}

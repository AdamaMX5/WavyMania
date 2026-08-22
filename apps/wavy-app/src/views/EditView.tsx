import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Wave } from '../types'
import { useAuth } from '../auth/AuthContext'
import { useWaves } from '../waves/WavesContext'
import { useWaveIcons } from '../waves/WaveIconsContext'
import { WAVE_ICON_OPTIONS, DEFAULT_ICON_ID_BY_CATEGORY } from '../waves/waveIconCatalog'
import { getWave, WaveApiError } from '../waves/waveClient'
import { LoginForm } from '../auth/LoginForm'

// <input type="datetime-local"> reads/writes local time, but Wave.endsAt is a UTC
// ISO string — converting via .slice(0, 16) alone would silently shift the value
// by the browser's timezone offset every time the form is opened and re-saved.
function toLocalDatetimeInputValue(isoString: string) {
  const date = new Date(isoString)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

export function EditView() {
  const { id } = useParams<{ id: string }>()
  const { status, accessToken, user } = useAuth()
  const { updateWave } = useWaves()
  const { iconIdFor, setIcon } = useWaveIcons()
  const navigate = useNavigate()

  const [wave, setWave] = useState<Wave | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [venueName, setVenueName] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [icon, setIconChoice] = useState('')
  // Guards against WaveIconsContext's bulk fetch (still in flight when this view
  // mounts — see its "Best-effort" comment) overwriting a choice the creator
  // already made in this session, once it resolves.
  const iconInitialized = useRef(false)

  useEffect(() => {
    if (!id || status !== 'authenticated') return
    setLoading(true)
    setLoadError(null)
    getWave(id, accessToken ?? undefined)
      .then((w) => {
        setWave(w)
        setTitle(w.title)
        setDescription(w.description)
        setVenueName(w.venue.name)
        setEndsAt(toLocalDatetimeInputValue(w.endsAt))
        setMaxParticipants(w.maxParticipants ? String(w.maxParticipants) : '')
        // Seed a category-based default right away so the picker never renders
        // empty — the effect below overwrites it with the actually-stored icon
        // once/if WaveIconsContext's bulk fetch has resolved by then.
        setIconChoice(iconIdFor(w.id) ?? DEFAULT_ICON_ID_BY_CATEGORY[w.category])
      })
      .catch((err) => setLoadError(err instanceof WaveApiError ? err.message : 'Wave konnte nicht geladen werden.'))
      .finally(() => setLoading(false))
    // iconIdFor intentionally excluded — this seed should only run once per
    // loaded Wave (id/status/accessToken change), not every time the icon map
    // resolves; see the dedicated sync effect below for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, status, accessToken])

  useEffect(() => {
    if (!wave || iconInitialized.current) return
    const stored = iconIdFor(wave.id)
    if (stored) {
      setIconChoice(stored)
      iconInitialized.current = true
    }
  }, [wave, iconIdFor])

  if (status !== 'authenticated') {
    return (
      <div className="p-4">
        <h1 className="mb-4 text-xl font-semibold text-neutral-100">Wave bearbeiten</h1>
        <p className="mb-4 text-sm text-neutral-400">Melde dich an, um diese Wave zu bearbeiten.</p>
        <LoginForm />
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-sm text-neutral-500">Wave wird geladen …</div>
  }

  if (loadError || !wave) {
    return (
      <div className="p-4">
        <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {loadError ?? 'Wave nicht gefunden.'}
        </p>
      </div>
    )
  }

  if (wave.creatorId !== user?.id) {
    return (
      <div className="p-4">
        <p className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          Nur die Ersteller:in kann diese Wave bearbeiten.
        </p>
      </div>
    )
  }

  if (wave.state === 'completed' || wave.state === 'cancelled') {
    return (
      <div className="p-4">
        <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-400">
          Diese Wave ist bereits {wave.state === 'completed' ? 'abgeschlossen' : 'storniert'} und kann nicht mehr
          bearbeitet werden.
        </p>
      </div>
    )
  }

  const isDraft = wave.state === 'draft'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setSaving(true)
    try {
      if (isDraft) {
        await updateWave(wave.id, {
          title,
          description,
          // Don't invent coordinates for a venue that never had any — buildVenue on
          // the backend accepts { name } alone and leaves lat/lng/h3Cell untouched.
          venue:
            wave.venue.lat !== undefined && wave.venue.lng !== undefined
              ? { name: venueName, lat: wave.venue.lat, lng: wave.venue.lng }
              : { name: venueName },
          endsAt: new Date(endsAt).toISOString(),
          maxParticipants: maxParticipants ? Number(maxParticipants) : 0,
        })
      } else {
        // live: backend only allows description/mediaIds/endsAt to change.
        await updateWave(wave.id, {
          description,
          endsAt: new Date(endsAt).toISOString(),
        })
      }
      // Independent of WaveService's own state — a live Wave's icon can still
      // change even though its title/venue/etc. are locked (see WaveIconsContext).
      await setIcon(wave.id, icon)
      navigate('/')
    } catch (err) {
      setSaveError(err instanceof WaveApiError ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Wave bearbeiten</h1>

      {!isDraft && (
        <p className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-400">
          Diese Wave ist bereits live — nur Beschreibung und Enddatum lassen sich noch ändern.
        </p>
      )}
      {saveError && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{saveError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isDraft && (
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Titel</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>
        )}

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
                  iconInitialized.current = true
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
          <label className="mb-1 block text-sm text-neutral-400">Beschreibung</label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        {isDraft && (
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Ort</label>
            <input
              required
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Ende</label>
          <input
            type="datetime-local"
            required
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        {isDraft && (
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
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {saving ? 'Speichert …' : 'Änderungen speichern'}
        </button>
      </form>
    </div>
  )
}

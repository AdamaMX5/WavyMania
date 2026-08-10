import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEvents } from './EventsContext'
import { EventApiError } from './eventClient'
import { TierEditor, emptyTierRow, type TierRow } from './TierEditor'

// Default Berlin coordinates — used if the browser denies/lacks geolocation.
const FALLBACK_LOCATION = { lat: 52.52, lng: 13.405 }

export function CreateEventView() {
  const { createEvent } = useEvents()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [startsAt, setStartsAt] = useState('')
  const [doorsAt, setDoorsAt] = useState('')
  const [tiers, setTiers] = useState<TierRow[]>([emptyTierRow()])
  const [resaleAllowed, setResaleAllowed] = useState(true)
  const [maxMarkupPercent, setMaxMarkupPercent] = useState('0')
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

    const validTiers = tiers.filter((tier) => tier.name && tier.price && tier.capacity)
    const submittedTiers = validTiers.map((tier) => ({
      name: tier.name,
      priceCents: Math.round(Number(tier.price) * 100),
      capacity: Number(tier.capacity),
    }))

    setSubmitting(true)
    try {
      const created = await createEvent({
        title,
        description,
        // Only fall back to Berlin coordinates if the organizer actually
        // tried to capture a location (denied/unavailable) — never if they
        // simply left the optional button untouched (venue.lat/lng are
        // optional server-side; omitting them beats guessing wrong).
        venue: { name: venueName, address: venueAddress, ...(location ?? {}) },
        startsAt: new Date(startsAt).toISOString(),
        doorsAt: doorsAt ? new Date(doorsAt).toISOString() : undefined,
        tiers: submittedTiers,
        resalePolicy: { allowed: resaleAllowed, maxMarkupBps: Math.round(Number(maxMarkupPercent) * 100) },
      })
      navigate(`/events/${created.id}`)
    } catch (err) {
      setFormError(err instanceof EventApiError ? err.message : 'Event konnte nicht erstellt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Event erstellen</h1>
      <p className="mb-4 text-sm text-neutral-400">
        Wird zunächst als Entwurf angelegt — Ticket-Tiers können auch später noch ergänzt werden,
        bevor du veröffentlichst.
      </p>

      {formError && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{formError}</p>
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
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Beginn</label>
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-400">Einlass (optional)</label>
            <input
              type="datetime-local"
              value={doorsAt}
              onChange={(e) => setDoorsAt(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Ort</label>
          <input
            placeholder="Name der Location"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className="mb-2 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
          <input
            placeholder="Adresse"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
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
          <label className="mb-2 block text-sm text-neutral-400">Ticket-Tiers</label>
          <TierEditor tiers={tiers} onChange={setTiers} mode="editable" />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Zweitmarkt</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                checked={resaleAllowed}
                onChange={(e) => setResaleAllowed(e.target.checked)}
              />
              Weiterverkauf erlauben
            </label>
            {resaleAllowed && (
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                max. Aufschlag
                <input
                  type="number"
                  min={0}
                  value={maxMarkupPercent}
                  onChange={(e) => setMaxMarkupPercent(e.target.value)}
                  className="w-20 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1 text-neutral-100 outline-none focus:border-cyan-500"
                />
                %
              </label>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {submitting ? 'Wird angelegt …' : 'Als Entwurf anlegen'}
        </button>
      </form>
    </div>
  )
}

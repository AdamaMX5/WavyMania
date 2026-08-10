import { useEffect, useState, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useEvents } from './EventsContext'
import { useAuth } from '../auth/AuthContext'
import { EventApiError, getEventStats, scanTicket } from './eventClient'
import type { EventStats } from '../types'
import { formatPrice } from '../lib/format'
import { TicketScanner } from '../scan/TicketScanner'
import { TierEditor, tierRowFrom, type TierRow } from './TierEditor'

// `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm" in local time, not
// the ISO string (UTC, with seconds/zone) the API returns.
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATE_LABEL: Record<string, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  cancelled: 'Storniert',
  completed: 'Abgeschlossen',
}

export function EventDetailView() {
  const { id = '' } = useParams()
  const { accessToken } = useAuth()
  const { events, updateEvent, publishEvent, cancelEvent, loading } = useEvents()
  const event = events.find((e) => e.id === id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [venueName, setVenueName] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [doorsAt, setDoorsAt] = useState('')
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [resaleAllowed, setResaleAllowed] = useState(true)
  const [maxMarkupPercent, setMaxMarkupPercent] = useState('0')

  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const [stats, setStats] = useState<EventStats | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!event) return
    setTitle(event.title)
    setDescription(event.description)
    setVenueName(event.venue.name ?? '')
    setVenueAddress(event.venue.address ?? '')
    setStartsAt(toLocalInput(event.startsAt))
    setDoorsAt(event.doorsAt ? toLocalInput(event.doorsAt) : '')
    setTiers(event.tiers.map(tierRowFrom))
    setResaleAllowed(event.resalePolicy.allowed)
    setMaxMarkupPercent(String(event.resalePolicy.maxMarkupBps / 100))
    // Only re-sync from the server object when navigating to a different
    // event — not on every context update, or in-progress edits would be
    // clobbered each time `events` is replaced by refresh()/other mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  useEffect(() => {
    // Reset on every event switch so a slow response for the previously
    // viewed event can never render under the newly opened one.
    setStats(null)
    setStatsError(null)
    if (!event || !accessToken) return
    if (event.state !== 'published' && event.state !== 'completed') return

    let ignore = false
    getEventStats(event.id, accessToken)
      .then((result) => {
        if (!ignore) setStats(result)
      })
      .catch((err) => {
        if (!ignore) setStatsError(err instanceof EventApiError ? err.message : 'Statistik konnte nicht geladen werden.')
      })
    return () => {
      ignore = true
    }
  }, [event?.id, event?.state, accessToken])

  if (loading && !event) return <p className="p-6 text-sm text-neutral-400">Lade Event …</p>
  if (!event) {
    return (
      <p className="p-6 text-sm text-neutral-400">
        Event nicht gefunden. <Link to="/" className="text-cyan-400 underline">Zurück zur Liste</Link>
      </p>
    )
  }

  const isDraft = event.state === 'draft'
  const isPublished = event.state === 'published'
  const canEdit = isDraft || isPublished

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setActionError(null)
    setActionMessage(null)
    setSaving(true)
    try {
      if (isDraft) {
        const validTiers = tiers.filter((tier) => tier.name && tier.price && tier.capacity)
        await updateEvent(event.id, {
          title,
          description,
          venue: { name: venueName, address: venueAddress, lat: event.venue.lat, lng: event.venue.lng },
          startsAt: new Date(startsAt).toISOString(),
          doorsAt: doorsAt ? new Date(doorsAt).toISOString() : null,
          tiers: validTiers.map((tier) => ({
            tierId: tier.tierId,
            name: tier.name,
            priceCents: Math.round(Number(tier.price) * 100),
            capacity: Number(tier.capacity),
          })),
          resalePolicy: { allowed: resaleAllowed, maxMarkupBps: Math.round(Number(maxMarkupPercent) * 100) },
        })
      } else {
        await updateEvent(event.id, {
          description,
          tiers: tiers
            .filter((tier) => tier.tierId)
            .map((tier) => ({ tierId: tier.tierId, capacity: Number(tier.capacity) })),
        })
      }
      setActionMessage('Gespeichert.')
    } catch (err) {
      setActionError(err instanceof EventApiError ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setActionError(null)
    setActionMessage(null)
    setPublishing(true)
    try {
      await publishEvent(event.id)
      setActionMessage('Event veröffentlicht.')
    } catch (err) {
      setActionError(err instanceof EventApiError ? err.message : 'Veröffentlichen fehlgeschlagen.')
    } finally {
      setPublishing(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Event stornieren? Bereits bezahlte Tickets werden automatisch erstattet.')) return
    setActionError(null)
    setActionMessage(null)
    setCancelling(true)
    try {
      const result = await cancelEvent(event.id)
      setActionMessage(`Storniert — ${result.refundsRequested} Erstattung(en) angestoßen.`)
    } catch (err) {
      setActionError(err instanceof EventApiError ? err.message : 'Stornieren fehlgeschlagen.')
    } finally {
      setCancelling(false)
    }
  }

  const handleScan = async (qrPayload: string) => {
    if (!accessToken) return
    setScanMessage(null)
    try {
      const result = await scanTicket(event.id, qrPayload, accessToken)
      setScanMessage(`Eingecheckt · Ticket ${result.ticketId.slice(-6)} um ${new Date(result.checkedInAt).toLocaleTimeString('de-DE')}`)
    } catch (err) {
      if (err instanceof EventApiError && err.status === 409) {
        const checkedInAt = err.details?.checkedInAt
        setScanMessage(
          `Bereits eingecheckt${checkedInAt ? ` um ${new Date(String(checkedInAt)).toLocaleTimeString('de-DE')}` : ''}.`,
        )
      } else if (err instanceof EventApiError) {
        setScanMessage(err.message)
      } else {
        setScanMessage('Scan fehlgeschlagen.')
      }
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">{event.title}</h1>
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
          {STATE_LABEL[event.state]}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {isDraft && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing || event.tiers.length === 0}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            title={event.tiers.length === 0 ? 'Mindestens ein Tier ist nötig' : undefined}
          >
            {publishing ? 'Veröffentliche …' : 'Veröffentlichen'}
          </button>
        )}
        {(isDraft || isPublished) && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 disabled:opacity-50"
          >
            {cancelling ? 'Storniere …' : 'Stornieren'}
          </button>
        )}
        {isPublished && (
          <button
            type="button"
            onClick={() => {
              setScanMessage(null)
              setScanning(true)
            }}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200"
          >
            Einlass scannen
          </button>
        )}
      </div>

      {actionMessage && (
        <p className="mb-4 rounded-lg border border-cyan-900 bg-cyan-950/40 p-3 text-sm text-cyan-200">{actionMessage}</p>
      )}
      {actionError && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{actionError}</p>
      )}

      {(isPublished || event.state === 'completed') && (
        <div className="mb-6 rounded-xl border border-neutral-800 p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-200">Statistik</h2>
          {statsError && <p className="text-sm text-red-300">{statsError}</p>}
          {!statsError && !stats && <p className="text-sm text-neutral-400">Lade Statistik …</p>}
          {stats && (
            <table className="w-full text-sm text-neutral-300">
              <thead>
                <tr className="text-left text-neutral-500">
                  <th className="pb-1 font-normal">Tier</th>
                  <th className="pb-1 font-normal">Verkauft</th>
                  <th className="pb-1 font-normal">Eingecheckt</th>
                  <th className="pb-1 font-normal">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {stats.tiers.map((tierStat) => {
                  const tier = event.tiers.find((t) => t.tierId === tierStat.tierId)
                  return (
                    <tr key={tierStat.tierId} className="border-t border-neutral-800">
                      <td className="py-1">{tier?.name ?? tierStat.tierId}</td>
                      <td className="py-1">{tierStat.sold}</td>
                      <td className="py-1">{tierStat.checkedIn}</td>
                      <td className="py-1">{formatPrice(tierStat.revenueCents, 'EUR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {canEdit ? (
        <form onSubmit={handleSave} className="space-y-4">
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
            <label className="mb-1 block text-sm text-neutral-400">Beschreibung</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>

          {isDraft && (
            <>
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
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-2 block text-sm text-neutral-400">
              Ticket-Tiers {isPublished && '(nur Kapazität erhöhbar)'}
            </label>
            <TierEditor
              tiers={tiers}
              onChange={setTiers}
              mode={isPublished ? 'published' : 'editable'}
              minCapacityByTierId={
                isPublished
                  ? Object.fromEntries(event.tiers.map((tier) => [tier.tierId, tier.capacity]))
                  : undefined
              }
            />
          </div>

          {isDraft && (
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
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-neutral-800 px-4 py-2 font-medium text-neutral-100 disabled:opacity-50"
          >
            {saving ? 'Speichere …' : 'Speichern'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-neutral-400">{event.description}</p>
      )}

      {scanning && (
        <TicketScanner
          onClose={() => setScanning(false)}
          onDetect={(payload) => {
            handleScan(payload).finally(() => setScanning(false))
          }}
        />
      )}
      {scanMessage && !scanning && (
        <p className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-200">
          {scanMessage}
        </p>
      )}
    </div>
  )
}

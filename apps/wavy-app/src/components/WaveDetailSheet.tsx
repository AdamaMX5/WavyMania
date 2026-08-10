import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TicketEvent, Wave } from '../types'
import { categoryEmoji } from '../types'
import { useWaves } from '../waves/WavesContext'
import { useAuth } from '../auth/AuthContext'
import { WaveApiError } from '../waves/waveClient'
import { useTickets } from '../ticket/TicketContext'
import { getEvent, TicketApiError } from '../ticket/ticketClient'
import { formatPrice } from '../lib/format'

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
  const { buyTicket } = useTickets()
  const navigate = useNavigate()
  const [pending, setPending] = useState<'join' | 'share' | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const [ticketEvent, setTicketEvent] = useState<TicketEvent | null>(null)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [guestEmail, setGuestEmail] = useState('')
  const [buyingTicket, setBuyingTicket] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)

  const isCreator = status === 'authenticated' && user?.id === wave.creatorId

  // Best-effort: a 404 (event no longer publicly listed) or network failure just leaves
  // ticketEvent null and hides the ticket section entirely, rather than erroring the whole
  // sheet — same pattern TicketContext already uses for its own event lookups.
  useEffect(() => {
    if (!wave.linkedTicketEventId) {
      setTicketEvent(null)
      return
    }
    let cancelled = false
    getEvent(wave.linkedTicketEventId)
      .then((event) => {
        if (!cancelled) setTicketEvent(event)
      })
      .catch(() => {
        if (!cancelled) setTicketEvent(null)
      })
    return () => {
      cancelled = true
    }
  }, [wave.linkedTicketEventId])

  // Auto-select the first tier that still has capacity once the event loads.
  useEffect(() => {
    if (!ticketEvent || selectedTierId) return
    const firstAvailable = ticketEvent.tiers.find((t) => t.available > 0)
    if (firstAvailable) setSelectedTierId(firstAvailable.tierId)
  }, [ticketEvent, selectedTierId])

  // Maps the handful of documented purchase.js error responses (see TicketService.md) to
  // German copy — anything unmapped falls back to a generic message rather than surfacing
  // the raw English backend string.
  function describeBuyError(err: unknown): string {
    if (err instanceof TicketApiError) {
      if (err.status === 409) return 'Dieser Tarif ist gerade ausverkauft.'
      if (err.status === 404) return 'Dieses Ticket-Angebot ist nicht mehr verfügbar.'
    }
    return 'Ticketkauf fehlgeschlagen.'
  }

  async function handleBuyTicket(e?: FormEvent) {
    e?.preventDefault()
    if (!ticketEvent || !selectedTierId) return
    setBuyingTicket(true)
    setTicketError(null)
    try {
      const result = await buyTicket(ticketEvent.id, {
        tierId: selectedTierId,
        ...(status !== 'authenticated' ? { email: guestEmail } : {}),
      })
      // Same rationale as ProductDetailSheet.handleBuy: checkoutUrl is a server response
      // driving navigation, worth a scheme check even though it's first-party data.
      const url = new URL(result.checkoutUrl)
      if (url.protocol !== 'https:') throw new Error('Ungültige Checkout-URL erhalten.')
      window.location.href = url.href
    } catch (err) {
      setTicketError(describeBuyError(err))
      setBuyingTicket(false)
    }
  }

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

        {ticketEvent && ticketEvent.state === 'published' && (
          <form
            onSubmit={handleBuyTicket}
            className="mb-4 rounded-lg border border-neutral-800 bg-neutral-950/50 p-3"
          >
            <p className="mb-2 text-sm font-medium text-neutral-200">🎫 Tickets</p>
            <div className="space-y-1">
              {ticketEvent.tiers.map((tier) => {
                const soldOut = tier.available <= 0
                const selected = selectedTierId === tier.tierId
                return (
                  <button
                    key={tier.tierId}
                    type="button"
                    disabled={soldOut}
                    onClick={() => setSelectedTierId(tier.tierId)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-40 ${
                      selected ? 'border-cyan-500 bg-cyan-950/30' : 'border-neutral-700'
                    }`}
                  >
                    <span className="text-neutral-200">
                      {tier.name}
                      {soldOut ? ' · Ausverkauft' : ''}
                    </span>
                    {/* TicketService's Event has no currency field of its own — PaymentService
                        only supports 'eur' for now, same simplification Order/Product already
                        rely on (see ProfileView.tsx). */}
                    <span className="text-neutral-400">{formatPrice(tier.priceCents, 'EUR')}</span>
                  </button>
                )
              })}
            </div>

            {status !== 'authenticated' && (
              <input
                type="email"
                required
                placeholder="E-Mail für den Ticketkauf"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500"
              />
            )}

            {ticketError && <p className="mt-2 text-xs text-red-300">{ticketError}</p>}

            <button
              type="submit"
              disabled={
                !selectedTierId ||
                buyingTicket ||
                (status !== 'authenticated' && !guestEmail) ||
                ticketEvent.tiers.every((t) => t.available <= 0)
              }
              className="mt-2 w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
            >
              {buyingTicket
                ? 'Wird gekauft …'
                : ticketEvent.tiers.every((t) => t.available <= 0)
                  ? 'Ausverkauft'
                  : 'Ticket kaufen'}
            </button>
          </form>
        )}
        {ticketEvent && ticketEvent.state !== 'published' && (
          <p className="mb-4 text-sm text-neutral-500">
            {ticketEvent.state === 'cancelled' ? '🎫 Dieses Event wurde abgesagt.' : '🎫 Der Ticketverkauf ist beendet.'}
          </p>
        )}

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

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Ticket, TicketEvent } from '../types'
import { useAuth } from '../auth/AuthContext'
import * as ticketClient from './ticketClient'
import type { BuyTicketInput, BuyTicketResult } from './ticketClient'
import { saveClaimToken } from './claimTokenStore'

interface TicketContextValue {
  tickets: Ticket[]
  loading: boolean
  // Keyed by eventId, populated automatically whenever `tickets` changes
  // (see the effect below). Missing key = not fetched yet; `null` = fetched
  // but the event is no longer publicly visible (draft/deleted).
  events: Record<string, TicketEvent | null>
  // Works both logged-in (JWT, no email needed) and as a guest (email required, no JWT) —
  // see BuyTicketInput. Callers (WaveDetailSheet) own the actual checkoutUrl redirect, same
  // division of labor as MarketContext.buy + ProductDetailSheet.
  buyTicket: (eventId: string, input: BuyTicketInput) => Promise<BuyTicketResult>
}

const TicketContext = createContext<TicketContextValue | null>(null)

export function TicketProvider({ children }: { children: ReactNode }) {
  const { status, accessToken } = useAuth()
  const isAuthenticated = status === 'authenticated'
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Record<string, TicketEvent | null>>({})

  // Auth-driven load, guarded against a stale response landing after a newer
  // run already reset state — same `cancelled` pattern as MarketContext's
  // myOrders effect.
  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      setTickets([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ticketClient
      .myTickets(accessToken, { limit: 50 })
      .then(({ items }) => {
        if (!cancelled) setTickets(items)
      })
      .catch(() => {
        // "Meine Tickets" degrades to empty rather than blocking the profile page.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [status, accessToken])

  // Fetches the (public, unauthenticated) event details for every ticket's
  // eventId once tickets are loaded — batched per unique id, not per ticket,
  // since a user can hold several tickets to the same event.
  useEffect(() => {
    const uniqueIds = [...new Set(tickets.map((t) => t.eventId))]
    const missing = uniqueIds.filter((id) => !(id in events))
    if (missing.length === 0) return
    let cancelled = false
    missing.forEach((eventId) => {
      ticketClient
        .getEvent(eventId)
        .then((event) => {
          if (!cancelled) setEvents((prev) => ({ ...prev, [eventId]: event }))
        })
        .catch(() => {
          if (!cancelled) setEvents((prev) => ({ ...prev, [eventId]: null }))
        })
    })
    return () => {
      cancelled = true
    }
    // `events` is deliberately omitted below: it's read only to compute
    // `missing`, and including it would refire this effect on every fetch it
    // itself triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets])

  const buyTicket = async (eventId: string, input: BuyTicketInput): Promise<BuyTicketResult> => {
    const result = await ticketClient.buyTicket(eventId, input, isAuthenticated ? accessToken ?? undefined : undefined)
    // claimToken only ever accompanies a fresh guest signup (see BuyTicketResult) — persist
    // it on-device now, since the browser is about to leave for Stripe and this response
    // won't be seen again.
    if (result.claimToken && input.email) {
      saveClaimToken(result.ticketId, result.claimToken, input.email)
    }
    return result
  }

  const value = useMemo<TicketContextValue>(
    // accessToken/isAuthenticated must stay in the dep list even though they're not read
    // directly in this object literal — buyTicket closes over them, and omitting them would
    // let a token refresh (accessToken changes, tickets/loading/events don't) leave the
    // memoized value holding a buyTicket closure over the stale token.
    () => ({ tickets, loading, events, buyTicket }),
    [tickets, loading, events, isAuthenticated, accessToken],
  )

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>
}

export function useTickets() {
  const ctx = useContext(TicketContext)
  if (!ctx) throw new Error('useTickets must be used within TicketProvider')
  return ctx
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Ticket, TicketEvent } from '../types'
import { useAuth } from '../auth/AuthContext'
import * as ticketClient from './ticketClient'

interface TicketContextValue {
  tickets: Ticket[]
  loading: boolean
  // Keyed by eventId, populated automatically whenever `tickets` changes
  // (see the effect below). Missing key = not fetched yet; `null` = fetched
  // but the event is no longer publicly visible (draft/deleted).
  events: Record<string, TicketEvent | null>
}

const TicketContext = createContext<TicketContextValue | null>(null)

export function TicketProvider({ children }: { children: ReactNode }) {
  const { status, accessToken } = useAuth()
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

  const value = useMemo<TicketContextValue>(() => ({ tickets, loading, events }), [tickets, loading, events])

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>
}

export function useTickets() {
  const ctx = useContext(TicketContext)
  if (!ctx) throw new Error('useTickets must be used within TicketProvider')
  return ctx
}

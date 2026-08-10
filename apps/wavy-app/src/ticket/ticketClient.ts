import type { Ticket, TicketEvent } from '../types'

// TicketService isn't deployed under a stable `ticket.<wavy-domain>` URL yet
// (see TicketService.md), so like waveClient.ts/geoClient.ts/marketClient.ts
// this is configurable. In dev it defaults to /api/ticket, proxied by Vite to
// a local TicketService instance (see vite.config.ts) — TicketService itself
// sends no CORS headers by design (CORS is handled at the NGINX layer in
// production).
const TICKET_BASE_URL = import.meta.env.VITE_TICKET_SERVICE_URL || '/api/ticket'

export class TicketApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'TicketApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${TICKET_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      // Spread last so a caller-supplied `headers` object can never shadow
      // the auth header — same construction as marketClient.ts's request().
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error ?? message
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new TicketApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
}

export function myTickets(accessToken: string, params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<Page<Ticket>>(`/me/tickets${qs ? `?${qs}` : ''}`, { accessToken })
}

// Public endpoint (no auth) — used purely to label a ticket with its event
// title/venue. 404 (event no longer publicly listed, e.g. draft) is handled
// by callers falling back to a generic label rather than surfacing an error.
export function getEvent(eventId: string): Promise<TicketEvent> {
  return request<TicketEvent>(`/events/${encodeURIComponent(eventId)}`)
}

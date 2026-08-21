import type { EventState, EventStats, OrganizerEvent } from '../types'
import { fetchWithRefresh } from '../lib/apiRequest'

// TicketService is now deployed under a stable domain, same as wavy-app's
// ticketClient.ts — hardcoded default, overridable via
// VITE_TICKET_SERVICE_URL (root .env). Set that var to /api/ticket for local
// dev against a local TicketService instance, proxied by Vite (see
// vite.config.ts) — TicketService itself sends no CORS headers by design
// (CORS is handled at the NGINX layer in production).
const TICKET_BASE_URL = import.meta.env.VITE_TICKET_SERVICE_URL || 'https://ticket.freischule.info'

export class EventApiError extends Error {
  status: number
  // Extra fields the server attached to the error body (e.g. `checkedInAt`
  // on a 409 from /scan) — see TicketService's errorHandler.js, which spreads
  // ApiError#details alongside `error` in the JSON response.
  details?: Record<string, unknown>
  constructor(message: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'EventApiError'
    this.status = status
    this.details = details
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetchWithRefresh(`${TICKET_BASE_URL}${path}`, { accessToken, headers, ...init })

  if (!res.ok) {
    let message = res.statusText
    let details: Record<string, unknown> | undefined
    try {
      const body = await res.json()
      const { error, ...rest } = body ?? {}
      message = error ?? message
      if (Object.keys(rest).length) details = rest
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new EventApiError(message, res.status, details)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
  pages: number
}

export function myEvents(
  accessToken: string,
  params: { state?: EventState; page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams()
  if (params.state) query.set('state', params.state)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<Page<OrganizerEvent>>(`/me/events${qs ? `?${qs}` : ''}`, { accessToken })
}

export interface EventTierInput {
  tierId?: string
  name: string
  priceCents: number
  capacity: number
}

export interface EventInput {
  title: string
  description?: string
  venue?: { name?: string; address?: string; lat?: number; lng?: number }
  startsAt: string
  doorsAt?: string | null
  tiers?: EventTierInput[]
  resalePolicy?: { allowed: boolean; maxMarkupBps: number }
}

export function createEvent(input: EventInput, accessToken: string) {
  return request<OrganizerEvent>('/events', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken,
  })
}

// A published event may only grow a tier's capacity — name/priceCents are
// fixed once tickets are on sale (see TicketService's applyPublishedPatch) —
// so the patch shape allows a bare `{ tierId, capacity }`, unlike the create
// shape's required name/priceCents.
export interface EventTierPatchInput {
  tierId?: string
  name?: string
  priceCents?: number
  capacity?: number
}

// Draft: any of EventInput's fields. Published: only `description`, `mediaIds`
// and tier `capacity` increases (see TicketService's applyPublishedPatch) —
// the caller is responsible for only sending what's allowed for the event's
// current state.
export type EventPatchInput = Omit<Partial<EventInput>, 'tiers'> & {
  mediaIds?: string[]
  tiers?: EventTierPatchInput[]
}

export function patchEvent(id: string, input: EventPatchInput, accessToken: string) {
  return request<OrganizerEvent>(`/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken,
  })
}

export function publishEvent(id: string, accessToken: string) {
  return request<OrganizerEvent>(`/events/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    accessToken,
  })
}

export interface CancelEventResult {
  status: 'cancelled'
  refundsRequested: number
}

export function cancelEvent(id: string, accessToken: string) {
  return request<CancelEventResult>(`/events/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    accessToken,
  })
}

export interface ScanResult {
  status: 'checkedIn'
  ticketId: string
  checkedInAt: string
}

// A 409 (already checked in) still carries `checkedInAt` — read it off
// `EventApiError#details` when the promise rejects.
export function scanTicket(eventId: string, qrPayload: string, accessToken: string) {
  return request<ScanResult>(`/events/${encodeURIComponent(eventId)}/scan`, {
    method: 'POST',
    body: JSON.stringify({ qrPayload }),
    accessToken,
  })
}

export function getEventStats(id: string, accessToken: string) {
  return request<EventStats>(`/events/${encodeURIComponent(id)}/stats`, { accessToken })
}

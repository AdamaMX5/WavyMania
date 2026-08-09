// ActivationService isn't deployed under a stable `activation.<wavy-domain>`
// URL yet (see ActivationService.md), so like waveClient.ts/geoClient.ts this
// is configurable. In dev it defaults to /api/activation, proxied by Vite to
// a local ActivationService instance (see vite.config.ts) — ActivationService
// itself sends no CORS headers by design (CORS is handled at the NGINX layer
// in production).
const ACTIVATION_BASE_URL = import.meta.env.VITE_ACTIVATION_SERVICE_URL || '/api/activation'

export class ActivationApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ActivationApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${ACTIVATION_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
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
    throw new ActivationApiError(message, res.status)
  }

  return (await res.json()) as T
}

export type Plausibility = 'match' | 'mismatch' | 'unknown'

export interface CheckinResult {
  id: string
  plausibility: Plausibility
  createdAt: string
}

export interface CheckinInput {
  locationId: string
  code: string
  // The user's current H3 (res 9) cell, if geolocation is enabled — purely a
  // plausibility signal server-side (see ActivationService.md), never a hard
  // requirement, so omit it rather than guess when we don't have one.
  h3?: string
  waveId?: string
}

// 403 wrong/expired TOTP code, 404 inactive/unknown location, 429 rate limit
// (cooldown/daily/hourly cap) are all expected, documented outcomes here —
// callers render them, not exceptional failures.
export function submitCheckin(input: CheckinInput, accessToken: string) {
  return request<CheckinResult>('/checkins', { method: 'POST', body: JSON.stringify(input), accessToken })
}

// `GET /me/checkins` projects away `signature`/`merchantId` (billing data
// that doesn't belong in the consumer-facing history) but keeps `waveId` —
// used by useAvatar.ts to derive earned avatar items from real check-ins.
export interface MyCheckin {
  id: string
  locationId: string
  waveId?: string
  clientH3?: string
  plausibility: Plausibility
  createdAt: string
}

// Tolerates a bare array too, in case this endpoint predates the
// `{ items, page, limit, total }` envelope convention used elsewhere.
export async function myCheckins(accessToken: string, params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  const body = await request<unknown>(`/me/checkins${qs ? `?${qs}` : ''}`, { accessToken })
  if (Array.isArray(body)) return body as MyCheckin[]
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: MyCheckin[] }).items
  }
  return []
}

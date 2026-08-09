// GeoService isn't deployed under a stable `geo.<wavy-domain>` URL yet (see
// GeoService.md), so like waveClient.ts this is configurable. In dev it
// defaults to /api/geo, proxied by Vite to a local GeoService instance (see
// vite.config.ts) — GeoService itself sends no CORS headers by design (CORS
// is handled at the NGINX layer in production).
const GEO_BASE_URL = import.meta.env.VITE_GEO_SERVICE_URL || '/api/geo'

export class GeoApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GeoApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${GEO_BASE_URL}${path}`, {
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
    throw new GeoApiError(message, res.status)
  }

  if (res.status === 202 || res.status === 204) return undefined as T
  return (await res.json()) as T
}

export interface HeatmapCell {
  h3: string
  activity: number
}

export interface MapWave {
  id: string
  title: string
  category: string
  venue: { name: string; lat?: number; lng?: number; h3Cell?: string }
}

export interface MapResponse {
  cells: HeatmapCell[]
  waves: MapWave[]
}

// Rate-limited server-side to 1 per PING_MIN_INTERVAL_S (default 30s) per
// user — callers are responsible for not hammering this more often than
// that (see useLiveMap.ts), but a 429 here is expected/harmless either way.
export function sendPing(h3: string, accessToken: string) {
  return request<void>('/pings', { method: 'POST', body: JSON.stringify({ h3 }), accessToken })
}

// `cells` must be pre-deduplicated and capped at 200 entries per GeoService.md.
export function getMap(cells: string[], accessToken: string) {
  const query = new URLSearchParams({ cells: cells.join(',') })
  return request<MapResponse>(`/map?${query.toString()}`, { accessToken })
}

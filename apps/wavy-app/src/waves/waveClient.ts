import type { Wave, WaveCategory } from '../types'

// WaveService isn't deployed under a stable `wave.<wavy-domain>` URL yet (see
// WaveService.md), so unlike authClient's hardcoded production URL, this one is
// configurable. In dev it defaults to /api/wave, proxied by Vite to a local
// WaveService instance (see vite.config.ts) — WaveService itself sends no CORS
// headers by design (CORS is handled at the NGINX layer in production).
const WAVE_BASE_URL = import.meta.env.VITE_WAVE_SERVICE_URL || '/api/wave'

export class WaveApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'WaveApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${WAVE_BASE_URL}${path}`, {
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
    throw new WaveApiError(message, res.status)
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

export interface WaveCreateInput {
  title: string
  description?: string
  category: WaveCategory
  type: 'adhoc' | 'scheduled'
  startsAt: string
  endsAt: string
  venue: { name: string; lat?: number; lng?: number }
  maxParticipants?: number
}

export type WavePatchInput = Partial<
  Pick<WaveCreateInput, 'title' | 'description' | 'category' | 'type' | 'startsAt' | 'endsAt' | 'venue' | 'maxParticipants'>
>

export function listWaves(
  params: { state?: 'live' | 'completed'; category?: WaveCategory; page?: number; limit?: number } = {},
) {
  const query = new URLSearchParams()
  if (params.state) query.set('state', params.state)
  if (params.category) query.set('category', params.category)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<Page<Wave>>(`/waves${qs ? `?${qs}` : ''}`)
}

export function getWave(id: string, accessToken?: string) {
  // encodeURIComponent: id can originate from other services' data (e.g.
  // AvatarContext.ts passes a waveId read from an ActivationService
  // check-in) — defense-in-depth against a stray "/" or query-string
  // character reshaping the request path, matching MarketService's
  // convention for IDs sourced the same way.
  return request<Wave>(`/waves/${encodeURIComponent(id)}`, { accessToken })
}

export function createWave(data: WaveCreateInput, accessToken: string) {
  return request<Wave>('/waves', { method: 'POST', body: JSON.stringify(data), accessToken })
}

export function patchWave(id: string, data: WavePatchInput, accessToken: string) {
  return request<Wave>(`/waves/${id}`, { method: 'PATCH', body: JSON.stringify(data), accessToken })
}

export function publishWave(id: string, accessToken: string) {
  return request<Wave>(`/waves/${id}/publish`, { method: 'POST', accessToken })
}

export function cancelWave(id: string, accessToken: string) {
  return request<Wave>(`/waves/${id}/cancel`, { method: 'POST', accessToken })
}

export function completeWave(id: string, accessToken: string) {
  return request<Wave>(`/waves/${id}/complete`, { method: 'POST', accessToken })
}

export function joinWave(id: string, accessToken: string, ref?: string) {
  return request<{ waveId: string; userId: string; referredBy: string | null }>(`/waves/${id}/join`, {
    method: 'POST',
    body: JSON.stringify(ref ? { ref } : {}),
    accessToken,
  })
}

export function leaveWave(id: string, accessToken: string) {
  return request<void>(`/waves/${id}/join`, { method: 'DELETE', accessToken })
}

export function shareWave(id: string, accessToken: string) {
  return request<{ shareUrl: string; ref: string }>(`/waves/${id}/share`, { method: 'POST', accessToken })
}

export function myWaves(role: 'member' | 'creator', accessToken: string) {
  return request<Page<Wave>>(`/me/waves?role=${role}`, { accessToken })
}

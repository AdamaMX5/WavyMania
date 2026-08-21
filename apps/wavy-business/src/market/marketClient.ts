import type { MarketProduct, ProductState } from '../types'

// MarketService is now deployed under a stable domain, same as
// eventClient.ts's TicketService — hardcoded default, overridable via
// VITE_MARKET_SERVICE_URL (root .env). Set that var to /api/market for local
// dev against a local MarketService instance, proxied by Vite (see
// vite.config.ts) — MarketService itself sends no CORS headers by design
// (CORS is handled at the NGINX layer in production).
const MARKET_BASE_URL = import.meta.env.VITE_MARKET_SERVICE_URL || 'https://market.freischule.info'

export class MarketApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'MarketApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${MARKET_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
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
    throw new MarketApiError(message, res.status)
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

export function myProducts(accessToken: string, params: { state?: ProductState; page?: number; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.state) query.set('state', params.state)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<Page<MarketProduct>>(`/me/products${qs ? `?${qs}` : ''}`, { accessToken })
}

export interface ProductInput {
  title: string
  description?: string
  priceCents: number
  initialStock: number
  maxPerUser?: number
  dropAt?: string | null
  requiresShipping?: boolean
  waveId?: string | null
}

export function createProduct(input: ProductInput, accessToken: string) {
  return request<MarketProduct>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken,
  })
}

// Draft: any of ProductInput's fields (`initialStock` included — it's only frozen once
// published, see MarketService's applyPublishedPatch). Published/soldout: only
// `description`, `mediaIds` and `state: 'archived'` are accepted server-side — the
// caller is responsible for only sending what's allowed for the product's current state.
export type ProductPatchInput = Partial<ProductInput> & {
  mediaIds?: string[]
  state?: 'archived'
}

export function patchProduct(id: string, input: ProductPatchInput, accessToken: string) {
  return request<MarketProduct>(`/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
    accessToken,
  })
}

export function publishProduct(id: string, accessToken: string) {
  return request<MarketProduct>(`/products/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    accessToken,
  })
}

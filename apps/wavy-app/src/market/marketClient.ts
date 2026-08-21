import type { Order, Product, ShippingAddress } from '../types'
import { fetchWithRefresh } from '../lib/apiRequest'

// MarketService is now deployed under a stable domain, same as WaveService/
// GeoService/ActivationService — hardcoded default, overridable via
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
  const res = await fetchWithRefresh(`${MARKET_BASE_URL}${path}`, { accessToken, headers, ...init })

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

function listProductsByState(state: 'published' | 'soldout', params: { page?: number; limit?: number }) {
  const query = new URLSearchParams({ state })
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  return request<Page<Product>>(`/products?${query}`)
}

// MarketService's public discovery whitelist (PUBLIC_LIST_STATES) is
// `published` + `soldout`, but `state` is a single-value filter, not a CSV
// list — omitting it defaults server-side to `published` only. To show
// sold-out drops too (so "Ausverkauft" is visible instead of the product
// just vanishing), this issues one request per allowed state and merges
// them; draft/archived are never requested (merchant-only, out of scope).
export async function listProducts(params: { page?: number; limit?: number } = {}): Promise<{ items: Product[] }> {
  const [published, soldOut] = await Promise.all([
    listProductsByState('published', params),
    listProductsByState('soldout', params),
  ])
  return { items: [...published.items, ...soldOut.items] }
}

export interface CreateOrderInput {
  quantity: number
  shippingAddress?: ShippingAddress
}

// 409 covers "before dropAt", "soldout" and "over maxPerUser" — all expected,
// documented outcomes here (see MarketService.md), not exceptional failures;
// callers render err.message directly.
export function createOrder(productId: string, input: CreateOrderInput, accessToken: string) {
  return request<{ orderId: string; checkoutUrl: string }>(`/products/${encodeURIComponent(productId)}/orders`, {
    method: 'POST',
    body: JSON.stringify(input),
    accessToken,
  })
}

export function myOrders(accessToken: string, params: { page?: number; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return request<Page<Order>>(`/me/orders${qs ? `?${qs}` : ''}`, { accessToken })
}

export type WaveCategory = 'event' | 'commerce' | 'help' | 'nature' | 'recruiting' | 'culture'
export type WaveType = 'adhoc' | 'scheduled'
export type WaveState = 'draft' | 'live' | 'completed' | 'cancelled'

// Mirrors the WaveService `Wave` document shape (see ../../../WaveService/WaveService.md).
export interface Wave {
  id: string
  title: string
  description: string
  category: WaveCategory
  type: WaveType
  state: WaveState
  creatorId: string
  venue: {
    name: string
    lat?: number
    lng?: number
    h3Cell?: string
  }
  startsAt: string
  endsAt: string
  autoPublish: boolean
  maxParticipants: number
  mediaIds: string[]
  stats: {
    joins: number
    shares: number
    contributions: number
    checkins: number
  }
  createdAt: string
  updatedAt: string
}

// The backend has no concept of an emoji — it's a purely client-side stand-in
// for real media (mediaIds) until MediaService upload is wired up. Derived
// deterministically from category so every wave still gets a visual.
export const categoryEmoji: Record<WaveCategory, string> = {
  event: '🎉',
  commerce: '☕',
  help: '🌳',
  nature: '🌿',
  recruiting: '📣',
  culture: '🎸',
}

export type ProductState = 'draft' | 'published' | 'soldout' | 'archived'

// Mirrors the MarketService `Product` document shape (see
// ../../../MarketService/MarketService.md). `remainingStock` isn't part of
// the stored document (it lives in Redis, see stock.js) but is always
// included on the wire by GET /products* — kept here rather than modeled as
// separately-fetched so the UI never has to reconcile two requests.
// It's `null`, not 0, when the Redis stock key doesn't exist yet (e.g. a
// product that was published but never had its stock key set) — treating
// that as "sold out" would be a false positive, so callers must check
// `state` first (see isProductSoldOut below) rather than testing the number
// alone.
export interface Product {
  id: string
  merchantId: string
  waveId?: string
  title: string
  description: string
  mediaIds: string[]
  priceCents: number
  currency: string
  initialStock: number
  remainingStock: number | null
  maxPerUser: number
  dropAt?: string
  state: ProductState
  requiresShipping: boolean
  createdAt: string
  updatedAt: string
}

// `state` is the authoritative signal (MarketService flips it to 'soldout'
// when Redis stock hits 0); `remainingStock` is checked too since that flip
// is documented as best-effort, but only when it's a known number — `null`
// means "unknown", not "zero".
export function isProductSoldOut(product: Pick<Product, 'state' | 'remainingStock'>): boolean {
  return product.state === 'soldout' || (product.remainingStock !== null && product.remainingStock <= 0)
}

export type OrderState = 'pendingPayment' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

export interface ShippingAddress {
  name: string
  street: string
  zip: string
  city: string
  country: string
}

// Mirrors the MarketService `Order` document shape.
export interface Order {
  id: string
  userId: string
  merchantId: string
  productId: string
  quantity: number
  amountCents: number
  state: OrderState
  paymentRef?: string
  shippingAddress?: ShippingAddress
  trackingRef?: string
  createdAt: string
  updatedAt: string
}

// Same rationale as categoryEmoji above: no MediaService wiring yet, so this
// is a deterministic client-side stand-in keyed off the product id (stable
// across renders/reloads, unlike Math.random()) rather than a real mediaIds
// upload.
const PRODUCT_EMOJIS = ['🛍️', '🧢', '👕', '🎟️', '✨', '🧦', '🎒', '☕']

export function productEmoji(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PRODUCT_EMOJIS[hash % PRODUCT_EMOJIS.length]
}

export type AvatarSlot = 'head' | 'outfit' | 'badge'

// Catalog entries are static/client-side (no backend "item" concept exists
// yet) — only the per-user equip/unlock state is persisted, as an
// ObjectService document (see ../../.claude/MSArchitecture/ObjectService.md).
export interface AvatarItem {
  id: string
  slot: AvatarSlot
  emoji: string
  name: string
  unlock: 'starter' | 'earned'
  // Shown on locked items; irrelevant for 'starter' items.
  earnHint?: string
}

export interface Avatar {
  equipped: Partial<Record<AvatarSlot, string>>
  unlockedItemIds: string[]
}

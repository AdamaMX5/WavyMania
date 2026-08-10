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
  // Optional TicketService event reference — when set, this Wave has ticket access (see
  // WaveDetailSheet.tsx). Currently only settable via a direct WaveService/TicketService
  // API call, not through wavy-app's own Creator flow (see frontendPlan.md 5.1 — deliberately
  // hidden there, reserved for the not-yet-built WavyBusiness frontend).
  linkedTicketEventId?: string
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

export type TicketState = 'reserved' | 'paid' | 'cancelled' | 'checkedIn' | 'listed' | 'resold' | 'refunded'

// Mirrors the TicketService `Ticket` document shape (see
// ../../../TicketService/TicketService.md, src/lib/presenters.js#presentTicket).
// `qrPayload` is only ever present when `state === 'paid'` — the backend omits
// the field entirely rather than sending it as null, so its presence alone is
// the signal, not a separate flag.
export interface Ticket {
  id: string
  eventId: string
  tierId: string
  ownerId: string
  state: TicketState
  priceCents: number
  resale: { priceCents: number; listedAt: string } | null
  reservedUntil: string | null
  checkedInAt: string | null
  createdAt: string
  updatedAt: string
  qrPayload?: string
}

export type TicketEventState = 'draft' | 'published' | 'cancelled' | 'completed'

// Mirrors TicketService's `presentTier` (src/lib/presenters.js) — `available` is
// server-computed (`max(0, capacity - sold)`), never derived client-side.
export interface TicketTier {
  tierId: string
  name: string
  priceCents: number
  capacity: number
  sold: number
  available: number
}

// Subset of the TicketService `Event` shape used both to label an owned ticket in the UI
// and to drive the purchase flow in WaveDetailSheet.tsx — fetched lazily per `eventId`
// since `GET /me/tickets` doesn't denormalize it (same rationale as Order/Product title
// resolution in MarketService.md). `GET /events/:id` never returns a `draft` event (see
// TicketService's publicEvents.js PUBLIC_STATES) — `state` is still typed to include it
// for completeness with the backend's full enum, not because the client will ever see one.
export interface TicketEvent {
  id: string
  title: string
  venue: { name: string; address?: string; lat?: number; lng?: number }
  startsAt: string
  state: TicketEventState
  tiers: TicketTier[]
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

// Mirrors the ProfileService `GET /reputation/:userId` response shape (see
// ../../.claude/MSArchitecture/ProfileService.md, "Reputation / Level-System"). Level is
// derived server-side from `xp`, never stored independently — always trust this shape as a
// whole rather than recomputing level from xp on the client.
export interface Reputation {
  userId: string
  xp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
}

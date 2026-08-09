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

export interface Product {
  id: string
  name: string
  description: string
  priceCents: number
  currency: string
  imageEmoji: string
  waveId?: string
}

export type WaveCategory = 'event' | 'commerce' | 'help' | 'nature' | 'recruiting' | 'culture'
export type WaveType = 'adhoc' | 'scheduled'

export interface Wave {
  id: string
  title: string
  description: string
  category: WaveCategory
  type: WaveType
  venue: {
    name: string
    lat: number
    lng: number
  }
  startsAt: string
  endsAt: string
  maxParticipants?: number
  imageEmoji: string
  stats: {
    joins: number
    shares: number
    contributions: number
    checkins: number
  }
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

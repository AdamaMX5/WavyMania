export type EventState = 'draft' | 'published' | 'cancelled' | 'completed'

export interface EventVenue {
  name?: string
  address?: string
  lat?: number
  lng?: number
}

export interface EventTier {
  tierId: string
  name: string
  priceCents: number
  capacity: number
  sold: number
  available: number
}

export interface ResalePolicy {
  allowed: boolean
  maxMarkupBps: number
}

export interface OrganizerEvent {
  id: string
  organizerId: string
  waveId: string | null
  title: string
  description: string
  venue: EventVenue
  startsAt: string
  doorsAt: string | null
  tiers: EventTier[]
  resalePolicy: ResalePolicy
  state: EventState
  mediaIds: string[]
  createdAt: string
  updatedAt: string
}

export interface EventTierStats {
  tierId: string
  sold: number
  checkedIn: number
  revenueCents: number
}

export interface EventStats {
  eventId: string
  tiers: EventTierStats[]
}

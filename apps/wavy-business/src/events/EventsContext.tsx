import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { OrganizerEvent } from '../types'
import { useAuth } from '../auth/AuthContext'
import { isOrganizer } from '../auth/roles'
import * as eventClient from './eventClient'
import type { EventInput, EventPatchInput } from './eventClient'

interface EventsContextValue {
  events: OrganizerEvent[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createEvent: (input: EventInput) => Promise<OrganizerEvent>
  updateEvent: (id: string, input: EventPatchInput) => Promise<OrganizerEvent>
  publishEvent: (id: string) => Promise<OrganizerEvent>
  cancelEvent: (id: string) => Promise<eventClient.CancelEventResult>
}

const EventsContext = createContext<EventsContextValue | null>(null)

export function EventsProvider({ children }: { children: ReactNode }) {
  const { accessToken, status, user } = useAuth()
  // Unlike WavesProvider (public data, loads for every visitor), /me/events is
  // organizer-only — loading it for an anonymous or non-organizer session
  // would just provoke a 401/403.
  const userIsOrganizer = status === 'authenticated' && isOrganizer(user?.roles)
  const [events, setEvents] = useState<OrganizerEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!accessToken || !userIsOrganizer) return
    setLoading(true)
    setError(null)
    try {
      // limit: 100 (the backend's max) — no pagination UI yet.
      const { items } = await eventClient.myEvents(accessToken, { limit: 100 })
      setEvents(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Events konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }, [accessToken, userIsOrganizer])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requireToken = useCallback(() => {
    if (!accessToken) throw new Error('Bitte melde dich an, um diese Aktion auszuführen.')
    return accessToken
  }, [accessToken])

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      loading,
      error,
      refresh,

      createEvent: async (input) => {
        const token = requireToken()
        const created = await eventClient.createEvent(input, token)
        setEvents((prev) => [created, ...prev])
        return created
      },

      updateEvent: async (id, input) => {
        const token = requireToken()
        const updated = await eventClient.patchEvent(id, input, token)
        setEvents((prev) => prev.map((event) => (event.id === id ? updated : event)))
        return updated
      },

      publishEvent: async (id) => {
        const token = requireToken()
        const published = await eventClient.publishEvent(id, token)
        setEvents((prev) => prev.map((event) => (event.id === id ? published : event)))
        return published
      },

      cancelEvent: async (id) => {
        const token = requireToken()
        const result = await eventClient.cancelEvent(id, token)
        setEvents((prev) =>
          prev.map((event) => (event.id === id ? { ...event, state: 'cancelled' } : event)),
        )
        return result
      },
    }),
    [events, loading, error, refresh, requireToken],
  )

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}

export function useEvents() {
  const ctx = useContext(EventsContext)
  if (!ctx) throw new Error('useEvents must be used within EventsProvider')
  return ctx
}

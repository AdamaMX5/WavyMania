import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Reputation } from '../types'
import { getReputation } from './reputationClient'

// Only ProfileView reads this today, so a plain hook (fetch-on-mount) is enough — unlike
// Avatar, nothing writes reputation from the client, so there's no shared-mutation reason
// to lift this into a Context/Provider in App.tsx.
export function useReputation() {
  const { status, user } = useAuth()
  const userId = user?.id
  const [reputation, setReputation] = useState<Reputation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      setReputation(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    getReputation(userId)
      .then((result) => {
        if (!cancelled) setReputation(result)
      })
      .catch(() => {
        // Best-effort — the profile page still renders fine without it (see ProfileView.tsx).
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [status, userId])

  return { reputation, loading }
}

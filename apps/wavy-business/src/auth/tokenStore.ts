import * as authClient from './authClient'

type Listener = () => void

// Module-level singleton (not React state) so any client file — eventClient,
// marketClient, paymentsClient, etc. — can read/refresh the access token
// without needing to be inside the component tree. AuthContext.tsx is the
// only React consumer, subscribing via useSyncExternalStore so the UI stays
// in sync whenever a background 401-triggered refresh (see
// ../lib/apiRequest.ts) rotates the token outside of any explicit
// login()/logout() call.
let accessToken: string | null = null
let inFlightRefresh: Promise<string | null> | null = null
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((listener) => listener())
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null) {
  accessToken = token
  notify()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Single-flight: several requests can 401 around the same moment (e.g. two
// contexts refetching right after the access token expires) — they share one
// /user/refresh call instead of racing, since AuthService rotates the
// refresh_token/csrf_token cookie pair on every call and a second concurrent
// refresh would invalidate the first one's already-issued cookies.
export function refreshAccessToken(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = authClient
      .refresh()
      .then(({ access_token }) => {
        setAccessToken(access_token)
        return access_token
      })
      .catch(() => {
        setAccessToken(null)
        return null
      })
      .finally(() => {
        inFlightRefresh = null
      })
  }
  return inFlightRefresh
}

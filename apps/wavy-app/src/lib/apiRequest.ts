import { refreshAccessToken } from '../auth/tokenStore'

export interface ApiRequestInit extends RequestInit {
  accessToken?: string
}

// Shared by every service client's request() helper (waveClient,
// geoClient, activationClient, marketClient, ticketClient, avatarClient):
// attaches the Bearer token when given, and on a 401 from an authenticated
// call, refreshes the access token once via AuthService's /user/refresh (see
// auth/tokenStore.ts's single-flight refreshAccessToken) and retries exactly
// once with the fresh token — so a merely-expired access token never
// surfaces to the user as "logged out" while the refresh_token cookie is
// still valid.
export async function fetchWithRefresh(url: string, { accessToken, headers, ...init }: ApiRequestInit): Promise<Response> {
  const attempt = (token?: string) =>
    fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        // Spread last so a caller-supplied `headers` object can never shadow
        // the auth header (no current call site does, but this keeps it true
        // by construction rather than by convention).
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const res = await attempt(accessToken)
  if (res.status !== 401 || !accessToken) return res

  const refreshed = await refreshAccessToken()
  return refreshed ? attempt(refreshed) : res
}

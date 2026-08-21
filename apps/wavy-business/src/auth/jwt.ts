export interface AccessTokenClaims {
  sub: string
  email: string
  roles: string[]
}

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (padded.length % 4)) % 4
  return atob(padded + '='.repeat(padLength))
}

// Client-side JWT payload decode for display purposes only (id/email/roles
// shown in the UI, e.g. useAuth().user) — this is never a security boundary,
// every request is still verified server-side against AuthService's RS256
// public key per the shared MSArchitecture conventions. Never throws: a
// malformed/unexpected token just means the UI treats the session as absent.
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const claims = JSON.parse(base64UrlDecode(payload))
    if (
      typeof claims?.sub !== 'string' ||
      typeof claims?.email !== 'string' ||
      !Array.isArray(claims?.roles)
    ) {
      return null
    }
    return { sub: claims.sub, email: claims.email, roles: claims.roles }
  } catch {
    return null
  }
}

import type { Reputation } from '../types'

// ProfileService is existing shared platform infrastructure with a stable production
// domain already (same rationale as authClient.ts/avatarClient.ts) — hardcoded URL, direct
// cross-origin fetch, no dev proxy needed.
const PROFILE_BASE_URL = 'https://profile.freischule.info'

export class ProfileApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ProfileApiError'
    this.status = status
  }
}

// GET /reputation/:userId requires no auth (see ProfileService.md — level/XP is a public
// reputation signal by design), so no access token is threaded through here.
export async function getReputation(userId: string): Promise<Reputation> {
  const res = await fetch(`${PROFILE_BASE_URL}/reputation/${encodeURIComponent(userId)}`)

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error ?? message
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new ProfileApiError(message, res.status)
  }

  return (await res.json()) as Reputation
}

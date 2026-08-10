// Persists guest-checkout claim tokens on-device (localStorage) instead of showing a
// one-time confirmation screen the user has to copy before leaving for Stripe — see
// TicketService.md's Claim-Token section for the backend contract. This is a UX layer on
// top of that flow, not a replacement: the token is also embedded in the confirmation
// email (TicketService's own fallback), so losing localStorage (different device, cleared
// browser data) just falls back to the email link.
const STORAGE_KEY = 'wavy-ticket-claims'

// Mirrors TicketService's CLAIM_TOKEN_TTL_H default (see TicketService.md) — a best-effort
// client-side mirror, not authoritative. The backend still enforces the real expiry
// regardless; this just avoids rendering a correction form for a token that's certainly
// dead already (e.g. a bookmarked/history-restored /checkout/success page from days ago),
// and keeps the stored blob from growing unboundedly.
const CLAIM_TOKEN_TTL_MS = 48 * 60 * 60 * 1000

interface StoredClaim {
  claimToken: string
  email: string
  savedAt: number
}

function readAll(): Record<string, StoredClaim> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, StoredClaim>) : {}
  } catch {
    // Corrupt JSON or localStorage unavailable (e.g. private browsing) — treat as empty
    // rather than throwing, since this whole feature is a best-effort UX layer.
    return {}
  }
}

function writeAll(claims: Record<string, StoredClaim>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(claims))
  } catch {
    // Best-effort — see readAll().
  }
}

export function saveClaimToken(ticketId: string, claimToken: string, email: string): void {
  const claims = readAll()
  claims[ticketId] = { claimToken, email, savedAt: Date.now() }
  writeAll(claims)
}

export function getClaimToken(ticketId: string): StoredClaim | null {
  const claims = readAll()
  const claim = claims[ticketId]
  if (!claim) return null
  if (Date.now() - claim.savedAt > CLAIM_TOKEN_TTL_MS) {
    delete claims[ticketId]
    writeAll(claims)
    return null
  }
  return claim
}

export function removeClaimToken(ticketId: string): void {
  const claims = readAll()
  delete claims[ticketId]
  writeAll(claims)
}

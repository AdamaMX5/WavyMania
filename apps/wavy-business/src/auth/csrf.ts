// The csrf_token cookie is intentionally non-HttpOnly (see AuthService.md)
// so JS can read it and echo it back as X-CSRF-Token on /user/refresh —
// AuthService checks that value's hash against the one stored alongside the
// (httpOnly, unreadable) refresh_token's hash.
export function getCsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

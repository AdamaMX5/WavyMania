// The merchant-side WavyBusiness display renders `wavy://checkin/<locationId>/<code>`
// (see ActivationService.md, "Check-in-QR"). Neither segment's exact charset is
// specified there beyond "Dokument-ID" / "8-stelliger TOTP", so this stays
// permissive and lets ActivationService itself be the source of truth on
// validity (400/403/404) rather than duplicating format assumptions here.
const CHECKIN_QR_PATTERN = /^wavy:\/\/checkin\/([^/?#]+)\/([^/?#]+)\/?$/

export interface CheckinQrPayload {
  locationId: string
  code: string
}

export function parseCheckinQr(raw: string): CheckinQrPayload | null {
  const match = CHECKIN_QR_PATTERN.exec(raw.trim())
  if (!match) return null
  // decodeURIComponent throws URIError on malformed percent-encoding (e.g. a
  // lone "%" in the payload) — an untrusted, camera-scanned string must never
  // be able to throw here, or the exception escapes as an unhandled
  // rejection from the caller's async onDetect handler. Treat it the same as
  // any other malformed payload: not a valid check-in QR.
  let locationId: string
  let code: string
  try {
    locationId = decodeURIComponent(match[1])
    code = decodeURIComponent(match[2])
  } catch {
    return null
  }
  if (!locationId || !code) return null
  return { locationId, code }
}

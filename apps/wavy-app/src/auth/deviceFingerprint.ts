const STORAGE_KEY = 'wavy-device-id'

/**
 * Not a real fingerprinting library — just a stable per-browser id so the
 * AuthService can tell repeat devices apart for its device_fingerprint field.
 * Safe to keep in localStorage: it identifies a device, not a session/user.
 */
export function getDeviceFingerprint(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing

  const id = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, id)
  return id
}

export function getDeviceName(): string {
  return 'WavyApp Web'
}

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Renders the ticket's signed QR-JWT (`qrPayload`) as a scannable code —
// mirrors the "helligkeits-boost beim Vorzeigen" requirement from
// frontendPlan.md §3.1 with a plain white background/dark modules (best
// contrast for a door scanner reading an unlit phone screen), regenerated
// whenever the payload changes (e.g. after a resale re-issues the QR).
export function TicketQrCode({ payload }: { payload: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    setError(false)
    QRCode.toDataURL(payload, { margin: 1, width: 240, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [payload])

  if (error) {
    return <p className="text-sm text-red-400">QR-Code konnte nicht erzeugt werden.</p>
  }

  if (!dataUrl) {
    return <div className="aspect-square w-full max-w-[240px] animate-pulse rounded-lg bg-neutral-800" />
  }

  return (
    <img
      src={dataUrl}
      alt="Ticket-QR-Code"
      className="mx-auto w-full max-w-[240px] rounded-lg bg-white p-2"
    />
  )
}

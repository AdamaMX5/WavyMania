import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { correctGuestEmail, TicketApiError } from '../ticket/ticketClient'
import { getClaimToken, removeClaimToken } from '../ticket/claimTokenStore'

interface ResultProps {
  icon: string
  title: string
  body: string
  ctaTo: string
  ctaLabel: string
  children?: ReactNode
}

function CheckoutResult({ icon, title, body, ctaTo, ctaLabel, children }: ResultProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 text-5xl">{icon}</div>
      <h1 className="mb-2 text-xl font-semibold text-neutral-100">{title}</h1>
      <p className="mb-6 text-sm text-neutral-400">{body}</p>
      {children}
      <Link to={ctaTo} className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-neutral-950">
        {ctaLabel}
      </Link>
    </div>
  )
}

// Shown only on the ticket success page, and only when this device holds a locally-stored
// claim token for this ticketId (see claimTokenStore.ts) — i.e. a guest checkout that just
// provisioned a brand-new account. The same correction is also reachable via the link
// embedded in the confirmation email (TicketService's own fallback), so this is purely a
// convenience for the common case of returning to the app right after Stripe.
function GuestEmailCorrection({ ticketId }: { ticketId: string }) {
  // Read once (lazy initializer) rather than on every render — handleSubmit calls
  // removeClaimToken() on success, and re-reading storage after that would make `claim`
  // (and the `done` success message gated below it) disappear in the same render it's
  // meant to confirm.
  const [claim] = useState(() => getClaimToken(ticketId))
  const [newEmail, setNewEmail] = useState(claim?.email ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!claim) return null
  if (done) {
    return (
      <p className="mb-6 w-full max-w-xs rounded-lg border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-200">
        E-Mail-Adresse aktualisiert.
      </p>
    )
  }

  const claimToken = claim.claimToken

  // Maps the documented guestCheckout.js error responses (see TicketService.md) to German
  // copy — anything unmapped falls back to a generic message rather than surfacing the raw
  // English backend string.
  function describeCorrectionError(err: unknown): string {
    if (err instanceof TicketApiError) {
      if (err.status === 403) return 'Der Korrektur-Link ist ungültig, abgelaufen oder bereits verwendet.'
      if (err.status === 409) return 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.'
    }
    return 'Korrektur fehlgeschlagen.'
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await correctGuestEmail(claimToken, newEmail)
      removeClaimToken(ticketId)
      setDone(true)
    } catch (err) {
      setError(describeCorrectionError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 w-full max-w-xs space-y-2 text-left">
      <p className="text-xs text-neutral-500">
        E-Mail-Adresse falsch eingegeben? Hier korrigieren, solange dein Konto noch nicht bestätigt ist.
      </p>
      <input
        type="email"
        required
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-200 disabled:opacity-50"
      >
        {submitting ? 'Wird korrigiert …' : 'E-Mail korrigieren'}
      </button>
    </form>
  )
}

// MarketService's checkout.js redirects Stripe back here with `?orderId=…` and
// TicketService's checkout.js does the same with `?ticketId=…` (see MarketService.md /
// TicketService.md) — these two routes are the landing pages for both redirects, not
// something the app links to itself. The actual order/ticket state only ever becomes
// authoritative via PaymentService's webhook, so this deliberately doesn't claim "paid" —
// it points at the profile, which reflects the real state once the webhook has landed.
export function CheckoutSuccessView() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  const ticketId = params.get('ticketId')

  const body = ticketId
    ? 'Dein Ticket wird bearbeitet — der Status erscheint in Kürze unter „Meine Tickets" in deinem Profil.'
    : `${orderId ? `Bestellung ${orderId}` : 'Deine Bestellung'} wird bearbeitet — der Status erscheint in Kürze unter „Meine Käufe" in deinem Profil.`

  return (
    <CheckoutResult icon="✅" title="Zahlung erfolgreich" body={body} ctaTo="/profil" ctaLabel="Zu meinem Profil">
      {ticketId && <GuestEmailCorrection ticketId={ticketId} />}
    </CheckoutResult>
  )
}

export function CheckoutCancelView() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  const ticketId = params.get('ticketId')

  const body = ticketId
    ? 'Der Ticketkauf wurde nicht abgeschlossen — die Reservierung wird automatisch wieder freigegeben.'
    : `${orderId ? `Bestellung ${orderId}` : 'Der Kauf'} wurde nicht abgeschlossen — reservierter Bestand wird automatisch wieder freigegeben.`

  return (
    <CheckoutResult
      icon="↩️"
      title="Zahlung abgebrochen"
      body={body}
      ctaTo={ticketId ? '/' : '/marktplatz'}
      ctaLabel={ticketId ? 'Zurück zu den Waves' : 'Zurück zum Marktplatz'}
    />
  )
}

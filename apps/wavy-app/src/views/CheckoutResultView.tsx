import { Link, useSearchParams } from 'react-router-dom'

interface ResultProps {
  icon: string
  title: string
  body: string
  ctaTo: string
  ctaLabel: string
}

function CheckoutResult({ icon, title, body, ctaTo, ctaLabel }: ResultProps) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 text-5xl">{icon}</div>
      <h1 className="mb-2 text-xl font-semibold text-neutral-100">{title}</h1>
      <p className="mb-6 text-sm text-neutral-400">{body}</p>
      <Link to={ctaTo} className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-neutral-950">
        {ctaLabel}
      </Link>
    </div>
  )
}

// MarketService's checkout.js redirects Stripe back here
// (successUrl/cancelUrl = `${APP_BASE_URL}/checkout/{success,cancel}?orderId=…`,
// see MarketService.md) — these two routes are the landing pages for that
// redirect, not something the app links to itself. The actual order state
// only ever becomes authoritative via PaymentService's webhook, so this
// deliberately doesn't claim "paid" — it points at "Meine Käufe", which
// reflects the real state once the webhook has landed.
export function CheckoutSuccessView() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  return (
    <CheckoutResult
      icon="✅"
      title="Zahlung erfolgreich"
      body={`${orderId ? `Bestellung ${orderId}` : 'Deine Bestellung'} wird bearbeitet — der Status erscheint in Kürze unter „Meine Käufe" in deinem Profil.`}
      ctaTo="/profil"
      ctaLabel="Zu meinem Profil"
    />
  )
}

export function CheckoutCancelView() {
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  return (
    <CheckoutResult
      icon="↩️"
      title="Zahlung abgebrochen"
      body={`${orderId ? `Bestellung ${orderId}` : 'Der Kauf'} wurde nicht abgeschlossen — reservierter Bestand wird automatisch wieder freigegeben.`}
      ctaTo="/marktplatz"
      ctaLabel="Zurück zum Marktplatz"
    />
  )
}

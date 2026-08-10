import { useState } from 'react'
import type { OrderState, TicketState } from '../types'
import { useAuth } from '../auth/AuthContext'
import { LoginForm } from '../auth/LoginForm'
import { useAvatar } from '../avatar/AvatarContext'
import { AvatarBadge } from '../components/AvatarBadge'
import { SettingsMenu } from '../components/SettingsMenu'
import { useMarket } from '../market/MarketContext'
import { useReputation } from '../reputation/useReputation'
import { useTickets } from '../ticket/TicketContext'
import { TicketQrCode } from '../ticket/TicketQrCode'
import { formatPrice } from '../lib/format'

const orderStateLabel: Record<OrderState, string> = {
  pendingPayment: 'Zahlung ausstehend',
  paid: 'Bezahlt',
  shipped: 'Versendet',
  delivered: 'Zugestellt',
  cancelled: 'Storniert',
  refunded: 'Erstattet',
}

// Only these states are worth surfacing to the ticket's own owner —
// `listed`/`resold` (the seller's side of a resale) are shown too since the
// ticket still belongs in "my tickets" until it's actually sold, but
// `reserved` (an abandoned checkout mid-flow) is filtered out below rather
// than confusing the owner with a ticket they never actually paid for.
const ticketStateLabel: Record<TicketState, string> = {
  reserved: 'Reservierung ausstehend',
  paid: 'Gültig',
  cancelled: 'Storniert',
  checkedIn: 'Eingecheckt',
  listed: 'Im Zweitmarkt gelistet',
  resold: 'Verkauft',
  refunded: 'Erstattet',
}

export function ProfileView() {
  const auth = useAuth()
  const { avatar } = useAvatar()
  const { reputation } = useReputation()
  const { products, myOrders, ordersLoading } = useMarket()
  const { tickets: allTickets, loading: ticketsLoading, events } = useTickets()
  // `reserved` is a checkout in flight (or abandoned — the backend's
  // reservation cron cancels it after RESERVATION_TTL_MIN, see
  // TicketService.md), never something the owner actually holds yet, so it's
  // left out of "my tickets" rather than shown as a dead-end pending state.
  const tickets = allTickets.filter((t) => t.state !== 'reserved')
  const [openQrTicketId, setOpenQrTicketId] = useState<string | null>(null)

  const progressPercent =
    reputation && reputation.xpForNextLevel > 0
      ? Math.min(100, (reputation.xpIntoLevel / reputation.xpForNextLevel) * 100)
      : 0

  if (auth.status === 'anon') {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center p-4">
        <LoginForm />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarBadge avatar={avatar} />
          <div className="min-w-0">
            <p className="font-medium text-neutral-100">{auth.user?.email}</p>
            {/* Falls back to the fresh-user default (level 1 / 0 XP) while loading or if
                the reputation fetch fails — see useReputation.ts — so there's no layout
                flash and a ProfileService hiccup never blocks the rest of the page. */}
            <p className="text-sm text-neutral-500">
              Level {reputation?.level ?? 1} · {reputation?.xp ?? 0} XP
            </p>
            <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
        <SettingsMenu />
      </div>

      {auth.verifyEmailPending && (
        <div className="mb-4 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben.
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Meine Tickets
        </h2>
        {ticketsLoading && <p className="text-sm text-neutral-500">Lädt …</p>}
        {!ticketsLoading && tickets.length === 0 && (
          <div className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
            Noch keine Tickets — gekaufte Tickets erscheinen hier.
          </div>
        )}
        {!ticketsLoading && tickets.length > 0 && (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const event = events[ticket.eventId]
              const qrOpen = openQrTicketId === ticket.id
              return (
                <div key={ticket.id} className="rounded-xl bg-neutral-900 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-100">{event?.title ?? 'Ticket'}</span>
                    <span className="text-neutral-400">{formatPrice(ticket.priceCents, 'EUR')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">{ticketStateLabel[ticket.state]}</span>
                    {ticket.qrPayload && (
                      <button
                        onClick={() => setOpenQrTicketId(qrOpen ? null : ticket.id)}
                        className="text-xs font-medium text-emerald-400"
                      >
                        {qrOpen ? 'QR ausblenden' : 'QR anzeigen'}
                      </button>
                    )}
                  </div>
                  {qrOpen && ticket.qrPayload && (
                    <div className="mt-3">
                      <TicketQrCode payload={ticket.qrPayload} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Meine Käufe
        </h2>
        {ordersLoading && <p className="text-sm text-neutral-500">Lädt …</p>}
        {!ordersLoading && myOrders.length === 0 && (
          <div className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
            Noch keine Käufe — Bestellungen aus dem Marktplatz erscheinen hier.
          </div>
        )}
        {!ordersLoading && myOrders.length > 0 && (
          <div className="space-y-2">
            {myOrders.map((order) => (
              <div key={order.id} className="rounded-xl bg-neutral-900 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-100">
                    {/* Order has no denormalized product title — resolved best-effort
                        against the already-loaded catalog rather than an extra request. */}
                    {products.find((p) => p.id === order.productId)?.title ?? 'Bestellung'}
                  </span>
                  {/* Order has no currency field of its own (see MarketService.md) —
                      the service only supports 'eur' for now, same simplification
                      Product.currency already relies on. */}
                  <span className="text-neutral-400">{formatPrice(order.amountCents, 'EUR')}</span>
                </div>
                <span className="text-xs text-neutral-500">{orderStateLabel[order.state]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={() => auth.logout()}
        className="w-full rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300"
      >
        Abmelden
      </button>
    </div>
  )
}

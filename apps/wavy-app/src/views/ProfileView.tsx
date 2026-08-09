import type { OrderState } from '../types'
import { useAuth } from '../auth/AuthContext'
import { LoginForm } from '../auth/LoginForm'
import { useAvatar } from '../avatar/AvatarContext'
import { AvatarBadge } from '../components/AvatarBadge'
import { SettingsMenu } from '../components/SettingsMenu'
import { useMarket } from '../market/MarketContext'
import { formatPrice } from '../lib/format'

const orderStateLabel: Record<OrderState, string> = {
  pendingPayment: 'Zahlung ausstehend',
  paid: 'Bezahlt',
  shipped: 'Versendet',
  delivered: 'Zugestellt',
  cancelled: 'Storniert',
  refunded: 'Erstattet',
}

export function ProfileView() {
  const auth = useAuth()
  const { avatar } = useAvatar()
  const { products, myOrders, ordersLoading } = useMarket()

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
          <div>
            <p className="font-medium text-neutral-100">{auth.user?.email}</p>
            <p className="text-sm text-neutral-500">Level 1 · 0 XP</p>
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
        <div className="rounded-xl bg-neutral-900 p-4 text-sm text-neutral-500">
          Noch keine Tickets — aktive und abgelaufene Tickets erscheinen hier, sobald WavyTickets live ist.
        </div>
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

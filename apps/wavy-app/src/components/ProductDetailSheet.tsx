import { useState, type FormEvent } from 'react'
import type { Product, ShippingAddress } from '../types'
import { isProductSoldOut, productEmoji } from '../types'
import { useAuth } from '../auth/AuthContext'
import { useMarket } from '../market/MarketContext'
import { MarketApiError } from '../market/marketClient'
import { formatPrice } from '../lib/format'

const EMPTY_ADDRESS: ShippingAddress = { name: '', street: '', zip: '', city: '', country: 'DE' }

export function ProductDetailSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { status } = useAuth()
  const { buy } = useMarket()
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dropPending = product.dropAt !== undefined && new Date(product.dropAt).getTime() > Date.now()
  const soldOut = isProductSoldOut(product)
  const canBuy = status === 'authenticated' && !dropPending && !soldOut

  async function handleBuy(e?: FormEvent) {
    e?.preventDefault()
    if (status !== 'authenticated') {
      setError('Bitte melde dich an, um zu kaufen.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { checkoutUrl } = await buy(product.id, {
        quantity: 1,
        shippingAddress: product.requiresShipping ? address : undefined,
      })
      // PaymentService's Stripe Checkout is hosted, not embeddable — this
      // leaves the app for the real checkout flow, per MarketService.md's
      // documented POST /products/:id/orders → { checkoutUrl } contract.
      // This is the app's only navigation sink driven by a server response,
      // so it's worth a schema check even though checkoutUrl is First-Party
      // data: a bare `window.location.href = checkoutUrl` would happily
      // execute a "javascript:" URL if that response were ever compromised.
      const url = new URL(checkoutUrl)
      if (url.protocol !== 'https:') throw new Error('Ungültige Checkout-URL erhalten.')
      window.location.href = url.href
    } catch (err) {
      setError(err instanceof MarketApiError ? err.message : 'Kauf fehlgeschlagen.')
      setSubmitting(false)
    }
  }

  const buyLabel = submitting
    ? 'Wird bestellt …'
    : soldOut
      ? 'Ausverkauft'
      : dropPending
        ? 'Noch nicht verfügbar'
        : `Kaufen · ${formatPrice(product.priceCents, product.currency)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-neutral-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-800 text-2xl">
              {productEmoji(product.id)}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">{product.title}</h2>
              <p className="text-sm font-medium text-neutral-300">
                {formatPrice(product.priceCents, product.currency)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500">
            ✕
          </button>
        </div>

        <p className="mb-3 text-sm text-neutral-300">{product.description}</p>

        <div className="mb-4 space-y-1 text-sm text-neutral-400">
          {dropPending && <p>⏳ Verfügbar ab {new Date(product.dropAt!).toLocaleString('de-DE')}</p>}
          {!dropPending && !soldOut && product.remainingStock !== null && <p>📦 {product.remainingStock} verfügbar</p>}
          {soldOut && <p>❌ Ausverkauft</p>}
          <p>🔁 max. {product.maxPerUser} pro Person</p>
        </div>

        {error && (
          <p className="mb-3 rounded-lg border border-red-900 bg-red-950/40 p-2 text-sm text-red-300">{error}</p>
        )}

        {product.requiresShipping ? (
          <form onSubmit={handleBuy} className="space-y-2">
            <input
              required
              disabled={!canBuy}
              placeholder="Name"
              value={address.name}
              onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <input
              required
              disabled={!canBuy}
              placeholder="Straße und Hausnummer"
              value={address.street}
              onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <input
                required
                disabled={!canBuy}
                placeholder="PLZ"
                value={address.zip}
                onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                className="w-1/3 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-50"
              />
              <input
                required
                disabled={!canBuy}
                placeholder="Stadt"
                value={address.city}
                onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-50"
              />
            </div>
            <input
              required
              disabled={!canBuy}
              placeholder="Land"
              value={address.country}
              onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value }))}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!canBuy || submitting}
              className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
            >
              {buyLabel}
            </button>
          </form>
        ) : (
          <button
            onClick={() => handleBuy()}
            disabled={!canBuy || submitting}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            {buyLabel}
          </button>
        )}

        {status !== 'authenticated' && (
          <p className="mt-2 text-center text-xs text-neutral-500">Melde dich an, um zu kaufen.</p>
        )}
      </div>
    </div>
  )
}

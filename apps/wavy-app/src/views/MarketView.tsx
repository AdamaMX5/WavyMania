import { useState } from 'react'
import { products } from '../mock/products'

function formatPrice(cents: number, currency: string) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency })
}

export function MarketView() {
  const [added, setAdded] = useState<Set<string>>(new Set())

  const toggleAdded = (id: string) => {
    setAdded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Marktplatz</h1>
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-xl bg-neutral-900 p-3">
            <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-neutral-800 text-4xl">
              {product.imageEmoji}
            </div>
            <p className="text-sm font-medium text-neutral-100">{product.name}</p>
            <p className="mb-2 text-xs text-neutral-500">{product.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-100">
                {formatPrice(product.priceCents, product.currency)}
              </span>
              <button
                onClick={() => toggleAdded(product.id)}
                className={`rounded-lg px-2 py-1 text-xs font-medium ${
                  added.has(product.id) ? 'bg-cyan-500 text-neutral-950' : 'border border-neutral-700 text-neutral-300'
                }`}
              >
                {added.has(product.id) ? '✓ Im Warenkorb' : 'Kaufen'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-neutral-600">
        Checkout folgt mit PaymentService (Phase 2).
      </p>
    </div>
  )
}

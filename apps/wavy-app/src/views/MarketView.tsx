import { useState } from 'react'
import { isProductSoldOut, productEmoji } from '../types'
import { useMarket } from '../market/MarketContext'
import { ProductDetailSheet } from '../components/ProductDetailSheet'
import { formatPrice } from '../lib/format'

export function MarketView() {
  const { products, loading, error } = useMarket()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = products.find((p) => p.id === selectedId) ?? null

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Marktplatz</h1>

      {loading && <p className="text-sm text-neutral-500">Produkte werden geladen …</p>}
      {error && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
      )}
      {!loading && !error && products.length === 0 && (
        <p className="text-sm text-neutral-500">Noch keine Drops im Marktplatz.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => {
          const soldOut = isProductSoldOut(product)
          return (
            <button
              key={product.id}
              onClick={() => setSelectedId(product.id)}
              className="rounded-xl bg-neutral-900 p-3 text-left transition hover:bg-neutral-800"
            >
              <div className="mb-2 flex h-24 items-center justify-center rounded-lg bg-neutral-800 text-4xl">
                {productEmoji(product.id)}
              </div>
              <p className="text-sm font-medium text-neutral-100">{product.title}</p>
              <p className="mb-2 truncate text-xs text-neutral-500">{product.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-100">
                  {formatPrice(product.priceCents, product.currency)}
                </span>
                {soldOut && <span className="text-xs text-neutral-500">Ausverkauft</span>}
              </div>
            </button>
          )
        })}
      </div>

      {selected && <ProductDetailSheet product={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

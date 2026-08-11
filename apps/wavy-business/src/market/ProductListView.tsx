import { Link } from 'react-router-dom'
import { useProducts } from './ProductsContext'
import { formatPrice } from '../lib/format'
import type { ProductState } from '../types'

const STATE_LABEL: Record<ProductState, string> = {
  draft: 'Entwurf',
  published: 'Live',
  soldout: 'Ausverkauft',
  archived: 'Archiviert',
}

const STATE_CLASS: Record<ProductState, string> = {
  draft: 'bg-neutral-800 text-neutral-300',
  published: 'bg-cyan-950 text-cyan-300',
  soldout: 'bg-amber-950 text-amber-300',
  archived: 'bg-neutral-800 text-neutral-400',
}

export function ProductListView() {
  const { products, loading, error } = useProducts()

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Meine Produkte &amp; Angebote</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
      )}

      {loading && products.length === 0 && <p className="text-sm text-neutral-400">Lade Produkte …</p>}

      {!loading && products.length === 0 && !error && (
        <p className="text-sm text-neutral-400">
          Noch keine Produkte angelegt. <Link to="/produkte/neu" className="text-cyan-400 underline">Erstes Produkt anlegen</Link>
        </p>
      )}

      <div className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
        {products.map((product) => (
          <Link
            key={product.id}
            to={`/produkte/${product.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900"
          >
            <div>
              <p className="font-medium text-neutral-100">{product.title}</p>
              <p className="text-sm text-neutral-400">
                {formatPrice(product.priceCents, product.currency)}
                {product.remainingStock !== null && ` · ${product.remainingStock} verfügbar`}
                {product.dropAt && ` · Drop ${new Date(product.dropAt).toLocaleString('de-DE')}`}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_CLASS[product.state]}`}>
              {STATE_LABEL[product.state]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

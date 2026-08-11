import { useEffect, useState, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProducts } from './ProductsContext'
import { MarketApiError } from './marketClient'
import { formatPrice } from '../lib/format'

const STATE_LABEL: Record<string, string> = {
  draft: 'Entwurf',
  published: 'Live',
  soldout: 'Ausverkauft',
  archived: 'Archiviert',
}

// `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm" in local time, not the ISO
// string (UTC, with seconds/zone) the API returns.
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ProductDetailView() {
  const { id = '' } = useParams()
  const { products, updateProduct, publishProduct, loading } = useProducts()
  const product = products.find((p) => p.id === id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [maxPerUser, setMaxPerUser] = useState('2')
  const [dropAt, setDropAt] = useState('')
  const [requiresShipping, setRequiresShipping] = useState(false)

  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  useEffect(() => {
    if (!product) return
    setTitle(product.title)
    setDescription(product.description)
    setPrice((product.priceCents / 100).toFixed(2))
    setInitialStock(String(product.initialStock))
    setMaxPerUser(String(product.maxPerUser))
    setDropAt(product.dropAt ? toLocalInput(product.dropAt) : '')
    setRequiresShipping(product.requiresShipping)
    // Only re-sync from the server object when navigating to a different
    // product — not on every context update, or in-progress edits would be
    // clobbered each time `products` is replaced by refresh()/other mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  if (loading && !product) return <p className="p-6 text-sm text-neutral-400">Lade Produkt …</p>
  if (!product) {
    return (
      <p className="p-6 text-sm text-neutral-400">
        Produkt nicht gefunden. <Link to="/produkte" className="text-cyan-400 underline">Zurück zur Liste</Link>
      </p>
    )
  }

  const isDraft = product.state === 'draft'
  const isPublished = product.state === 'published' || product.state === 'soldout'
  const isArchived = product.state === 'archived'

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setActionError(null)
    setActionMessage(null)
    setSaving(true)
    try {
      if (isDraft) {
        await updateProduct(product.id, {
          title,
          description,
          priceCents: Math.round(Number(price) * 100),
          initialStock: Number(initialStock),
          maxPerUser: Number(maxPerUser),
          dropAt: dropAt ? new Date(dropAt).toISOString() : null,
          requiresShipping,
        })
      } else {
        await updateProduct(product.id, { description })
      }
      setActionMessage('Gespeichert.')
    } catch (err) {
      setActionError(err instanceof MarketApiError ? err.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setActionError(null)
    setActionMessage(null)
    setPublishing(true)
    try {
      await publishProduct(product.id)
      setActionMessage('Produkt veröffentlicht.')
    } catch (err) {
      setActionError(
        err instanceof MarketApiError
          ? err.message
          : 'Veröffentlichen fehlgeschlagen.',
      )
    } finally {
      setPublishing(false)
    }
  }

  const handleArchive = async () => {
    if (!window.confirm('Produkt archivieren? Es ist danach nicht mehr im Katalog sichtbar.')) return
    setActionError(null)
    setActionMessage(null)
    setArchiving(true)
    try {
      await updateProduct(product.id, { state: 'archived' })
      setActionMessage('Archiviert.')
    } catch (err) {
      setActionError(err instanceof MarketApiError ? err.message : 'Archivieren fehlgeschlagen.')
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">{product.title}</h1>
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-300">
          {STATE_LABEL[product.state]}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {isDraft && (
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
          >
            {publishing ? 'Veröffentliche …' : 'Veröffentlichen'}
          </button>
        )}
        {isPublished && (
          <button
            type="button"
            onClick={handleArchive}
            disabled={archiving}
            className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-300 disabled:opacity-50"
          >
            {archiving ? 'Archiviere …' : 'Archivieren'}
          </button>
        )}
      </div>

      {actionMessage && (
        <p className="mb-4 rounded-lg border border-cyan-900 bg-cyan-950/40 p-3 text-sm text-cyan-200">{actionMessage}</p>
      )}
      {actionError && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{actionError}</p>
      )}

      {isPublished && (
        <div className="mb-6 rounded-xl border border-neutral-800 p-4 text-sm text-neutral-300">
          <p>
            {formatPrice(product.priceCents, product.currency)} ·{' '}
            {product.remainingStock !== null ? `${product.remainingStock} verfügbar` : '– verfügbar'} von{' '}
            {product.initialStock} · max. {product.maxPerUser} pro Nutzer
          </p>
          <p className="mt-1 text-neutral-500">
            Preis, Stückzahl und Kontingent sind nach der Veröffentlichung fixiert — nur Beschreibung und Archivieren
            sind noch möglich.
          </p>
        </div>
      )}

      {!isArchived ? (
        <form onSubmit={handleSave} className="space-y-4">
          {isDraft && (
            <div>
              <label className="mb-1 block text-sm text-neutral-400">Titel</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-neutral-400">Beschreibung</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
          </div>

          {isDraft && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">Preis (€)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">Stückzahl (gesamt)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={initialStock}
                    onChange={(e) => setInitialStock(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">Max. pro Nutzer</label>
                  <input
                    type="number"
                    min={1}
                    value={maxPerUser}
                    onChange={(e) => setMaxPerUser(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">Drop-Zeitpunkt (optional)</label>
                  <input
                    type="datetime-local"
                    value={dropAt}
                    onChange={(e) => setDropAt(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={requiresShipping}
                  onChange={(e) => setRequiresShipping(e.target.checked)}
                />
                Physischer Versand nötig
              </label>
            </>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-neutral-800 px-4 py-2 font-medium text-neutral-100 disabled:opacity-50"
          >
            {saving ? 'Speichere …' : 'Speichern'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-neutral-400">{product.description}</p>
      )}
    </div>
  )
}

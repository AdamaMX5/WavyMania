import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProducts } from './ProductsContext'
import { MarketApiError } from './marketClient'

export function CreateProductView() {
  const { createProduct } = useProducts()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [maxPerUser, setMaxPerUser] = useState('2')
  const [dropAt, setDropAt] = useState('')
  const [requiresShipping, setRequiresShipping] = useState(false)
  const [waveId, setWaveId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const created = await createProduct({
        title,
        description,
        priceCents: Math.round(Number(price) * 100),
        initialStock: Number(initialStock),
        maxPerUser: Number(maxPerUser),
        dropAt: dropAt ? new Date(dropAt).toISOString() : null,
        requiresShipping,
        waveId: waveId.trim() || null,
      })
      navigate(`/produkte/${created.id}`)
    } catch (err) {
      setFormError(err instanceof MarketApiError ? err.message : 'Produkt konnte nicht erstellt werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Produkt / Angebot erstellen</h1>
      <p className="mb-4 text-sm text-neutral-400">
        Wird zunächst als Entwurf angelegt. Preis, Stückzahl und Kontingent lassen sich hier noch anpassen —
        nach dem Veröffentlichen ist nur noch die Kapazität nach oben, nicht mehr `initialStock` selbst, änderbar.
      </p>

      {formError && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{formError}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-400">Titel</label>
          <input
            required
            placeholder="z. B. Wavy Ökostrom-Tarif"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Beschreibung</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

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

        <div>
          <label className="mb-1 block text-sm text-neutral-400">Wave-Verknüpfung (optional)</label>
          <input
            placeholder="Wave-ID, falls an eine Kampagne gekoppelt"
            value={waveId}
            onChange={(e) => setWaveId(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={requiresShipping}
            onChange={(e) => setRequiresShipping(e.target.checked)}
          />
          Physischer Versand nötig
          <span className="text-neutral-500">(aus für digitale Güter / Verträge wie einen Stromtarif)</span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {submitting ? 'Wird angelegt …' : 'Als Entwurf anlegen'}
        </button>
      </form>
    </div>
  )
}

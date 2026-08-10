import type { EventTier } from '../types'

export interface TierRow {
  key: number
  tierId?: string
  name: string
  price: string
  capacity: string
}

let tierKeySeq = 0

export function emptyTierRow(): TierRow {
  return { key: tierKeySeq++, name: '', price: '', capacity: '' }
}

export function tierRowFrom(tier: EventTier): TierRow {
  return {
    key: tierKeySeq++,
    tierId: tier.tierId,
    name: tier.name,
    price: (tier.priceCents / 100).toFixed(2),
    capacity: String(tier.capacity),
  }
}

interface TierEditorProps {
  tiers: TierRow[]
  onChange: (tiers: TierRow[]) => void
  // 'editable': full control (create, or a draft event) — name/price/capacity
  // all open, rows addable/removable. 'published': only capacity may grow
  // (see TicketService's applyPublishedPatch) — name/price locked, no
  // add/remove, and capacity is floored at its server-known value.
  mode: 'editable' | 'published'
  // Required in 'published' mode — the server-known capacity per tierId,
  // used as `min` so the field can't be typed below it. Deliberately NOT
  // derived from the live `tiers` state, which would make `min` track
  // whatever the field currently holds and never block a decrease.
  minCapacityByTierId?: Record<string, number>
}

export function TierEditor({ tiers, onChange, mode, minCapacityByTierId }: TierEditorProps) {
  const isPublished = mode === 'published'

  const updateTier = (key: number, field: 'name' | 'price' | 'capacity', value: string) => {
    onChange(tiers.map((tier) => (tier.key === key ? { ...tier, [field]: value } : tier)))
  }
  const removeTier = (key: number) => onChange(tiers.filter((tier) => tier.key !== key))

  return (
    <div>
      <div className="space-y-2">
        {tiers.map((tier) => (
          <div key={tier.key} className="flex gap-2">
            <input
              disabled={isPublished}
              placeholder="Name"
              value={tier.name}
              onChange={(e) => updateTier(tier.key, 'name', e.target.value)}
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <input
              disabled={isPublished}
              type="number"
              min={0}
              step="0.01"
              placeholder="Preis (€)"
              value={tier.price}
              onChange={(e) => updateTier(tier.key, 'price', e.target.value)}
              className="w-28 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500 disabled:opacity-60"
            />
            <input
              type="number"
              min={isPublished ? minCapacityByTierId?.[tier.tierId ?? ''] ?? 0 : 0}
              placeholder="Kapazität"
              value={tier.capacity}
              onChange={(e) => updateTier(tier.key, 'capacity', e.target.value)}
              className="w-28 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
            />
            {!isPublished && (
              <button
                type="button"
                onClick={() => removeTier(tier.key)}
                className="px-2 text-neutral-500 hover:text-red-400"
                aria-label="Tier entfernen"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      {!isPublished && (
        <button
          type="button"
          onClick={() => onChange([...tiers, emptyTierRow()])}
          className="mt-2 text-sm text-cyan-400 underline"
        >
          + Tier hinzufügen
        </button>
      )}
    </div>
  )
}

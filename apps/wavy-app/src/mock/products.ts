import type { Product } from '../types'

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'WavyMania Cap "Mauerpark Drop"',
    description: 'Limitierte Cap zur Mauerpark-Wave, 200 Stück.',
    priceCents: 2900,
    currency: 'EUR',
    imageEmoji: '🧢',
    waveId: 'wave-1',
  },
  {
    id: 'prod-2',
    name: 'Café Milchbart Gutschein',
    description: '10€ Guthaben, einlösbar bei jedem Besuch.',
    priceCents: 1000,
    currency: 'EUR',
    imageEmoji: '🎟️',
    waveId: 'wave-3',
  },
  {
    id: 'prod-3',
    name: 'WavyMania Sticker-Pack',
    description: '8 Sticker im Wave-Design, wasserfest.',
    priceCents: 600,
    currency: 'EUR',
    imageEmoji: '✨',
  },
  {
    id: 'prod-4',
    name: 'Cleanup-Tiergarten T-Shirt',
    description: 'Fair produziert, Erlös geht an die Parkpflege.',
    priceCents: 2200,
    currency: 'EUR',
    imageEmoji: '👕',
    waveId: 'wave-5',
  },
]

import type { AvatarItem } from '../types'

// 'starter' items are available to every user immediately (so the equip UI
// always has real choices), 'earned' items unlock through in-app activity —
// see useAvatar.ts for how badge-waldretter is detected. The 🌳 emoji
// deliberately matches categoryEmoji.help in types.ts: that's the category
// this codebase already uses for volunteer-style Waves (e.g. a forest
// cleanup), so the badge reuses the same visual language instead of
// inventing a second "nature" meaning.
export const AVATAR_ITEMS: AvatarItem[] = [
  { id: 'head-cap', slot: 'head', emoji: '🧢', name: 'Cap', unlock: 'starter' },
  { id: 'head-crown', slot: 'head', emoji: '👑', name: 'Krone', unlock: 'starter' },
  { id: 'outfit-hoodie', slot: 'outfit', emoji: '🧥', name: 'Hoodie', unlock: 'starter' },
  {
    id: 'badge-waldretter',
    slot: 'badge',
    emoji: '🌳',
    name: 'Waldretter-Abzeichen',
    unlock: 'earned',
    earnHint: 'Bei einer Hilfe-Wave eingecheckt (z. B. eine Waldputz-Aktion)',
  },
]

export const STARTER_ITEM_IDS = AVATAR_ITEMS.filter((item) => item.unlock === 'starter').map((item) => item.id)

export function findAvatarItem(id: string | undefined): AvatarItem | undefined {
  return id ? AVATAR_ITEMS.find((item) => item.id === id) : undefined
}

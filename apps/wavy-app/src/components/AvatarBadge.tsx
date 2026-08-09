import type { Avatar } from '../types'
import { findAvatarItem } from '../avatar/avatarCatalog'

interface AvatarBadgeProps {
  avatar: Avatar
  size?: 'md' | 'lg'
}

export function AvatarBadge({ avatar, size = 'md' }: AvatarBadgeProps) {
  const head = findAvatarItem(avatar.equipped.head)
  const outfit = findAvatarItem(avatar.equipped.outfit)
  const badge = findAvatarItem(avatar.equipped.badge)
  const dim = size === 'lg' ? 'h-20 w-20 text-4xl' : 'h-14 w-14 text-2xl'

  return (
    <div className={`relative flex ${dim} items-center justify-center rounded-full bg-neutral-800`}>
      <span>{head?.emoji ?? '👤'}</span>
      {outfit && (
        <span
          title={outfit.name}
          className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-sm ring-2 ring-neutral-950"
        >
          {outfit.emoji}
        </span>
      )}
      {badge && (
        <span
          title={badge.name}
          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-sm ring-2 ring-neutral-950"
        >
          {badge.emoji}
        </span>
      )}
    </div>
  )
}

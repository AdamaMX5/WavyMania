import type { WaveCategory } from '../types'

export interface WaveIconOption {
  id: string
  emoji: string
  label: string
}

// Client-side stand-in for real media (see categoryEmoji in types.ts) — until
// MediaService upload is wired up for Waves, the creator picks one of these as
// the Wave's visual instead of only ever getting the fixed category emoji.
// Two 'Tanz' entries on purpose (💃/🕺) so the picker doesn't force one gender
// presentation on every dance-themed Wave.
export const WAVE_ICON_OPTIONS: WaveIconOption[] = [
  { id: 'party', emoji: '🎉', label: 'Party' },
  { id: 'dance', emoji: '💃', label: 'Tanz' },
  { id: 'dance-alt', emoji: '🕺', label: 'Tanz' },
  { id: 'music', emoji: '🎶', label: 'Musik' },
  { id: 'mic', emoji: '🎤', label: 'Bühne' },
  { id: 'coffee', emoji: '☕', label: 'Café' },
  { id: 'food', emoji: '🍕', label: 'Essen' },
  { id: 'help', emoji: '🌳', label: 'Hilfe' },
  { id: 'nature', emoji: '🌿', label: 'Natur' },
  { id: 'megaphone', emoji: '📣', label: 'Aufruf' },
  { id: 'guitar', emoji: '🎸', label: 'Kultur' },
  { id: 'art', emoji: '🎨', label: 'Kunst' },
  { id: 'sport', emoji: '⚽', label: 'Sport' },
  { id: 'game', emoji: '🎮', label: 'Gaming' },
  { id: 'book', emoji: '📚', label: 'Lernen' },
  { id: 'star', emoji: '✨', label: 'Highlight' },
]

// Keeps every existing Wave's default look identical to categoryEmoji in
// types.ts — a fresh CreateView pre-selects the icon matching its category,
// so a creator who never touches the picker gets exactly today's behavior.
export const DEFAULT_ICON_ID_BY_CATEGORY: Record<WaveCategory, string> = {
  event: 'party',
  commerce: 'coffee',
  help: 'help',
  nature: 'nature',
  recruiting: 'megaphone',
  culture: 'guitar',
}

export function findWaveIcon(id: string | undefined): WaveIconOption | undefined {
  return id ? WAVE_ICON_OPTIONS.find((opt) => opt.id === id) : undefined
}

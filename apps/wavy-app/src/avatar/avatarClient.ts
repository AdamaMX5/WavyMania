import type { Avatar } from '../types'
import { fetchWithRefresh } from '../lib/apiRequest'

// Unlike WaveService/GeoService/ActivationService, ObjectService is existing
// shared platform infrastructure with a stable production domain already
// (see ../../.claude/MSArchitecture/ObjectService.md /
// ../../.claude/MSArchitecture/Architecture.md) — so this follows authClient.ts's
// pattern (hardcoded default URL, direct cross-origin fetch; CORS is handled at
// the NGINX layer per the shared conventions) rather than the dev-proxy pattern
// used for the not-yet-stably-deployed Wave/Geo/Activation services. Still kept
// overridable via VITE_OBJECT_SERVICE_URL (root .env) in case that shared
// infrastructure ever moves domains.
const OBJECT_BASE_URL = import.meta.env.VITE_OBJECT_SERVICE_URL || 'https://object.freischule.info'

// One document per user, in a dedicated app-owned collection — avatars are
// public (isPublic: true) so a user's equipped items are visible to others
// viewing their profile, matching the "Gimmick" being shown off in the UI.
//
// Known gap (security review, MITTEL): `wavy-avatars` is not yet registered
// as an ObjectService class (see ObjectService.md, "Klassen/Namespace-ACL"),
// so ObjectService applies no ownership check on PATCH — any authenticated
// user can currently overwrite another user's avatar document. Closing this
// requires an ObjectService-admin action outside this repo/app's control:
// `POST /admin/classes` with `editRoles` and `membershipField: "ownerId"`
// (Member-Level-ACL's `membershipField` is a dot-path inside `data`, which is
// why `ownerId` below is denormalized into `data` and not left only in
// `refs` — `refs` can't be referenced by `membershipField`). Until that class
// is registered, `ownerId` is inert data, not enforcement.
const AVATAR_COLLECTION = 'wavy-avatars'

export class ObjectApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ObjectApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions = {}): Promise<T> {
  const res = await fetchWithRefresh(`${OBJECT_BASE_URL}${path}`, { accessToken, headers, ...init })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error ?? message
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new ObjectApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

interface ObjectDoc {
  id?: string
  _id?: string
  data: Avatar
}

export interface AvatarObject {
  id: string
  data: Avatar
}

function normalize(doc: ObjectDoc): AvatarObject {
  const id = doc.id ?? doc._id
  // Fail loudly rather than silently returning '' — a caller building
  // `/objects/wavy-avatars/${id}` from an empty id would hit the collection
  // root instead of a single document.
  if (!id) throw new ObjectApiError('ObjectService response missing document id', 500)
  return { id, data: doc.data }
}

// ObjectService.md doesn't pin down the exact list envelope (other services
// in this ecosystem use `{ items, page, limit, total }`) — tolerate both that
// shape and a bare array rather than crashing the profile page on a guess.
function extractItems(body: unknown): ObjectDoc[] {
  if (Array.isArray(body)) return body as ObjectDoc[]
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: ObjectDoc[] }).items
  }
  return []
}

export async function getMyAvatar(userId: string, accessToken: string): Promise<AvatarObject | null> {
  const query = new URLSearchParams({ 'ref[userId]': userId, limit: '1' })
  const body = await request<unknown>(`/objects/${AVATAR_COLLECTION}?${query}`, { accessToken })
  const items = extractItems(body)
  return items.length > 0 ? normalize(items[0]) : null
}

export async function createAvatar(userId: string, data: Avatar, accessToken: string): Promise<AvatarObject> {
  const doc = await request<ObjectDoc>(`/objects/${AVATAR_COLLECTION}`, {
    method: 'POST',
    // `ownerId` rides along in `data` alongside the `Avatar` fields — see the
    // module comment above on why (future membershipField target). It's
    // never sent again on patch, since ownership doesn't change.
    body: JSON.stringify({ data: { ...data, ownerId: userId }, refs: { userId }, isPublic: true, app: 'WavyMania' }),
    accessToken,
  })
  return normalize(doc)
}

// merge: true — data.equipped / data.unlockedItemIds are always sent as
// complete replacements for those top-level keys, so a shallow merge is
// exactly what's wanted (no risk of clobbering unrelated future fields,
// including the `ownerId` set at creation and intentionally omitted here).
export async function patchAvatar(id: string, data: Avatar, accessToken: string): Promise<AvatarObject> {
  const doc = await request<ObjectDoc>(`/objects/${AVATAR_COLLECTION}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ data, merge: true }),
    accessToken,
  })
  return normalize(doc)
}

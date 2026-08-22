import { fetchWithRefresh } from '../lib/apiRequest'

// Same rationale as avatarClient.ts for using ObjectService directly (stable
// shared-platform domain, hardcoded default overridable via env).
const OBJECT_BASE_URL = import.meta.env.VITE_OBJECT_SERVICE_URL || 'https://object.freischule.info'

// One document per Wave, in a dedicated app-owned collection — mirrors
// avatarClient.ts's 'wavy-avatars'. WaveService's Wave document has no concept
// of a user-chosen icon and rejects unknown POST/PATCH fields outright (see
// WaveService.md's error format section), so the selection can't ride along on
// the Wave itself — it's stored here instead. isPublic: true so every viewer of
// a Wave sees its creator's chosen icon, not just the creator.
//
// Known gap (mirrors avatarClient.ts, security review MITTEL): 'wavy-wave-icons'
// is not yet registered as an ObjectService class, so ObjectService applies no
// ownership check on PATCH — any authenticated user can currently overwrite
// another user's Wave icon. Closing this requires the same ObjectService-admin
// action described in avatarClient.ts (`POST /admin/classes` with editRoles +
// membershipField: "creatorId" — creatorId is denormalized into `data` below
// for exactly that future use, same as ownerId there).
const WAVE_ICON_COLLECTION = 'wavy-wave-icons'

export class WaveIconApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'WaveIconApiError'
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
    throw new WaveIconApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

interface WaveIconData {
  waveId: string
  creatorId: string
  icon: string
}

interface ObjectDoc {
  id?: string
  _id?: string
  data: WaveIconData
}

export interface WaveIconObject {
  id: string
  waveId: string
  icon: string
}

function normalize(doc: ObjectDoc): WaveIconObject {
  const id = doc.id ?? doc._id
  // Fail loudly rather than silently returning '' — same rationale as
  // avatarClient.ts's normalize.
  if (!id) throw new WaveIconApiError('ObjectService response missing document id', 500)
  return { id, waveId: doc.data.waveId, icon: doc.data.icon }
}

// Same tolerant envelope handling as avatarClient.ts's extractItems —
// ObjectService.md doesn't pin down the exact list shape.
function extractItems(body: unknown): ObjectDoc[] {
  if (Array.isArray(body)) return body as ObjectDoc[]
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: ObjectDoc[] }).items
  }
  return []
}

// Fetches every stored Wave icon in one request rather than one per Wave —
// mirrors WavesContext.refresh's "fetch up to the backend's max in one go, no
// pagination UI yet" choice, and keeps the list/map views from firing one
// ObjectService request per visible Wave. Unauthenticated is fine: every
// document here is isPublic.
export async function listWaveIcons(): Promise<WaveIconObject[]> {
  const body = await request<unknown>(`/objects/${WAVE_ICON_COLLECTION}?limit=100`)
  return extractItems(body).map(normalize)
}

export async function createWaveIcon(
  waveId: string,
  creatorId: string,
  icon: string,
  accessToken: string,
): Promise<WaveIconObject> {
  const doc = await request<ObjectDoc>(`/objects/${WAVE_ICON_COLLECTION}`, {
    method: 'POST',
    body: JSON.stringify({
      data: { waveId, creatorId, icon },
      refs: { waveId },
      isPublic: true,
      app: 'WavyMania',
    }),
    accessToken,
  })
  return normalize(doc)
}

export async function updateWaveIcon(id: string, icon: string, accessToken: string): Promise<WaveIconObject> {
  const doc = await request<ObjectDoc>(`/objects/${WAVE_ICON_COLLECTION}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ data: { icon }, merge: true }),
    accessToken,
  })
  return normalize(doc)
}

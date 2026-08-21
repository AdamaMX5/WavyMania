import { useCallback, useEffect, useRef, useState } from 'react'
import { latLngToCell, gridDisk } from 'h3-js'
import { useAuth } from '../auth/AuthContext'
import * as geoClient from './geoClient'
import type { HeatmapCell } from './geoClient'

const H3_RESOLUTION = 9
// Matches GeoService's default PING_MIN_INTERVAL_S (30s) — pinging faster
// just earns a harmless 429, but there's no point trying.
const PING_INTERVAL_MS = 30_000
const HEATMAP_REFRESH_INTERVAL_MS = 15_000
// 3k²+3k+1 = 169 cells at k=7 — comfortably under GeoService's 200-cell cap
// on GET /map while still covering a couple of km around the user at res 9.
const HEATMAP_RING_K = 7

export type LocationPermissionState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported'

interface UseLiveMapResult {
  permission: LocationPermissionState
  error: string | null
  cells: HeatmapCell[]
  // The user's current H3 (res 9) cell, if known — exposed so other
  // location-aware features (e.g. check-in submission) can reuse it instead
  // of asking for a second geolocation fix.
  currentCell: string | null
  requestLocation: () => void
}

// Drives the opt-in "Live-Karte": once the user grants geolocation, converts
// their position to an H3 cell on-device (raw lat/lng never leaves the
// browser — see GeoService.md's k-anonymity design), pings GeoService to
// contribute to the heatmap, and periodically re-fetches the surrounding
// cells' activity for rendering.
export function useLiveMap(): UseLiveMapResult {
  const { accessToken } = useAuth()
  const [permission, setPermission] = useState<LocationPermissionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cells, setCells] = useState<HeatmapCell[]>([])
  const [currentCell, setCurrentCell] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const lastPingAtRef = useRef(0)
  const centerCellRef = useRef<string | null>(null)
  const accessTokenRef = useRef(accessToken)
  accessTokenRef.current = accessToken

  const fetchHeatmap = useCallback((centerCell: string) => {
    // GET /map is public (see GeoService.md) — viewing the heatmap never
    // requires login, only publishing your own position via sendPing below
    // does. Pass the token along anyway when present; it's simply unused
    // server-side.
    const ring = gridDisk(centerCell, HEATMAP_RING_K)
    geoClient
      .getMap(ring, accessTokenRef.current ?? undefined)
      .then(({ cells: fetchedCells }) => {
        setCells(fetchedCells)
        setError(null)
      })
      .catch((err) => {
        // The heatmap is an overlay, not the core map — never block on it.
        setError(err instanceof Error ? err.message : 'Live-Karte konnte nicht geladen werden')
      })
  }, [])

  const handlePosition = useCallback(
    (position: GeolocationPosition) => {
      const cell = latLngToCell(position.coords.latitude, position.coords.longitude, H3_RESOLUTION)
      const cellChanged = cell !== centerCellRef.current
      centerCellRef.current = cell
      if (cellChanged) setCurrentCell(cell)

      const token = accessTokenRef.current
      const now = Date.now()
      if (token && now - lastPingAtRef.current >= PING_INTERVAL_MS) {
        lastPingAtRef.current = now
        geoClient.sendPing(cell, token).catch(() => {
          // Rate-limited (429) or transient failure — the next tick retries,
          // no need to surface a ping failure to the user.
        })
      }

      // watchPosition can fire far more often than the user actually moves
      // between H3 cells (GPS jitter, accuracy re-fixes); only re-fetch the
      // heatmap when the center cell actually changes. The periodic refresh
      // interval below still covers "activity changed, device didn't move".
      if (cellChanged) fetchHeatmap(cell)
    },
    [fetchHeatmap],
  )

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermission('unsupported')
      return
    }
    setPermission('requesting')
    setError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setPermission('granted')
        handlePosition(position)
      },
      (geoError) => {
        setPermission('denied')
        setError(geoError.message)
      },
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 },
    )
  }, [handlePosition])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  // Periodic refresh so activity decay / other users' pings show up even
  // while the device itself hasn't moved to a new cell.
  useEffect(() => {
    if (permission !== 'granted') return
    const id = window.setInterval(() => {
      if (centerCellRef.current) fetchHeatmap(centerCellRef.current)
    }, HEATMAP_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [permission, fetchHeatmap])

  return { permission, error, cells, currentCell, requestLocation }
}

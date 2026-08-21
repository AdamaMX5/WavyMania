import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection, Polygon } from 'geojson'
import { cellToBoundary } from 'h3-js'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useWaves } from '../waves/WavesContext'
import { useAuth } from '../auth/AuthContext'
import { useLiveMap } from '../geo/useLiveMap'
import { WaveDetailSheet } from '../components/WaveDetailSheet'
import { categoryEmoji } from '../types'
import type { HeatmapCell } from '../geo/geoClient'
import { QrScanner } from '../checkin/QrScanner'
import { parseCheckinQr } from '../checkin/qrPayload'
import * as activationClient from '../checkin/activationClient'
import { ActivationApiError, type Plausibility } from '../checkin/activationClient'

// Raw tile.openstreetmap.org is fine for local dev; a production deploy should
// switch to a provider that allows commercial/high-traffic use per OSM's tile
// usage policy (e.g. MapTiler, or a self-hosted tile server behind GeoService).
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

const HEATMAP_SOURCE_ID = 'geo-activity'
const HEATMAP_FILL_LAYER_ID = 'geo-activity-fill'
const HEATMAP_LINE_LAYER_ID = 'geo-activity-outline'
const EMPTY_HEATMAP: FeatureCollection<Polygon, { activity: number; opacity: number }> = {
  type: 'FeatureCollection',
  features: [],
}

// h3-js's cellToBoundary(..., true) returns GeoJSON-ordered [lng, lat] pairs
// but doesn't guarantee the ring is closed — close it defensively so the
// Polygon geometry is always valid.
function cellBoundary(h3: string): [number, number][] {
  const boundary = cellToBoundary(h3, true) as [number, number][]
  const [firstLng, firstLat] = boundary[0]
  const [lastLng, lastLat] = boundary[boundary.length - 1]
  return firstLng === lastLng && firstLat === lastLat ? boundary : [...boundary, boundary[0]]
}

function cellsToGeoJSON(cells: HeatmapCell[]): FeatureCollection<Polygon, { activity: number; opacity: number }> {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature',
      properties: {
        activity: cell.activity,
        // Activity is an unbounded, decay-weighted ping count — log-scale it
        // into a readable opacity band instead of assuming a fixed max.
        opacity: Math.min(0.75, 0.12 + Math.log2(cell.activity + 1) * 0.14),
      },
      geometry: { type: 'Polygon', coordinates: [cellBoundary(cell.h3)] },
    })),
  }
}

function checkinSuccessMessage(plausibility: Plausibility): string {
  switch (plausibility) {
    case 'match':
      return 'Check-in erfolgreich! ✅'
    case 'mismatch':
      return 'Check-in erfolgreich — dein Standort weicht allerdings vom Ort ab.'
    default:
      return 'Check-in erfolgreich.'
  }
}

function checkinErrorMessage(err: unknown): string {
  if (err instanceof ActivationApiError) {
    switch (err.status) {
      case 403:
        return 'Falscher oder abgelaufener Code — bitte scanne den aktuellen QR-Code am Standort.'
      case 404:
        return 'Dieser Ort ist gerade nicht aktiv.'
      case 429:
        return 'Du kannst hier gerade nicht erneut einchecken (Cooldown aktiv).'
      default:
        return err.message
    }
  }
  return err instanceof Error ? err.message : 'Check-in fehlgeschlagen.'
}

interface CheckinFeedback {
  type: 'success' | 'error'
  message: string
}

export function MapView() {
  const { waves } = useWaves()
  const { accessToken } = useAuth()
  const { permission, error: geoError, cells, currentCell, requestLocation } = useLiveMap()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = waves.find((w) => w.id === selectedId) ?? null

  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerKey, setScannerKey] = useState(0)
  const [submittingCheckin, setSubmittingCheckin] = useState(false)
  const [checkinFeedback, setCheckinFeedback] = useState<CheckinFeedback | null>(null)

  useEffect(() => {
    if (!checkinFeedback) return
    const id = window.setTimeout(() => setCheckinFeedback(null), 6000)
    return () => window.clearTimeout(id)
  }, [checkinFeedback])

  function openScanner() {
    setCheckinFeedback(null)
    setScannerKey((k) => k + 1)
    setScannerOpen(true)
  }

  async function handleQrDetect(payload: string) {
    const parsed = parseCheckinQr(payload)
    if (!parsed) {
      setCheckinFeedback({ type: 'error', message: 'Das ist kein gültiger Check-in-Code.' })
      // Remount the scanner so it keeps looking instead of freezing on a
      // non-matching QR code (e.g. someone scanned a wave-share link).
      setScannerKey((k) => k + 1)
      return
    }
    if (!accessToken) {
      setScannerOpen(false)
      setCheckinFeedback({ type: 'error', message: 'Bitte melde dich an, um einzuchecken.' })
      return
    }

    setSubmittingCheckin(true)
    try {
      const result = await activationClient.submitCheckin(
        { locationId: parsed.locationId, code: parsed.code, h3: currentCell ?? undefined },
        accessToken,
      )
      setScannerOpen(false)
      setCheckinFeedback({ type: 'success', message: checkinSuccessMessage(result.plausibility) })
    } catch (err) {
      setScannerOpen(false)
      setCheckinFeedback({ type: 'error', message: checkinErrorMessage(err) })
    } finally {
      setSubmittingCheckin(false)
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [13.405, 52.52],
      zoom: 11,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      map.addSource(HEATMAP_SOURCE_ID, { type: 'geojson', data: EMPTY_HEATMAP })
      map.addLayer({
        id: HEATMAP_FILL_LAYER_ID,
        type: 'fill',
        source: HEATMAP_SOURCE_ID,
        paint: {
          'fill-color': '#22d3ee',
          'fill-opacity': ['get', 'opacity'],
        },
      })
      map.addLayer({
        id: HEATMAP_LINE_LAYER_ID,
        type: 'line',
        source: HEATMAP_SOURCE_ID,
        paint: { 'line-color': '#22d3ee', 'line-opacity': 0.25, 'line-width': 1 },
      })
      setMapLoaded(true)
    })
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      setMapLoaded(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return
    const source = map.getSource(HEATMAP_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(cellsToGeoJSON(cells))
  }, [cells, mapLoaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers = waves
      .filter((wave) => wave.venue.lat !== undefined && wave.venue.lng !== undefined)
      .map((wave) => {
        const el = document.createElement('button')
        el.textContent = categoryEmoji[wave.category]
        el.style.fontSize = '22px'
        el.style.lineHeight = '1'
        el.style.background = 'none'
        el.style.border = 'none'
        el.style.cursor = 'pointer'
        el.onclick = () => setSelectedId(wave.id)

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([wave.venue.lng!, wave.venue.lat!])
          .addTo(map)

        // MapLibre's Marker sets its own generic aria-label on the element when
        // it's added to the map, overwriting any label set beforehand — so it
        // has to be (re-)applied after addTo() to keep it accessible.
        el.setAttribute('aria-label', wave.title)

        return marker
      })

    return () => markers.forEach((m) => m.remove())
  }, [waves])

  const showOptIn = permission !== 'granted'

  return (
    <div className="relative h-[calc(100vh-64px)]">
      <div ref={containerRef} className="h-full w-full" />

      {showOptIn && (
        <div className="absolute left-3 right-3 top-3 rounded-xl border border-neutral-800 bg-neutral-950/90 p-3 text-sm text-neutral-200 shadow-lg backdrop-blur">
          {permission === 'denied' ? (
            <p>Standortzugriff wurde verweigert. Aktiviere ihn in den Browser-Einstellungen, um die Live-Karte zu sehen.</p>
          ) : permission === 'unsupported' ? (
            <p>Dein Gerät unterstützt keine Standortfreigabe.</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p>
                {accessToken
                  ? 'Teile deinen Standort, um zu sehen, wo gerade etwas los ist. Wir senden nie deine Koordinaten — nur ein grobes Gebietsraster.'
                  : 'Teile deinen Standort, um zu sehen, wo gerade etwas los ist. Wir senden nie deine Koordinaten — nur ein grobes Gebietsraster. Melde dich zusätzlich an, wenn du selbst zur Live-Aktivität beitragen möchtest.'}
              </p>
              <button
                type="button"
                onClick={requestLocation}
                disabled={permission === 'requesting'}
                className="shrink-0 rounded-lg bg-cyan-500 px-3 py-1.5 font-medium text-neutral-950 disabled:opacity-60"
              >
                {permission === 'requesting' ? '…' : 'Aktivieren'}
              </button>
            </div>
          )}
          {geoError && <p className="mt-1 text-xs text-neutral-500">{geoError}</p>}
        </div>
      )}

      {/* geoError can also occur after the opt-in banner above has already
          disappeared (permission === 'granted', e.g. a later /map fetch
          failing) — surface it separately so it isn't silently dropped. */}
      {!showOptIn && geoError && (
        <div className="absolute left-3 right-3 top-3 rounded-xl border border-neutral-800 bg-neutral-950/90 p-3 text-xs text-neutral-400 shadow-lg backdrop-blur">
          {geoError}
        </div>
      )}

      {checkinFeedback && (
        <div
          className={`absolute bottom-4 left-3 right-3 rounded-xl border p-3 text-sm shadow-lg backdrop-blur ${
            checkinFeedback.type === 'success'
              ? 'border-emerald-800 bg-emerald-950/90 text-emerald-200'
              : 'border-amber-800 bg-amber-950/90 text-amber-200'
          }`}
        >
          {checkinFeedback.message}
        </div>
      )}

      {accessToken && (
        <button
          type="button"
          onClick={openScanner}
          aria-label="Check-in-QR scannen"
          className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500 text-2xl text-neutral-950 shadow-lg"
        >
          📷
        </button>
      )}

      {scannerOpen && (
        <QrScanner
          key={scannerKey}
          onDetect={handleQrDetect}
          onClose={() => setScannerOpen(false)}
          paused={submittingCheckin}
        />
      )}

      {selected && <WaveDetailSheet wave={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

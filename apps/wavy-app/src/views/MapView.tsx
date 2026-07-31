import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useWaves } from '../mock/WavesContext'
import { WaveDetailSheet } from '../components/WaveDetailSheet'

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

export function MapView() {
  const { waves } = useWaves()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = waves.find((w) => w.id === selectedId) ?? null

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [13.405, 52.52],
      zoom: 11,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const markers = waves.map((wave) => {
      const el = document.createElement('button')
      el.textContent = wave.imageEmoji
      el.style.fontSize = '22px'
      el.style.lineHeight = '1'
      el.style.background = 'none'
      el.style.border = 'none'
      el.style.cursor = 'pointer'
      el.onclick = () => setSelectedId(wave.id)

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([wave.venue.lng, wave.venue.lat])
        .addTo(map)

      // MapLibre's Marker sets its own generic aria-label on the element when
      // it's added to the map, overwriting any label set beforehand — so it
      // has to be (re-)applied after addTo() to keep it accessible.
      el.setAttribute('aria-label', wave.title)

      return marker
    })

    return () => markers.forEach((m) => m.remove())
  }, [waves])

  return (
    <div className="relative h-[calc(100vh-64px)]">
      <div ref={containerRef} className="h-full w-full" />
      {selected && <WaveDetailSheet wave={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

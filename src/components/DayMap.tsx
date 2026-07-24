import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'
import type { ItineraryItem } from '../types'
import { getMapsKey } from '../config'
import { loadGoogleMaps } from '../lib/googleMaps'
import { geocodeToCoords } from '../lib/geo'
import { directionsUrl } from '../lib/mapLinks'

// Map-mode filter categories. `departure`/`arrival` split a travel item into
// two points; the rest map 1:1 to item types.
export type MapCat = 'departure' | 'arrival' | 'lodging' | 'dining' | 'activity' | 'note'

interface MapPoint {
  address: string
  title: string
  /** "Departure" / "Arrival" for travel legs; empty for single-location items. */
  kind: string
}

// Minimal typing for the parts of the Google Maps JS API we touch. The loader
// returns the maps namespace (typed only for Geocoder in googleMaps.ts), so we
// cast to this richer shape rather than adding a conflicting global.
interface GLatLng {
  lat(): number
  lng(): number
}
interface GLatLngLiteral {
  lat: number
  lng: number
}
interface GMap {
  fitBounds(bounds: GLatLngBounds, padding?: number): void
  setCenter(p: GLatLngLiteral): void
  setZoom(z: number): void
}
interface GMarker {
  setMap(m: GMap | null): void
  getPosition(): GLatLng | null
  addListener(ev: string, cb: () => void): { remove: () => void }
}
interface GPolyline {
  setMap(m: GMap | null): void
}
interface GInfoWindow {
  open(opts: { map: GMap; anchor: GMarker }): void
}
interface GLatLngBounds {
  extend(p: GLatLngLiteral): void
}
interface GMapsApi {
  Map: new (el: HTMLElement, opts?: Record<string, unknown>) => GMap
  Marker: new (opts: Record<string, unknown>) => GMarker
  Polyline: new (opts: Record<string, unknown>) => GPolyline
  InfoWindow: new (opts: Record<string, unknown>) => GInfoWindow
  LatLngBounds: new () => GLatLngBounds
}

interface Props {
  /** The whole day's items (already the day, not the list filter). */
  items: ItineraryItem[]
  /** Which map categories are enabled. */
  cats: Record<MapCat, boolean>
}

/** Build the ordered, category-filtered list of points for the day. */
function buildPoints(items: ItineraryItem[], cats: Record<MapCat, boolean>): MapPoint[] {
  const ordered = [...items].sort((a, b) =>
    (a.startTime || '99').localeCompare(b.startTime || '99'),
  )
  const points: MapPoint[] = []
  for (const it of ordered) {
    if (it.type === 'travel') {
      const dep = (it.from || it.location || '').trim()
      if (cats.departure && dep) points.push({ address: dep, title: it.title, kind: 'Departure' })
      const arr = (it.to || it.location || '').trim()
      if (cats.arrival && arr) points.push({ address: arr, title: it.title, kind: 'Arrival' })
    } else {
      const cat = it.type as MapCat
      if (!cats[cat]) continue
      const loc = (it.location || '').trim()
      if (loc) points.push({ address: loc, title: it.title, kind: '' })
    }
  }
  return points
}

export default function DayMap({ items, cats }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'nokey' | 'error'>(
    'loading',
  )

  const points = useMemo(() => buildPoints(items, cats), [items, cats])

  // Ordered, consecutive-deduped addresses for the "Get directions" link.
  const directionStops = useMemo(() => {
    const out: string[] = []
    for (const p of points) {
      if (out[out.length - 1] === p.address) continue
      out.push(p.address)
    }
    return out
  }, [points])

  // Signature so the map effect only re-runs when the meaningful inputs change.
  const sig = useMemo(
    () => JSON.stringify(points.map((p) => [p.address, p.title, p.kind])),
    [points],
  )

  useEffect(() => {
    let cancelled = false
    const cleanups: Array<() => void> = []

    if (points.length === 0) {
      setStatus('empty')
      return
    }
    if (!getMapsKey()) {
      setStatus('nokey')
      return
    }

    setStatus('loading')

    ;(async () => {
      let maps: GMapsApi
      try {
        maps = (await loadGoogleMaps(getMapsKey())) as unknown as GMapsApi
      } catch {
        if (!cancelled) setStatus('error')
        return
      }

      // Geocode each unique address in parallel; reuse coords per address.
      const unique = [...new Set(points.map((p) => p.address))]
      const resolved = await Promise.all(unique.map((a) => geocodeToCoords(a)))
      if (cancelled) return
      const coordByAddr = new Map<string, { lat: number; lon: number }>()
      unique.forEach((a, i) => {
        const c = resolved[i]
        if (c) coordByAddr.set(a, c)
      })

      const el = containerRef.current
      if (!el) return
      if (coordByAddr.size === 0) {
        setStatus('empty')
        return
      }

      const map = new maps.Map(el, {
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        zoomControl: true,
      })
      const bounds = new maps.LatLngBounds()
      const path: GLatLngLiteral[] = []

      points.forEach((p, i) => {
        const c = coordByAddr.get(p.address)
        if (!c) return
        const pos = { lat: c.lat, lng: c.lon }
        const marker = new maps.Marker({
          position: pos,
          map,
          label: { text: String(i + 1), color: '#ffffff', fontSize: '12px' },
          title: p.kind ? `${p.title} (${p.kind})` : p.title,
        })
        // Title (and optional kind) go in headerContent so Google's header row
        // for the close button doesn't leave blank space above the text.
        const info = new maps.InfoWindow({
          headerContent: p.kind
            ? `<div style="font-weight:600">${escapeHtml(p.title)}</div><div style="color:#555;font-size:12px;font-weight:400">${escapeHtml(p.kind)}</div>`
            : escapeHtml(p.title),
        })
        const listener = marker.addListener('click', () =>
          info.open({ map, anchor: marker }),
        )
        cleanups.push(() => listener.remove())
        cleanups.push(() => marker.setMap(null))
        bounds.extend(pos)
        path.push(pos)
      })

      if (path.length >= 2) {
        const line = new maps.Polyline({
          path,
          map,
          geodesic: true,
          strokeColor: '#14b8a6',
          strokeOpacity: 0.9,
          strokeWeight: 3,
        })
        cleanups.push(() => line.setMap(null))
      }

      if (path.length === 1) {
        map.setCenter(path[0])
        map.setZoom(14)
      } else {
        map.fitBounds(bounds, 48)
      }

      if (!cancelled) setStatus('ready')
    })()

    return () => {
      cancelled = true
      for (const fn of cleanups) fn()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])

  function openDirections() {
    const url = directionsUrl(directionStops)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />

      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none">
          {status === 'loading' && <p className="text-white/60">Loading map…</p>}
          {status === 'empty' && (
            <p className="text-white/50">No mapped locations for the selected filters.</p>
          )}
          {status === 'error' && (
            <p className="text-white/50">Couldn’t load the map right now.</p>
          )}
          {status === 'nokey' && (
            <p className="text-white/50 max-w-xs">
              Add a Google Maps key in settings to show the map. You can still get
              directions below.
            </p>
          )}
        </div>
      )}

      {directionStops.length > 0 && (
        <button
          onClick={openDirections}
          className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-full bg-teal hover:bg-teal-deep text-white px-4 py-2 shadow-lg"
        >
          <Navigation size={16} />
          <span className="text-sm font-medium">Get directions</span>
        </button>
      )}
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'
import type { ItineraryItem } from '../types'
import { getMapsKey } from '../config'
import { loadGoogleMaps } from '../lib/googleMaps'
import { geocodeToCoords, inferPlaceFromTitle, isPlaceableTitle } from '../lib/geo'
import { directionsUrl } from '../lib/mapLinks'

// Map-mode filter categories. `departure`/`arrival` split a travel item into
// two points; the rest map 1:1 to item types.
export type MapCat = 'departure' | 'arrival' | 'lodging' | 'dining' | 'activity' | 'note'

interface MapPoint {
  /** Address to geocode, or the event title when `inferred`. */
  address: string
  title: string
  /** "Departure" / "Arrival" for travel legs; empty for single-location items. */
  kind: string
  /** Guessed from the title + day city because the item has no location. */
  inferred?: boolean
}

/** Stable identity for a point's lookup, so guesses and addresses never collide. */
const pointKey = (p: MapPoint) => `${p.inferred ? 'title' : 'addr'}:${p.address}`

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
  addListener(ev: string, cb: () => void): { remove: () => void }
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
  close(): void
  setContent(content: HTMLElement | string): void
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
  /** Displayed day, used to place cross-day travel legs correctly. */
  day: string
  /** Which map categories are enabled. */
  cats: Record<MapCat, boolean>
  /** The day's destination; lets items without a location be placed by name. */
  dayCity?: string
}

/** Build the ordered, category-filtered list of points for the day. */
function buildPoints(
  items: ItineraryItem[],
  day: string,
  cats: Record<MapCat, boolean>,
  dayCity?: string,
): MapPoint[] {
  const ordered = [...items].sort((a, b) =>
    (a.startTime || '99').localeCompare(b.startTime || '99'),
  )
  const points: MapPoint[] = []
  for (const it of ordered) {
    if (it.type === 'travel') {
      const dep = (it.from || it.location || '').trim()
      if (cats.departure && it.date === day && dep)
        points.push({ address: dep, title: it.title, kind: 'Departure' })
      const arr = (it.to || it.location || '').trim()
      if (cats.arrival && (it.endDate || it.date) === day && arr)
        points.push({ address: arr, title: it.title, kind: 'Arrival' })
    } else {
      const cat = it.type as MapCat
      if (!cats[cat]) continue
      const loc = (it.location || '').trim()
      if (loc) {
        points.push({ address: loc, title: it.title, kind: '' })
      } else if (dayCity && isPlaceableTitle(it.title)) {
        // No location saved, but the title names something we can look up in
        // the day's city.
        points.push({ address: it.title.trim(), title: it.title, kind: '', inferred: true })
      }
    }
  }
  return points
}

export default function DayMap({ items, day, cats, dayCity }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'nokey' | 'error'>(
    'loading',
  )
  // Addresses discovered for inferred points, so directions can use them.
  const [foundAddresses, setFoundAddresses] = useState<Record<string, string>>({})

  const points = useMemo(
    () => buildPoints(items, day, cats, dayCity),
    [items, day, cats, dayCity],
  )

  // Ordered, consecutive-deduped addresses for the "Get directions" link.
  // Inferred points only join once we know the real address they resolved to.
  const directionStops = useMemo(() => {
    const out: string[] = []
    for (const p of points) {
      const stop = p.inferred ? foundAddresses[pointKey(p)] : p.address
      if (!stop || out[out.length - 1] === stop) continue
      out.push(stop)
    }
    return out
  }, [points, foundAddresses])

  // Signature so the map effect only re-runs when the meaningful inputs change.
  const sig = useMemo(
    () => JSON.stringify([dayCity, points.map((p) => [p.address, p.title, p.kind, !!p.inferred])]),
    [points, dayCity],
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

      // Resolve each distinct lookup once, in parallel. Saved addresses go
      // through the geocoder; title-only points go through the venue search.
      const unique = new Map<string, MapPoint>()
      for (const p of points) if (!unique.has(pointKey(p))) unique.set(pointKey(p), p)
      const keys = [...unique.keys()]
      const resolved = await Promise.all(
        keys.map(async (k) => {
          const p = unique.get(k)!
          if (!p.inferred) return { coords: await geocodeToCoords(p.address), address: p.address }
          const place = await inferPlaceFromTitle(p.address, dayCity)
          return place
            ? { coords: { lat: place.lat, lon: place.lon }, address: place.label }
            : { coords: null, address: '' }
        }),
      )
      if (cancelled) return

      const coordByKey = new Map<string, { lat: number; lon: number }>()
      const addresses: Record<string, string> = {}
      keys.forEach((k, i) => {
        const { coords, address } = resolved[i]
        if (!coords) return
        coordByKey.set(k, coords)
        if (unique.get(k)!.inferred) addresses[k] = address
      })
      setFoundAddresses(addresses)

      const el = containerRef.current
      if (!el) return
      if (coordByKey.size === 0) {
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
      const infoWindow = new maps.InfoWindow({
        headerDisabled: true,
        maxWidth: 260,
      })
      let openMarker: GMarker | null = null

      const mapClickListener = map.addListener('click', () => {
        infoWindow.close()
        openMarker = null
      })
      cleanups.push(() => mapClickListener.remove())
      cleanups.push(() => infoWindow.close())

      const bounds = new maps.LatLngBounds()
      const path: GLatLngLiteral[] = []

      // Number the markers that actually render, so the labels match the order
      // of the stops in the directions link.
      let stopNumber = 0
      points.forEach((p) => {
        const c = coordByKey.get(pointKey(p))
        if (!c) return
        const pos = { lat: c.lat, lng: c.lon }
        stopNumber += 1
        const marker = new maps.Marker({
          position: pos,
          map,
          label: { text: String(stopNumber), color: '#ffffff', fontSize: '12px' },
          // Guesses are dimmed so they read as less certain than saved pins.
          opacity: p.inferred ? 0.65 : 1,
          title: p.kind ? `${p.title} (${p.kind})` : p.title,
        })
        // One shared InfoWindow: text stays visible, only one popup at a time,
        // and tapping the map or the same marker again closes it.
        const listener = marker.addListener('click', () => {
          if (openMarker === marker) {
            infoWindow.close()
            openMarker = null
            return
          }
          infoWindow.setContent(
            buildInfoContent(p.title, p.kind, p.inferred ? addresses[pointKey(p)] : ''),
          )
          infoWindow.open({ map, anchor: marker })
          openMarker = marker
        })
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

/** `guessedAddress` is set only for pins found from the title, not saved on the item. */
function buildInfoContent(title: string, kind: string, guessedAddress: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText =
    'color:#111;font-family:system-ui,-apple-system,sans-serif;line-height:1.3;margin:0;padding:0;'

  const titleEl = document.createElement('div')
  titleEl.style.cssText = 'font-size:13px;font-weight:600;margin:0;padding:0;'
  titleEl.textContent = title
  wrap.appendChild(titleEl)

  if (kind) {
    const kindEl = document.createElement('div')
    kindEl.style.cssText = 'color:#555;font-size:12px;margin:2px 0 0;padding:0;'
    kindEl.textContent = kind
    wrap.appendChild(kindEl)
  }

  if (guessedAddress) {
    const guessEl = document.createElement('div')
    guessEl.style.cssText = 'color:#555;font-size:12px;margin:4px 0 0;padding:0;'
    guessEl.textContent = guessedAddress
    wrap.appendChild(guessEl)

    const noteEl = document.createElement('div')
    noteEl.style.cssText = 'color:#8a6d1f;font-size:11px;margin:2px 0 0;padding:0;'
    noteEl.textContent = 'Best guess from the name — no location saved'
    wrap.appendChild(noteEl)
  }

  return wrap
}

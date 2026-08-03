import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Navigation, type LucideIcon } from 'lucide-react'
import type { ItineraryItem } from '../types'
import { getMapsKey, getMapsMapId } from '../config'
import { loadGoogleMaps } from '../lib/googleMaps'
import { geocodeToCoords, inferPlaceFromTitle, isPlaceableTitle } from '../lib/geo'
import { sortTimeForDay } from '../lib/itineraryDay'
import { directionsUrl } from '../lib/mapLinks'
import { iconFor } from './icons'

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
  /** Same glyph the item shows in the list, so the two views read alike. */
  icon: LucideIcon
}

/** Stable identity for a point's lookup, so guesses and addresses never collide. */
const pointKey = (p: MapPoint) => `${p.inferred ? 'title' : 'addr'}:${p.address}`

// Minimal typing for the parts of the Google Maps JS API we touch. The loader
// returns the maps namespace (typed only for Geocoder in googleMaps.ts), so we
// cast to this richer shape rather than adding a conflicting global.
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
interface GAdvancedMarker {
  map: GMap | null
  addListener(ev: string, cb: () => void): { remove: () => void }
}
interface GPolyline {
  setMap(m: GMap | null): void
}
interface GLatLngBounds {
  extend(p: GLatLngLiteral): void
}
interface GMapsApi {
  Map: new (el: HTMLElement, opts?: Record<string, unknown>) => GMap
  Polyline: new (opts: Record<string, unknown>) => GPolyline
  LatLngBounds: new () => GLatLngBounds
  marker: {
    AdvancedMarkerElement: new (opts: Record<string, unknown>) => GAdvancedMarker
  }
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
  // Lodging you woke up in sorts to the top: whatever else the day holds, the
  // journey starts at the hotel.
  const ordered = [...items].sort((a, b) =>
    sortTimeForDay(a, day).localeCompare(sortTimeForDay(b, day)),
  )
  const points: MapPoint[] = []
  for (const it of ordered) {
    const icon = iconFor(it)
    if (it.type === 'travel') {
      const dep = (it.from || it.location || '').trim()
      if (cats.departure && it.date === day && dep)
        points.push({ address: dep, title: it.title, kind: 'Departure', icon })
      const arr = (it.to || it.location || '').trim()
      if (cats.arrival && (it.endDate || it.date) === day && arr)
        points.push({ address: arr, title: it.title, kind: 'Arrival', icon })
    } else {
      const cat = it.type as MapCat
      if (!cats[cat]) continue
      const loc = (it.location || '').trim()
      if (loc) {
        points.push({ address: loc, title: it.title, kind: '', icon })
      } else if (dayCity && isPlaceableTitle(it.title)) {
        // No location saved, but the title names something we can look up in
        // the day's city.
        points.push({
          address: it.title.trim(),
          title: it.title,
          kind: '',
          inferred: true,
          icon,
        })
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
    () =>
      JSON.stringify([
        dayCity,
        points.map((p) => [p.address, p.title, p.kind, !!p.inferred, p.icon.displayName]),
      ]),
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
        // Advanced markers require a map ID; it also drives cloud styling.
        mapId: getMapsMapId(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        zoomControl: true,
      })

      const bounds = new maps.LatLngBounds()
      const path: GLatLngLiteral[] = []
      // Each pin is a React root so the map reuses the list's icons directly.
      const pins: { root: Root; point: MapPoint; stop: number }[] = []
      let selected: number | null = null

      function paint() {
        for (const pin of pins) {
          pin.root.render(
            <MarkerPill
              point={pin.point}
              stop={pin.stop}
              selected={selected === pin.stop}
              guessedAddress={pin.point.inferred ? addresses[pointKey(pin.point)] : ''}
            />,
          )
        }
      }

      const mapClickListener = map.addListener('click', () => {
        selected = null
        paint()
      })
      cleanups.push(() => mapClickListener.remove())

      // Number the markers that actually render, so the labels match the order
      // of the stops in the directions link.
      let stopNumber = 0
      points.forEach((p) => {
        const c = coordByKey.get(pointKey(p))
        if (!c) return
        const pos = { lat: c.lat, lng: c.lon }
        stopNumber += 1
        const stop = stopNumber

        const content = document.createElement('div')
        const root = createRoot(content)
        pins.push({ root, point: p, stop })

        const marker = new maps.marker.AdvancedMarkerElement({
          position: pos,
          map,
          content,
          title: p.kind ? `${p.title} (${p.kind})` : p.title,
        })
        // Tapping a pin names it; tapping it again or the map clears it. Only
        // one title shows at a time, which keeps a busy day legible.
        const listener = marker.addListener('click', () => {
          selected = selected === stop ? null : stop
          paint()
        })

        cleanups.push(() => listener.remove())
        cleanups.push(() => {
          marker.map = null
          // Deferred so React is never asked to unmount mid-render.
          queueMicrotask(() => root.unmount())
        })
        bounds.extend(pos)
        path.push(pos)
      })
      paint()

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

/**
 * A map pin: the item's own icon plus its stop number, expanding to name the
 * place when tapped. `guessedAddress` is set only for pins found from the
 * title, which are dimmed so they don't read as a saved location.
 */
function MarkerPill({
  point,
  stop,
  selected,
  guessedAddress,
}: {
  point: MapPoint
  stop: number
  selected: boolean
  guessedAddress: string
}) {
  const Ico = point.icon
  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex items-center gap-1.5 rounded-full border px-2 py-1 shadow-lg cursor-pointer ${
          selected
            ? 'bg-teal border-teal text-white'
            : 'bg-[#1a1a1a] border-white/25 text-white'
        } ${point.inferred && !selected ? 'opacity-70 border-dashed' : ''}`}
      >
        <Ico size={14} className="shrink-0" />
        <span className="text-[11px] font-bold tabular-nums leading-none">{stop}</span>
        {selected && (
          <span className="max-w-[9rem] truncate text-[11px] leading-none">{point.title}</span>
        )}
      </div>

      {selected && (point.kind || guessedAddress) && (
        <div className="mt-1 max-w-[12rem] rounded-lg bg-[#1a1a1a] border border-white/15 px-2 py-1 text-center shadow-lg">
          {point.kind && <p className="text-[10px] text-teal/90 leading-snug">{point.kind}</p>}
          {guessedAddress && (
            <>
              <p className="text-[10px] text-white/70 leading-snug break-words">
                {guessedAddress}
              </p>
              <p className="text-[10px] text-amber-400/90 leading-snug">
                Best guess from the name
              </p>
            </>
          )}
        </div>
      )}

      {/* Anchors the pin: advanced markers align content by its bottom centre. */}
      <span className="mt-0.5 h-2 w-2 rounded-full bg-teal ring-2 ring-black/60" />
    </div>
  )
}

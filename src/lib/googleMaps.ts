// Loads the Google Maps JavaScript API once. The JS API's Geocoder is the
// browser-supported way to geocode (the REST web services block CORS).
// The `places` library adds venue-name search, which the Geocoder handles
// poorly; it needs "Places API (New)" enabled on the key, so callers must
// tolerate `maps.places` being absent.

interface MapsGeocoderResult {
  formatted_address?: string
  types?: string[]
  geometry: { location: { lat: () => number; lng: () => number } }
}
interface MapsGeocoder {
  geocode: (req: { address: string }) => Promise<{ results: MapsGeocoderResult[] }>
}

/** A hit from the Places API (New) text search. */
export interface MapsPlaceResult {
  displayName?: string | null
  formattedAddress?: string | null
  location?: { lat: () => number; lng: () => number } | null
  types?: string[] | null
}
export interface MapsPlaceSearchRequest {
  textQuery: string
  fields: string[]
  /** Soft bias — results outside the circle are still allowed, just ranked lower. */
  locationBias?: { center: { lat: number; lng: number }; radius: number }
  maxResultCount?: number
}
interface MapsPlaceStatic {
  searchByText: (req: MapsPlaceSearchRequest) => Promise<{ places: MapsPlaceResult[] }>
}
interface MapsNamespace {
  Geocoder: new () => MapsGeocoder
  /** Undefined when the key has no access to Places API (New). */
  places?: { Place?: MapsPlaceStatic }
}

declare global {
  interface Window {
    __grandeaseMapsReady?: () => void
  }
}

// Accessed via a cast so we don't clash with the window.google typing in auth.ts.
function mapsNamespace(): MapsNamespace | undefined {
  return (window as unknown as { google?: { maps?: MapsNamespace } }).google?.maps
}

let loadPromise: Promise<MapsNamespace> | null = null

export function loadGoogleMaps(apiKey: string): Promise<MapsNamespace> {
  const existing = mapsNamespace()
  if (existing) return Promise.resolve(existing)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<MapsNamespace>((resolve, reject) => {
    window.__grandeaseMapsReady = () => {
      const ns = mapsNamespace()
      if (ns) resolve(ns)
      else reject(new Error('Google Maps loaded without maps namespace'))
    }
    const s = document.createElement('script')
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&libraries=geocoding,places&loading=async&callback=__grandeaseMapsReady`
    s.async = true
    s.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Google Maps JavaScript API'))
    }
    document.head.appendChild(s)
  })
  return loadPromise
}

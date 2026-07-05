// Loads the Google Maps JavaScript API once. The JS API's Geocoder is the
// browser-supported way to geocode (the REST web services block CORS).

interface MapsGeocoderResult {
  geometry: { location: { lat: () => number; lng: () => number } }
}
interface MapsGeocoder {
  geocode: (req: { address: string }) => Promise<{ results: MapsGeocoderResult[] }>
}
interface MapsNamespace {
  Geocoder: new () => MapsGeocoder
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
      `&libraries=geocoding&loading=async&callback=__grandeaseMapsReady`
    s.async = true
    s.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Google Maps JavaScript API'))
    }
    document.head.appendChild(s)
  })
  return loadPromise
}

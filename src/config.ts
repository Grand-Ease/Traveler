// App configuration.

// Resolve a /public asset path correctly on GitHub Pages subpaths.
export const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`

// Google Maps Platform API key. Used client-side via the Maps JavaScript API
// for accurate geocoding -> automatic time zones. Optional: baked in at build
// time via VITE_GOOGLE_MAPS_API_KEY, or entered at runtime (stored in this
// browser). Without it, a keyless Nominatim fallback is used.
const LS_MAPS_KEY = 'grandease.googleMapsKey'
/** True when a Maps key is baked into the build (VITE_GOOGLE_MAPS_API_KEY). */
export function isMapsKeyFromEnv(): boolean {
  const v = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  return !!(v && v.trim())
}
export function getMapsKey(): string {
  const fromEnv = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return localStorage.getItem(LS_MAPS_KEY)?.trim() || ''
}
export function setMapsKey(k: string) {
  localStorage.setItem(LS_MAPS_KEY, k.trim())
}

// Optional: OpenWeatherMap key for the weather header (client-side, user owned).
const LS_WEATHER_KEY = 'grandease.owmKey'
export function getWeatherKey(): string {
  return localStorage.getItem(LS_WEATHER_KEY)?.trim() || ''
}
export function setWeatherKey(k: string) {
  localStorage.setItem(LS_WEATHER_KEY, k.trim())
}

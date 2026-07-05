// App configuration.
//
// The Google OAuth *Client ID* is public (no secret). It can be supplied at
// build time via VITE_GOOGLE_CLIENT_ID, or entered at runtime and stored in
// localStorage so the hosted GitHub Pages build works without a rebuild.

const LS_CLIENT_ID = 'grandease.googleClientId'

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar'

// Resolve a /public asset path correctly on GitHub Pages subpaths.
export const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`

// Marker written into every trip calendar's description.
export const APP_MARKER = 'GrandEase Traveler'
export const META_VERSION = 1

export function getClientId(): string {
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  return localStorage.getItem(LS_CLIENT_ID)?.trim() || ''
}

export function setClientId(id: string) {
  localStorage.setItem(LS_CLIENT_ID, id.trim())
}

// Google Maps Platform API key (separate from the OAuth Client ID). Used client-side
// via the Maps JavaScript API for accurate geocoding -> automatic time zones.
const LS_MAPS_KEY = 'grandease.googleMapsKey'
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

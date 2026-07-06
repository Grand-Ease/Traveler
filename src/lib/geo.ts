import tzlookup from 'tz-lookup'
import type { ItineraryItem } from '../types'
import { getMapsKey } from '../config'
import { loadGoogleMaps } from './googleMaps'

// Automatic timezone detection from a location string — fully client-side.
//   address --(geocode)--> lat/lon --(tz-lookup, offline)--> IANA tz
// Geocoding uses the Google Maps JavaScript API when a Maps key is configured
// (most accurate), otherwise falls back to OpenStreetMap Nominatim (keyless).
// Results are cached in localStorage.

const CACHE_KEY = 'grandease.geoTzCache'
const COORD_CACHE_KEY = 'grandease.geoCoordCache'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

type Cache = Record<string, string | null>

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}
function saveCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* ignore quota */
  }
}

type Coords = { lat: number; lon: number }
type CoordCache = Record<string, Coords | null>

function loadCoordCache(): CoordCache {
  try {
    return JSON.parse(localStorage.getItem(COORD_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}
function saveCoordCache(c: CoordCache) {
  try {
    localStorage.setItem(COORD_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* ignore quota */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let lastCall = 0
async function throttle() {
  const wait = 1100 - (Date.now() - lastCall) // Nominatim: max ~1 req/sec
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()
}

function tzFromLatLon(lat: number, lon: number): string | null {
  try {
    return tzlookup(lat, lon)
  } catch {
    return null
  }
}

async function geocodeGoogle(query: string): Promise<{ lat: number; lon: number } | null> {
  const maps = await loadGoogleMaps(getMapsKey())
  const geocoder = new maps.Geocoder()
  const { results } = await geocoder.geocode({ address: query })
  if (!results.length) return null
  const loc = results[0].geometry.location
  return { lat: loc.lat(), lon: loc.lng() }
}

async function geocodeNominatim(
  query: string,
): Promise<{ lat: number; lon: number } | null> {
  await throttle()
  const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(String(res.status))
  const data = (await res.json()) as { lat: string; lon: string }[]
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

/**
 * Resolve a location string to coordinates, using Google (when a Maps key is
 * configured) and falling back to Nominatim. Throws on failure so callers can
 * decide how to cache / recover.
 */
async function geocodeResolve(q: string): Promise<Coords | null> {
  try {
    return getMapsKey() ? await geocodeGoogle(q) : await geocodeNominatim(q)
  } catch {
    // Google failed (bad key, quota, etc.) — try the keyless fallback once.
    if (getMapsKey()) return await geocodeNominatim(q)
    throw new Error('geocode failed')
  }
}

/** Resolve a single location string to an IANA timezone (or null if unknown). */
export async function timezoneForQuery(query: string): Promise<string | null> {
  const q = query.trim()
  if (!q) return null
  const key = q.toLowerCase()
  const cache = loadCache()
  if (key in cache) return cache[key]

  try {
    const coords = await geocodeResolve(q)
    const tz = coords ? tzFromLatLon(coords.lat, coords.lon) : null
    cache[key] = tz
    saveCache(cache)
    return tz
  } catch {
    return null // caller falls back to device tz
  }
}

/**
 * Resolve a single location string to coordinates (or null if unknown).
 * Mirrors `timezoneForQuery`: a dedicated localStorage cache (including null
 * results) backs Google geocoding with a Nominatim fallback.
 */
export async function geocodeToCoords(query: string): Promise<Coords | null> {
  const q = query.trim()
  if (!q) return null
  const key = q.toLowerCase()
  const cache = loadCoordCache()
  if (key in cache) return cache[key]

  try {
    const coords = await geocodeResolve(q)
    cache[key] = coords
    saveCoordCache(cache)
    return coords
  } catch {
    return null
  }
}

/** Best location candidate(s) for an item, in priority order. */
function candidatesFor(item: ItineraryItem): string[] {
  if (item.type === 'travel') {
    // Departure local time is what "startTime" means for travel.
    return [item.from, item.location, item.to].filter(Boolean) as string[]
  }
  return [item.location].filter(Boolean) as string[]
}

/** Resolve the timezone implied by an item's location(s). */
export async function timezoneForItem(item: ItineraryItem): Promise<string | null> {
  for (const c of candidatesFor(item)) {
    const tz = await timezoneForQuery(c)
    if (tz) return tz
  }
  return null
}

export function hasLocation(item: ItineraryItem): boolean {
  return candidatesFor(item).length > 0
}

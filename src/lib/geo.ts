import tzlookup from 'tz-lookup'
import type { ItineraryItem } from '../types'
import { getMapsKey } from '../config'
import { loadGoogleMaps } from './googleMaps'
import {
  expandedQueriesForCode,
  looksLikeTransportCode,
  lookupTransportCode,
  transportLabel,
  type TransportPlace,
} from './transportCodes'

// Automatic timezone detection from a location string — fully client-side.
//   address --(geocode)--> lat/lon --(tz-lookup, offline)--> IANA tz
// Geocoding uses the Google Maps JavaScript API when a Maps key is configured
// (most accurate), otherwise falls back to OpenStreetMap Nominatim (keyless).
// Transport codes (IATA / rail) are expanded before geocoding.
// Results are cached in localStorage (v2 busts bad pre-expansion entries).

const CACHE_KEY = 'grandease.geoTzCache.v2'
const COORD_CACHE_KEY = 'grandease.geoCoordCache.v2'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

// Drop pre-v2 caches that could pin wrong resolutions for bare codes like "LAX".
try {
  localStorage.removeItem('grandease.geoTzCache')
  localStorage.removeItem('grandease.geoCoordCache')
} catch {
  /* ignore */
}

type Cache = Record<string, string | null>
type Coords = { lat: number; lon: number }
type CoordCache = Record<string, Coords | null>

export type PlaceKind = 'airport' | 'station' | 'place'

export interface PlaceCandidate {
  label: string
  lat: number
  lon: number
  tz: string | null
  kind: PlaceKind
}

export interface ResolveOptions {
  /** Travel subtype hint: airplane, train, subway, … */
  mode?: string
}

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

function cacheKey(query: string, mode?: string): string {
  const q = query.trim().toLowerCase()
  const m = (mode || '').toLowerCase()
  return m ? `${q}|${m}` : q
}

function fromTransport(place: TransportPlace): PlaceCandidate {
  return {
    label: transportLabel(place),
    lat: place.lat,
    lon: place.lon,
    tz: tzFromLatLon(place.lat, place.lon),
    kind: place.kind,
  }
}

function kindFromGoogleTypes(types: string[] | undefined): PlaceKind {
  if (!types?.length) return 'place'
  if (types.includes('airport')) return 'airport'
  if (types.some((t) => t.includes('transit') || t.includes('train') || t.includes('subway'))) {
    return 'station'
  }
  return 'place'
}

function kindFromNominatim(cls: string | undefined, type: string | undefined): PlaceKind {
  const c = (cls || '').toLowerCase()
  const t = (type || '').toLowerCase()
  if (c === 'aeroway' || t === 'aerodrome' || t.includes('airport')) return 'airport'
  if (
    t.includes('station') ||
    t.includes('railway') ||
    t === 'halt' ||
    c === 'railway' ||
    t.includes('subway')
  ) {
    return 'station'
  }
  return 'place'
}

interface RawHit {
  label: string
  lat: number
  lon: number
  kind: PlaceKind
}

async function geocodeGoogleMany(query: string): Promise<RawHit[]> {
  const maps = await loadGoogleMaps(getMapsKey())
  const geocoder = new maps.Geocoder()
  const { results } = await geocoder.geocode({ address: query })
  return (results || []).slice(0, 5).map((r) => {
    const loc = r.geometry.location
    return {
      label: r.formatted_address || query,
      lat: loc.lat(),
      lon: loc.lng(),
      kind: kindFromGoogleTypes(r.types),
    }
  })
}

async function geocodeNominatimMany(query: string): Promise<RawHit[]> {
  await throttle()
  const url =
    `${NOMINATIM}?format=jsonv2&limit=5&addressdetails=0` +
    `&q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Nominatim usage policy asks for a valid User-Agent identifying the app.
      'User-Agent': 'GrandEaseTraveler/1.0',
    },
  })
  if (!res.ok) throw new Error(String(res.status))
  const data = (await res.json()) as {
    lat: string
    lon: string
    display_name: string
    class?: string
    type?: string
  }[]
  return (data || []).map((d) => ({
    label: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    kind: kindFromNominatim(d.class, d.type),
  }))
}

async function geocodeMany(query: string): Promise<RawHit[]> {
  try {
    if (getMapsKey()) return await geocodeGoogleMany(query)
    return await geocodeNominatimMany(query)
  } catch {
    if (getMapsKey()) return await geocodeNominatimMany(query)
    throw new Error('geocode failed')
  }
}

function dedupeHits(hits: RawHit[]): RawHit[] {
  const seen = new Set<string>()
  const out: RawHit[] = []
  for (const h of hits) {
    const key = `${h.lat.toFixed(3)},${h.lon.toFixed(3)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(h)
  }
  return out
}

function rankHits(hits: RawHit[], mode?: string): RawHit[] {
  const rail = mode === 'train' || mode === 'subway'
  const air = mode === 'airplane' || !mode
  return [...hits].sort((a, b) => {
    const score = (h: RawHit) => {
      if (air && h.kind === 'airport') return 0
      if (rail && h.kind === 'station') return 0
      if (h.kind === 'airport') return 1
      if (h.kind === 'station') return 2
      return 3
    }
    return score(a) - score(b)
  })
}

function toCandidate(hit: RawHit): PlaceCandidate {
  return {
    label: hit.label,
    lat: hit.lat,
    lon: hit.lon,
    tz: tzFromLatLon(hit.lat, hit.lon),
    kind: hit.kind,
  }
}

/**
 * Resolve a location string to one or more place candidates.
 * Bare transport codes are expanded via the curated table (or biased queries).
 * Callers should auto-accept a single strong match, or show a picker.
 */
export async function resolvePlaces(
  query: string,
  opts?: ResolveOptions,
): Promise<PlaceCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const mode = opts?.mode

  const known = lookupTransportCode(q, mode)
  if (known) return [fromTransport(known)]

  const queries =
    looksLikeTransportCode(q) ? expandedQueriesForCode(q, mode) : [q]

  const collected: RawHit[] = []
  for (const gq of queries) {
    try {
      const hits = await geocodeMany(gq)
      collected.push(...hits)
      // For expanded code searches, stop once we have a typed transport hit.
      if (
        looksLikeTransportCode(q) &&
        hits.some((h) => h.kind === 'airport' || h.kind === 'station')
      ) {
        break
      }
      if (!looksLikeTransportCode(q)) break
    } catch {
      /* try next expansion */
    }
  }

  let ranked = rankHits(dedupeHits(collected), mode)

  // When the user typed a bare code and we found a transport place, rewrite
  // the label to include the code so maps/timezone stay unambiguous later.
  if (looksLikeTransportCode(q)) {
    const code = q.toUpperCase()
    ranked = ranked.map((h) => {
      if (h.kind !== 'airport' && h.kind !== 'station') return h
      if (/\([A-Z]{3}\)/.test(h.label)) return h
      return { ...h, label: `${h.label} (${code})` }
    })
  }

  return ranked.slice(0, 5).map(toCandidate)
}

/** Best single candidate, or null. Prefer curated codes / typed hits. */
export async function resolvePlace(
  query: string,
  opts?: ResolveOptions,
): Promise<PlaceCandidate | null> {
  const list = await resolvePlaces(query, opts)
  return list[0] || null
}

/** Resolve a single location string to an IANA timezone (or null if unknown). */
export async function timezoneForQuery(
  query: string,
  opts?: ResolveOptions,
): Promise<string | null> {
  const q = query.trim()
  if (!q) return null
  const key = cacheKey(q, opts?.mode)
  const cache = loadCache()
  if (key in cache) return cache[key]

  try {
    const place = await resolvePlace(q, opts)
    const tz = place?.tz ?? null
    cache[key] = tz
    saveCache(cache)
    return tz
  } catch {
    return null
  }
}

/**
 * Resolve a single location string to coordinates (or null if unknown).
 * Mirrors `timezoneForQuery`: a dedicated localStorage cache (including null
 * results) backs Google geocoding with a Nominatim fallback.
 */
export async function geocodeToCoords(
  query: string,
  opts?: ResolveOptions,
): Promise<Coords | null> {
  const q = query.trim()
  if (!q) return null
  const key = cacheKey(q, opts?.mode)
  const cache = loadCoordCache()
  if (key in cache) return cache[key]

  try {
    const place = await resolvePlace(q, opts)
    const coords = place ? { lat: place.lat, lon: place.lon } : null
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
  const mode = item.type === 'travel' ? item.subtype : undefined
  for (const c of candidatesFor(item)) {
    const tz = await timezoneForQuery(c, { mode })
    if (tz) return tz
  }
  return null
}

export function hasLocation(item: ItineraryItem): boolean {
  return candidatesFor(item).length > 0
}

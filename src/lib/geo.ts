import tzlookup from 'tz-lookup'
import type { DayPlace, ItineraryItem } from '../types'
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
const SEARCH_CACHE_KEY = 'grandease.placeSearchCache.v1'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
/** How far around the day's city a venue search is allowed to prefer results. */
const BIAS_RADIUS_KM = 40

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

/** Longitude/latitude box around a point, in Nominatim's left,top,right,bottom order. */
function viewbox(center: Coords, km: number): string {
  const dLat = km / 111
  // Guard the cosine near the poles so the box stays finite.
  const dLon = km / (111 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)))
  return [center.lon - dLon, center.lat + dLat, center.lon + dLon, center.lat - dLat].join(',')
}

async function geocodeNominatimMany(query: string, center?: Coords | null): Promise<RawHit[]> {
  await throttle()
  const url =
    `${NOMINATIM}?format=jsonv2&limit=5&addressdetails=0` +
    // bounded=0 keeps the box a preference rather than a hard filter.
    (center ? `&viewbox=${viewbox(center, BIAS_RADIUS_KM)}&bounded=0` : '') +
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

/**
 * Promote transport hits for travel lookups. `isCode` covers a bare "LAX" typed
 * with no mode; without it a plain venue search (dining, activity, lodging)
 * keeps the provider's own relevance order rather than surfacing airports.
 */
function rankHits(hits: RawHit[], mode?: string, isCode = false): RawHit[] {
  const rail = mode === 'train' || mode === 'subway'
  const air = mode === 'airplane' || (!mode && isCode)
  if (!rail && !air) return [...hits]
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

  let ranked = rankHits(dedupeHits(collected), mode, looksLikeTransportCode(q))

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

/** Fill missing day-place timezones through the normal cached resolver. */
export async function enrichPlaceTimezones(places: DayPlace[]): Promise<DayPlace[]> {
  return Promise.all(
    places.map(async (place) => {
      if (place.tz) return { ...place }
      const tz = await timezoneForQuery(place.name)
      return tz ? { ...place, tz } : { ...place }
    }),
  )
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

// ---------------------------------------------------------------------------
// Venue search: find a place from a name ("Café de Flore") rather than an
// address, biased toward the city the traveller is in that day.
// ---------------------------------------------------------------------------

export interface PlaceSearchOptions extends ResolveOptions {
  /** City/region context to bias toward, e.g. "Paris, France". */
  near?: string
}

/** Coordinates of the bias context, or null when there is none to resolve. */
async function biasCenter(near?: string): Promise<Coords | null> {
  const n = (near || '').trim()
  if (!n) return null
  return geocodeToCoords(n)
}

async function searchPlacesGoogle(query: string, center: Coords | null): Promise<RawHit[]> {
  const maps = await loadGoogleMaps(getMapsKey())
  const Place = maps.places?.Place
  if (!Place) throw new Error('places library unavailable')
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ['displayName', 'formattedAddress', 'location', 'types'],
    maxResultCount: 6,
    ...(center
      ? {
          locationBias: {
            center: { lat: center.lat, lng: center.lon },
            radius: BIAS_RADIUS_KM * 1000,
          },
        }
      : {}),
  })
  return (places || []).flatMap((p) => {
    const loc = p.location
    if (!loc) return []
    const name = (p.displayName || '').trim()
    const address = (p.formattedAddress || '').trim()
    // Keep the venue name in the saved string: it is what the traveller
    // recognises, and it keeps a later re-geocode unambiguous.
    const label =
      name && address && !address.toLowerCase().startsWith(name.toLowerCase())
        ? `${name}, ${address}`
        : address || name || query
    return [
      {
        label,
        lat: loc.lat(),
        lon: loc.lng(),
        kind: kindFromGoogleTypes(p.types ?? undefined),
      },
    ]
  })
}

/**
 * Search for a place by name or address, preferring results near `near`.
 * Uses the Places API when available (much better at venue names) and degrades
 * to geocoding with the city appended to the query.
 */
export async function searchPlaces(
  query: string,
  opts?: PlaceSearchOptions,
): Promise<PlaceCandidate[]> {
  const q = query.trim()
  if (!q) return []
  const { near, mode } = opts || {}

  // Curated transport codes stay authoritative — no point searching for "LAX".
  const known = lookupTransportCode(q, mode)
  if (known) return [fromTransport(known)]
  if (looksLikeTransportCode(q)) return resolvePlaces(q, { mode })

  const center = await biasCenter(near)

  let hits: RawHit[] = []
  if (getMapsKey()) {
    try {
      hits = await searchPlacesGoogle(q, center)
    } catch {
      /* no Places access — fall through to geocoding */
    }
  }

  if (!hits.length) {
    // Appending the city is the geocoder's only bias mechanism here.
    const scoped = near && !q.toLowerCase().includes(near.toLowerCase()) ? `${q}, ${near}` : q
    try {
      hits = getMapsKey()
        ? await geocodeGoogleMany(scoped)
        : await geocodeNominatimMany(q, center)
    } catch {
      try {
        hits = await geocodeNominatimMany(q, center)
      } catch {
        return []
      }
    }
  }

  return dedupeHits(hits).slice(0, 6).map(toCandidate)
}

// Words that carry no venue identity, so a title made only of these ("Dinner",
// "Check out of the hotel") must not be turned into a map pin.
const GENERIC_WORDS = new Set([
  'the', 'and', 'for', 'with', 'our', 'from', 'into', 'out', 'via',
  'day', 'trip', 'tour', 'visit', 'walk', 'time', 'free', 'meet', 'stop',
  'breakfast', 'brunch', 'lunch', 'dinner', 'drinks', 'coffee', 'snack',
  'hotel', 'cafe', 'bar', 'restaurant', 'museum', 'park', 'show', 'flight',
  'check', 'checkin', 'checkout', 'arrive', 'arrival', 'depart', 'departure',
  'morning', 'afternoon', 'evening', 'night', 'reservation', 'booking',
])

/** Distinctive lowercase words of a title, accents folded for comparison. */
function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w))
}

/**
 * Whether a title names something specific enough to look up. "Dinner" or
 * "Check out of the hotel" describe an activity, not a venue, and searching
 * them would just return the middle of whatever city we biased toward.
 */
export function isPlaceableTitle(title: string): boolean {
  return significantWords(title).length > 0
}

type SearchCache = Record<string, PlaceCandidate | null>

function loadSearchCache(): SearchCache {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}
function saveSearchCache(c: SearchCache) {
  try {
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(c))
  } catch {
    /* ignore quota */
  }
}

/**
 * Best guess at where an event happens, from its title plus the city it falls
 * in. Returns null unless a result actually echoes a distinctive word of the
 * title — otherwise a generic title would silently pin the city centre.
 */
export async function inferPlaceFromTitle(
  title: string,
  near?: string,
): Promise<PlaceCandidate | null> {
  const words = significantWords(title)
  if (!words.length) return null

  const key = cacheKey(title, near)
  const cache = loadSearchCache()
  if (key in cache) return cache[key]

  let found: PlaceCandidate | null = null
  try {
    for (const candidate of await searchPlaces(title, { near })) {
      const label = significantWords(candidate.label)
      if (words.some((w) => label.includes(w))) {
        found = candidate
        break
      }
    }
  } catch {
    return null
  }

  cache[key] = found
  saveSearchCache(cache)
  return found
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

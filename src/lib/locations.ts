import type { DayPlace, DayLocations, ItineraryItem, Trip } from '../types'
import { addDays, toDateOnly } from './format'

const byTime = (a: DayPlace, b: DayPlace) => a.time.localeCompare(b.time)
const MAX_DAY_PLACES = 3

export type DayLocationSource = 'explicit' | 'derived' | 'inherited' | 'empty'

export interface EffectiveDayLocations {
  places: DayPlace[]
  source: DayLocationSource
  /** Backwards-compatible convenience for existing callers. */
  inherited: boolean
}

const US_COUNTRY_NAMES = new Set(['us', 'usa', 'united states', 'united states of america'])
const ADMIN_AREA = /\b(county|parish|borough|municipality|province|region|departamento|department)\b/i
const STREETISH =
  /^\d|^(calle|avenida|av\.?|street|st\.?|road|rd\.?|blvd\.?|boulevard|avenue|via|strasse|straße|plaza|platz)\b/i

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Drop postal codes so an address component reduces to a bare place name. */
function withoutPostalCode(part: string): string {
  return normalizeSpaces(
    part
      .replace(/\b\d{4,6}(?:-\d{4})?\b/g, ' ')
      .replace(/\b[A-Z]{1,2}\d[A-Z\d]?(?:\s+\d[A-Z]{2})?\b/g, ' '),
  )
}

/** Strip airport/station noise so travel codes reduce toward a city name. */
function stripTransportNoise(part: string): string {
  return normalizeSpaces(
    part
      .replace(/\s*\([A-Za-z]{3}\)\s*$/g, '')
      .replace(/\s+international\s+airport$/i, '')
      .replace(/\s+airport$/i, '')
      .replace(/\s+(railway|train|bus)?\s*station$/i, '')
      .replace(/\s+terminal$/i, ''),
  )
}

/**
 * Reduce a venue name or full street address to "City, State" in the US and
 * "City, Country" elsewhere. Addresses are read from the end, where the
 * administrative components live, so leading hotel/venue names fall away.
 */
export function cityRegionName(raw: string): string {
  const trimmed = normalizeSpaces(raw)
  if (!trimmed) return ''

  const parts = trimmed
    .split(',')
    .map((part) => stripTransportNoise(withoutPostalCode(part)))
    .filter(Boolean)

  if (parts.length < 2) {
    return stripTransportNoise(trimmed) || trimmed
  }

  const country = parts[parts.length - 1]
  const isUs = US_COUNTRY_NAMES.has(country.toLowerCase().replace(/\./g, ''))

  if (!isUs) {
    // Prefer the last non-admin part before the country: City, Country.
    let cityIdx = parts.length - 2
    while (cityIdx > 0 && (ADMIN_AREA.test(parts[cityIdx]) || STREETISH.test(parts[cityIdx]))) {
      cityIdx--
    }
    return `${parts[cityIdx]}, ${country}`
  }

  // US addresses end with the state, putting the city one component earlier.
  const region = parts[parts.length - 2]
  let cityIdx = parts.length - 3
  while (cityIdx > 0 && (ADMIN_AREA.test(parts[cityIdx]) || STREETISH.test(parts[cityIdx]))) {
    cityIdx--
  }
  const city = cityIdx >= 0 ? parts[cityIdx] : ''
  return city ? `${city}, ${region}` : `${region}, ${country}`
}

/** City token used for equivalence: "Lima, Peru" and "Lima" share "lima". */
export function cityKey(name: string): string {
  const shortened = cityRegionName(name)
  if (!shortened) return ''
  return normalizeSpaces(shortened.split(',')[0] || '').toLocaleLowerCase()
}

export function samePlace(a: string, b: string): boolean {
  const ka = cityKey(a)
  const kb = cityKey(b)
  return !!ka && !!kb && ka === kb
}

/** Prefer the more specific label when merging equivalents. */
function preferredName(a: string, b: string): string {
  const aShort = cityRegionName(a)
  const bShort = cityRegionName(b)
  const aComma = aShort.includes(',')
  const bComma = bShort.includes(',')
  if (aComma !== bComma) return aComma ? aShort : bShort
  return aShort.length >= bShort.length ? aShort : bShort
}

/** Trailing "State" / "Country" portion, if present. */
function regionOf(name: string): string | null {
  const parts = cityRegionName(name)
    .split(',')
    .map((part) => normalizeSpaces(part))
    .filter(Boolean)
  if (parts.length < 2) return null
  return parts.slice(1).join(', ').toLocaleLowerCase()
}

/**
 * When every place on the day shares the same state/country, drop the repeated
 * suffix and keep just the city names.
 */
export function compactSharedRegions(places: DayPlace[]): DayPlace[] {
  if (places.length < 2) return places
  const regions = places.map((place) => regionOf(place.name))
  const shared = regions[0]
  if (!shared || regions.some((region) => region !== shared)) return places
  return places.map((place) => ({
    ...place,
    name: normalizeSpaces(cityRegionName(place.name).split(',')[0] || place.name),
  }))
}

function locationOf(item: ItineraryItem, leg: 'origin' | 'destination'): string {
  const value = leg === 'origin' ? item.from || item.location : item.to || item.location
  return cityRegionName(value || '')
}

/** Lodging contributes its city, not the hotel name and street address. */
function lodgingName(item: ItineraryItem): string {
  return cityRegionName(item.location || '')
}

function activeLodgings(items: ItineraryItem[], day: string): ItineraryItem[] {
  return items
    .filter((item) => {
      if (item.type !== 'lodging' || !item.location?.trim()) return false
      const nights = Math.max(1, item.nights || 1)
      return day >= item.date && day < addDays(item.date, nights)
    })
    .sort((a, b) => {
      const dateOrder = a.date.localeCompare(b.date)
      if (dateOrder) return dateOrder
      return (a.startTime || '').localeCompare(b.startTime || '')
    })
}

interface TimedPlace {
  place: DayPlace
  order: number
}

function arrivalsForDay(items: ItineraryItem[], day: string): TimedPlace[] {
  return items
    .map((item, order): TimedPlace | null => {
      if (item.type !== 'travel' || (item.endDate || item.date) !== day) return null
      const name = locationOf(item, 'destination')
      if (!name) return null
      return { place: { time: item.endTime || '00:00', name }, order }
    })
    .filter((arrival): arrival is TimedPlace => arrival !== null)
    .sort((a, b) => {
      const timeOrder = a.place.time.localeCompare(b.place.time)
      return timeOrder || a.order - b.order
    })
}

function firstOrigin(items: ItineraryItem[], day: string): string {
  const departures = items
    .map((item, order) => ({ item, order }))
    .filter(({ item }) => item.type === 'travel' && item.date === day)
    .sort((a, b) => {
      const timeOrder = (a.item.startTime || '00:00').localeCompare(
        b.item.startTime || '00:00',
      )
      return timeOrder || a.order - b.order
    })
  for (const { item } of departures) {
    const name = locationOf(item, 'origin')
    if (name) return name
  }
  return ''
}

function appendIfChanged(places: DayPlace[], place: DayPlace) {
  if (!place.name.trim()) return
  const last = places[places.length - 1]
  if (last && samePlace(last.name, place.name)) {
    // Keep the richer label; earliest time wins for the merged segment.
    places[places.length - 1] = {
      ...last,
      name: preferredName(last.name, place.name),
      tz: last.tz || place.tz,
    }
    return
  }
  places.push({ ...place, name: cityRegionName(place.name) })
}

/** Prefer richer City, Country labels found anywhere on the day's itinerary. */
function enrichPlaceNames(
  places: DayPlace[],
  items: ItineraryItem[],
  day: string,
): DayPlace[] {
  const labels: string[] = []
  for (const item of items) {
    if (item.type === 'lodging') {
      const nights = Math.max(1, item.nights || 1)
      if (day >= item.date && day < addDays(item.date, nights)) {
        labels.push(lodgingName(item))
      }
      continue
    }
    if (item.type === 'travel') {
      if (item.date === day) labels.push(locationOf(item, 'origin'))
      if ((item.endDate || item.date) === day) labels.push(locationOf(item, 'destination'))
      continue
    }
    if (item.date === day && item.location) labels.push(cityRegionName(item.location))
  }

  return places.map((place) => {
    let name = place.name
    for (const label of labels) {
      if (label && samePlace(name, label)) name = preferredName(name, label)
    }
    return name === place.name ? place : { ...place, name }
  })
}

/**
 * Keep the beginning of the day and its final effective destination when a
 * generated timeline exceeds the editor's three-place limit.
 */
function limitPlaces(places: DayPlace[]): DayPlace[] {
  if (places.length <= MAX_DAY_PLACES) return places
  return [...places.slice(0, MAX_DAY_PLACES - 1), places[places.length - 1]]
}

function arrivalEstablishes(arrivals: TimedPlace[], name: string): boolean {
  return arrivals.some(({ place }) => samePlace(place.name, name))
}

/**
 * Derive one day's timeline from itinerary evidence and the previous day's
 * final effective place. This helper never reads or writes `trip.locations`.
 */
export function deriveDayPlaces(
  items: ItineraryItem[],
  day: string,
  previousPlaces: DayPlace[] = [],
): DayPlace[] {
  const arrivals = arrivalsForDay(items, day)
  const lodgings = activeLodgings(items, day)
  // Lodging is only a day-start baseline when no later travel arrival
  // establishes that same city — otherwise keep the prior place until arrival.
  const lodging = [...lodgings]
    .reverse()
    .find((item) => !arrivalEstablishes(arrivals, lodgingName(item)))

  let baseline: DayPlace | undefined = previousPlaces[previousPlaces.length - 1]
  if (lodging) {
    baseline = { time: '00:00', name: lodgingName(lodging), tz: lodging.timezone }
  } else if (!baseline) {
    const origin = firstOrigin(items, day)
    if (origin) baseline = { time: '00:00', name: origin }
  }

  const timed: TimedPlace[] = []
  if (baseline?.name.trim()) {
    timed.push({
      place: { ...baseline, time: '00:00', name: cityRegionName(baseline.name) },
      order: -1,
    })
  }
  for (const arrival of arrivals) {
    // Prefer a lodging's City, Country label when it names the same city.
    let name = arrival.place.name
    for (const item of lodgings) {
      const lodge = lodgingName(item)
      if (samePlace(lodge, name)) name = preferredName(name, lodge)
    }
    timed.push({ place: { ...arrival.place, name }, order: arrival.order })
  }
  timed.sort((a, b) => {
    const timeOrder = a.place.time.localeCompare(b.place.time)
    return timeOrder || a.order - b.order
  })

  const places: DayPlace[] = []
  for (const { place } of timed) appendIfChanged(places, place)
  return limitPlaces(compactSharedRegions(enrichPlaceNames(places, items, day)))
}

function earliestRelevantDay(trip: Trip, items: ItineraryItem[], target: string): string {
  const dates = [
    trip.startDate,
    ...(trip.locations || []).map((entry) => entry.date),
    ...items.flatMap((item) => [item.date, item.endDate || item.date]),
  ].filter((date) => date && date <= target)
  return dates.sort()[0] || target
}

/** Resolve explicit overrides first, otherwise derive and carry locations forward. */
export function effectivePlacesForDay(
  trip: Trip,
  items: ItineraryItem[],
  day: string,
): EffectiveDayLocations {
  let previousPlaces: DayPlace[] = []
  let result: EffectiveDayLocations = { places: [], source: 'empty', inherited: false }
  let current = earliestRelevantDay(trip, items, day)

  // Trips are normally short, but retain a guard for malformed dates/ranges.
  for (let guard = 0; guard < 36600 && current <= day; guard++) {
    const explicit = (trip.locations || []).find((entry) => entry.date === current)
    if (explicit) {
      // Explicit overrides stay user-authored, but still drop consecutive dupes
      // and keep chronological order.
      const places: DayPlace[] = []
      for (const place of [...explicit.places].sort(byTime)) appendIfChanged(places, place)
      result = {
        places: limitPlaces(compactSharedRegions(places)),
        source: 'explicit',
        inherited: false,
      }
    } else {
      const places = deriveDayPlaces(items, current, previousPlaces)
      const arrivals = arrivalsForDay(items, current)
      const hasArrival = arrivals.length > 0
      const hasLodgingBaseline = activeLodgings(items, current).some(
        (item) => !arrivalEstablishes(arrivals, lodgingName(item)),
      )
      const hasOriginBaseline = !previousPlaces.length && !!firstOrigin(items, current)
      const derived = hasArrival || hasLodgingBaseline || hasOriginBaseline
      const source: DayLocationSource = derived
        ? 'derived'
        : places.length
          ? 'inherited'
          : 'empty'
      result = { places, source, inherited: source === 'inherited' }
    }
    previousPlaces = result.places
    if (current === day) break
    current = addDays(current, 1)
  }
  return result
}

/** Compatibility wrapper; pass items to enable dynamic itinerary derivation. */
export function placesForDay(
  trip: Trip,
  day: string,
  items: ItineraryItem[] = [],
): EffectiveDayLocations {
  return effectivePlacesForDay(trip, items, day)
}

/** Index of the place active at refTime (latest place whose time <= refTime). */
export function activePlaceIndex(places: DayPlace[], refTime: string): number {
  if (!places.length) return -1
  let idx = 0
  for (let i = 0; i < places.length; i++) {
    if (places[i].time <= refTime) idx = i
  }
  return idx
}

/** Reference time for "which place is current": now if viewing today, else 00:00. */
export function refTimeForDay(day: string): string {
  const now = new Date()
  if (day !== toDateOnly(now)) return '00:00'
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/** The timezone implied by the day's active destination at a given time. */
export function dayTimezone(
  trip: Trip,
  items: ItineraryItem[],
  day: string,
  time?: string,
): string | undefined {
  const { places } = effectivePlacesForDay(trip, items, day)
  if (!places.length) return undefined
  const idx = activePlaceIndex(places, time || '00:00')
  return places[Math.max(0, idx)]?.tz
}

/** Return a new locations array with `day` set to `places` (or cleared if empty). */
export function setDayPlaces(
  trip: Trip,
  day: string,
  places: DayPlace[],
): DayLocations[] {
  const list = (trip.locations || []).filter((d) => d.date !== day)
  const cleaned = places.filter((p) => p.name.trim())
  if (cleaned.length) list.push({ date: day, places: [...cleaned].sort(byTime) })
  return list.sort((a, b) => a.date.localeCompare(b.date))
}

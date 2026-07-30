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

function placeKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function locationOf(item: ItineraryItem, leg: 'origin' | 'destination'): string {
  const value = leg === 'origin' ? item.from || item.location : item.to || item.location
  return (value || '').trim()
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

interface Arrival {
  place: DayPlace
  order: number
}

function arrivalsForDay(items: ItineraryItem[], day: string): Arrival[] {
  return items
    .map((item, order): Arrival | null => {
      if (item.type !== 'travel' || (item.endDate || item.date) !== day) return null
      const name = locationOf(item, 'destination')
      if (!name) return null
      return { place: { time: item.endTime || '00:00', name }, order }
    })
    .filter((arrival): arrival is Arrival => arrival !== null)
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
  if (placeKey(places[places.length - 1]?.name || '') === placeKey(place.name)) return
  places.push(place)
}

/**
 * Keep the beginning of the day and its final effective destination when a
 * generated timeline exceeds the editor's three-place limit.
 */
function limitPlaces(places: DayPlace[]): DayPlace[] {
  if (places.length <= MAX_DAY_PLACES) return places
  return [...places.slice(0, MAX_DAY_PLACES - 1), places[places.length - 1]]
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
  const arrivalNames = new Set(arrivals.map(({ place }) => placeKey(place.name)))
  const lodgings = activeLodgings(items, day)
  const lodging = [...lodgings]
    .reverse()
    .find((item) => !arrivalNames.has(placeKey(item.location || '')))

  let baseline = previousPlaces[previousPlaces.length - 1]
  if (lodging?.location?.trim()) {
    baseline = { time: '00:00', name: lodging.location.trim(), tz: lodging.timezone }
  } else if (!baseline) {
    const origin = firstOrigin(items, day)
    if (origin) baseline = { time: '00:00', name: origin }
  }

  const places: DayPlace[] = []
  if (baseline) appendIfChanged(places, { ...baseline, time: '00:00' })
  for (const { place } of arrivals) appendIfChanged(places, place)
  return limitPlaces(places)
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
      const places = limitPlaces([...explicit.places].sort(byTime))
      result = { places, source: 'explicit', inherited: false }
    } else {
      const places = deriveDayPlaces(items, current, previousPlaces)
      const hasArrival = arrivalsForDay(items, current).length > 0
      const hasLodgingBaseline = activeLodgings(items, current).some((item) => {
        const arrivals = new Set(
          arrivalsForDay(items, current).map(({ place }) => placeKey(place.name)),
        )
        return !arrivals.has(placeKey(item.location || ''))
      })
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

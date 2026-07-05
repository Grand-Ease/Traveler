import type { DayPlace, DayLocations, Trip } from '../types'
import { toDateOnly } from './format'

// Per-day destinations with carry-forward semantics.
//
// Destinations are stored sparsely (only on days the user explicitly sets).
// A day without its own destinations inherits a single place — the LAST place
// of the nearest prior set day — anchored at 00:00. The day's active place
// (by time of day) drives the displayed/inherited timezone.

const byTime = (a: DayPlace, b: DayPlace) => a.time.localeCompare(b.time)

/** Places shown for a day: explicit if set, else carried forward from the past. */
export function placesForDay(
  trip: Trip,
  day: string,
): { places: DayPlace[]; inherited: boolean } {
  const list = trip.locations || []
  const explicit = list.find((d) => d.date === day)
  if (explicit && explicit.places.length) {
    return { places: [...explicit.places].sort(byTime), inherited: false }
  }
  const prior = list
    .filter((d) => d.date < day && d.places.length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop()
  if (prior) {
    const last = [...prior.places].sort(byTime).pop()!
    return { places: [{ time: '00:00', name: last.name, tz: last.tz }], inherited: true }
  }
  return { places: [], inherited: false }
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
export function dayTimezone(trip: Trip, day: string, time?: string): string | undefined {
  const { places } = placesForDay(trip, day)
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

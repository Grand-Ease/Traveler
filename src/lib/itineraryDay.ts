import type { ItineraryItem, Trip } from '../types'
import { addDays, eachDay } from './format'

/** Whether an itinerary item should appear on a given calendar day. */
export function itemAffectsDay(item: ItineraryItem, day: string): boolean {
  if (item.type === 'lodging') {
    const nights = Math.max(1, item.nights || 1)
    return day >= item.date && day < addDays(item.date, nights)
  }
  if (item.type === 'travel') {
    const arrivalDate = item.endDate || item.date
    return item.date === day || arrivalDate === day
  }
  return item.date === day
}

/** All navigable YYYY-MM-DD values for a trip, including cross-day travel arrivals. */
export function tripDays(trip: Trip, items: ItineraryItem[]): string[] {
  const set = new Set<string>()
  if (trip.startDate && trip.endDate) {
    for (const d of eachDay(trip.startDate, trip.endDate)) set.add(d)
  }
  for (const item of items) {
    if (item.date) set.add(item.date)
    if (item.type === 'travel' && item.endDate) set.add(item.endDate)
  }
  const arr = [...set].sort()
  return arr.length ? arr : [trip.startDate || new Date().toISOString().slice(0, 10)]
}

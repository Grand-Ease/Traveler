import type { ItineraryItem, Trip } from '../types'
import { addDays, eachDay } from './format'

/** Which part of a stay a given day represents. */
export type StayPhase = 'checkin' | 'staying' | 'checkout'

/** The morning you leave: check-in date plus the nights slept. */
export function lodgingCheckoutDay(item: ItineraryItem): string {
  return addDays(item.date, Math.max(1, item.nights || 1))
}

/**
 * Lodging covers every night *and* the checkout morning — you wake up there,
 * so the day still begins at the hotel even though you don't sleep there again.
 */
export function lodgingCoversDay(item: ItineraryItem, day: string): boolean {
  return day >= item.date && day <= lodgingCheckoutDay(item)
}

/**
 * Whether the day begins at this lodging rather than arriving at it. True for
 * every day after check-in, which is what orders it ahead of the day's plans.
 */
export function lodgingStartsDay(item: ItineraryItem, day: string): boolean {
  return day > item.date && day <= lodgingCheckoutDay(item)
}

export function stayPhase(item: ItineraryItem, day: string): StayPhase {
  if (day === lodgingCheckoutDay(item)) return 'checkout'
  return day === item.date ? 'checkin' : 'staying'
}

/**
 * Time an item sorts at within its day. Lodging you woke up in sorts to the
 * start of the day; its own `startTime` is a check-in time that only applies
 * on the arrival day.
 */
export function sortTimeForDay(item: ItineraryItem, day: string): string {
  if (item.type === 'lodging' && lodgingStartsDay(item, day)) return '00:00'
  return item.startTime || '99'
}

/** Whether an itinerary item should appear on a given calendar day. */
export function itemAffectsDay(item: ItineraryItem, day: string): boolean {
  if (item.type === 'lodging') return lodgingCoversDay(item, day)
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

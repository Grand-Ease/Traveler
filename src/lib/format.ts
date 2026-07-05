import type { ItemType } from '../types'

// Emoji used as the calendar event summary prefix (renders in any calendar app).
export const TYPE_EMOJI: Record<ItemType, string> = {
  travel: '✈️',
  lodging: '🛏️',
  dining: '🍴',
  activity: '🧭',
  note: '📝',
}

// Emoji per travel subtype for nicer summaries.
export const TRAVEL_EMOJI: Record<string, string> = {
  airplane: '✈️',
  train: '🚆',
  car: '🚗',
  subway: '🚇',
  ship: '🚢',
}

export const TYPE_LABEL: Record<ItemType, string> = {
  travel: 'Travel',
  lodging: 'Lodging',
  dining: 'Dining',
  activity: 'Activity',
  note: 'Note',
}

// ---- date-only helpers (YYYY-MM-DD, no timezone drift) ----

/** Parse a YYYY-MM-DD string at local noon (avoids UTC off-by-one). */
export function parseDateOnly(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day, 12, 0, 0)
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(d: string, n: number): string {
  const date = parseDateOnly(d)
  date.setDate(date.getDate() + n)
  return toDateOnly(date)
}

/** Inclusive list of YYYY-MM-DD from start..end. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = []
  let cur = start
  // guard against reversed / runaway ranges
  for (let i = 0; i < 366 && cur <= end; i++) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export function weekdayLong(d: string): string {
  return parseDateOnly(d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function shortRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${parseDateOnly(start).toLocaleDateString(undefined, opts)} – ${parseDateOnly(
    end,
  ).toLocaleDateString(undefined, opts)}`
}

export function formatTime(hhmm?: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export const defaultTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

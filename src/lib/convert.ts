import type { ItineraryItem, ItemType } from '../types'
import { addDays, defaultTimezone, TRAVEL_EMOJI, TYPE_EMOJI } from './format'

// Subset of a Google Calendar event we read/write.
export interface GEvent {
  id?: string
  summary?: string
  location?: string
  description?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  extendedProperties?: { private?: Record<string, string> }
}

const GEDATA_KEY = 'gedata'

// ---- timezone helpers (no external deps) ----

/** Offset like "+09:00" for a timezone at a given wall date/time. */
function namedOffset(timeZone: string, date: string, time: string): string {
  const approx = new Date(`${date}T${time}:00Z`)
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    })
    const name =
      dtf.formatToParts(approx).find((p) => p.type === 'timeZoneName')?.value ||
      'GMT+00:00'
    const m = name.match(/GMT([+-]\d{2}):?(\d{2})/)
    if (!m) return '+00:00'
    return `${m[1]}:${m[2]}`
  } catch {
    return '+00:00'
  }
}

function rfc3339(date: string, time: string, timeZone: string): string {
  return `${date}T${time}:00${namedOffset(timeZone, date, time)}`
}

/** Wall-clock date/time of an instant, as seen in a timezone. */
function wallInZone(iso: string, timeZone: string): { date: string; time: string } {
  const d = new Date(iso)
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]))
  let hour = p.hour === '24' ? '00' : p.hour
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${hour}:${p.minute}`,
  }
}

function addMinutesToTime(time: string, mins: number): { time: string; dayShift: number } {
  const [h, m] = time.split(':').map(Number)
  let total = h * 60 + m + mins
  let dayShift = 0
  while (total >= 1440) {
    total -= 1440
    dayShift += 1
  }
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return { time: `${hh}:${mm}`, dayShift }
}

// ---- summaries & descriptions ----

function buildSummary(item: ItineraryItem): string {
  const emoji =
    item.type === 'travel'
      ? TRAVEL_EMOJI[item.subtype || ''] || TYPE_EMOJI.travel
      : TYPE_EMOJI[item.type]
  let title = item.title?.trim() || TYPE_EMOJI[item.type]
  if (item.type === 'travel') {
    const num = item.number ? ` ${item.number}` : ''
    const route = item.from && item.to ? ` (${item.from}→${item.to})` : ''
    title = `${item.title || 'Travel'}${num}${route}`
  }
  return `${emoji} ${title}`.trim()
}

function buildDescription(item: ItineraryItem): string {
  const lines: string[] = []
  if (item.type === 'travel' && (item.from || item.to))
    lines.push(`Route: ${item.from || '?'} → ${item.to || '?'}`)
  if (item.number) lines.push(`Number: ${item.number}`)
  if (item.type === 'lodging' && item.nights) lines.push(`Nights: ${item.nights}`)
  if (item.confirmation) lines.push(`Confirmation: ${item.confirmation}`)
  if (item.seatsOrRoom)
    lines.push(`${item.type === 'lodging' ? 'Room' : 'Seats'}: ${item.seatsOrRoom}`)
  if (item.phone) lines.push(`Phone: ${item.phone}`)
  if (item.notes) lines.push('', item.notes)
  return lines.join('\n')
}

// Only the typed fields worth round-tripping (times/date come from event start/end).
function coreData(item: ItineraryItem) {
  return {
    type: item.type,
    subtype: item.subtype,
    title: item.title,
    from: item.from,
    to: item.to,
    number: item.number,
    nights: item.nights,
    confirmation: item.confirmation,
    phone: item.phone,
    seatsOrRoom: item.seatsOrRoom,
    notes: item.notes,
  }
}

// ---- public API ----

export function itemToEvent(item: ItineraryItem): GEvent {
  const tz = item.timezone || defaultTimezone
  const ev: GEvent = {
    summary: buildSummary(item),
    location: item.location || undefined,
    description: buildDescription(item) || undefined,
    extendedProperties: {
      private: { app: 'grandease', [GEDATA_KEY]: JSON.stringify(coreData(item)) },
    },
  }

  const isAllDay =
    item.type === 'lodging' || (!item.startTime && item.type === 'note')

  if (isAllDay) {
    const nights = item.type === 'lodging' ? Math.max(1, item.nights || 1) : 1
    ev.start = { date: item.date }
    ev.end = { date: addDays(item.date, nights) } // end date is exclusive
  } else {
    const startTime = item.startTime || '09:00'
    let endDate = item.date
    let endTime = item.endTime
    if (!endTime) {
      const r = addMinutesToTime(startTime, 60)
      endTime = r.time
      if (r.dayShift) endDate = addDays(item.date, r.dayShift)
    }
    ev.start = { dateTime: rfc3339(item.date, startTime, tz), timeZone: tz }
    ev.end = { dateTime: rfc3339(endDate, endTime, tz), timeZone: tz }
  }
  return ev
}

export function eventToItem(ev: GEvent): ItineraryItem {
  let core: Partial<ItineraryItem> = {}
  const raw = ev.extendedProperties?.private?.[GEDATA_KEY]
  if (raw) {
    try {
      core = JSON.parse(raw)
    } catch {
      /* ignore malformed */
    }
  }

  const type: ItemType = (core.type as ItemType) || 'note'
  const item: ItineraryItem = {
    id: ev.id,
    type,
    title: core.title || stripEmoji(ev.summary || 'Untitled'),
    subtype: core.subtype,
    date: '',
    location: ev.location,
    from: core.from,
    to: core.to,
    number: core.number,
    nights: core.nights,
    confirmation: core.confirmation,
    phone: core.phone,
    seatsOrRoom: core.seatsOrRoom,
    notes: core.notes,
  }

  // Times/date are the source of truth from the event itself.
  if (ev.start?.date) {
    item.date = ev.start.date
    if (type === 'lodging' && ev.end?.date) {
      item.nights = Math.max(1, daysBetween(ev.start.date, ev.end.date))
    }
  } else if (ev.start?.dateTime) {
    const tz = ev.start.timeZone || core.timezone || defaultTimezone
    const s = wallInZone(ev.start.dateTime, tz)
    item.date = s.date
    item.startTime = s.time
    item.timezone = tz
    if (ev.end?.dateTime) item.endTime = wallInZone(ev.end.dateTime, tz).time
  }
  return item
}

function stripEmoji(s: string): string {
  return s.replace(/^[\p{Emoji}\uFE0F\u200d\s]+/u, '').trim() || s
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()
  return Math.round(ms / 86400000)
}

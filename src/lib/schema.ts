import {
  ACTIVITY_SUBTYPES,
  TRAVEL_SUBTYPES,
  type ItineraryItem,
  type ItemType,
} from '../types'

// The prompt you paste into any LLM, followed by a reservation email or dictation.
// The model returns JSON matching this schema; the app turns it into calendar items.
export const SCHEMA_PROMPT = `You convert travel reservations / notes into JSON for the GrandEase Traveler app.
Return ONLY a JSON array (no prose) of itinerary items. Each item:

{
  "type": "travel" | "lodging" | "dining" | "activity" | "note",   // required
  "title": string,                 // required. Airline/hotel/restaurant/activity name, or note title
  "subtype": string,               // travel: airplane|train|car|subway|ship
                                   // activity: ${ACTIVITY_SUBTYPES.join('|')}
  "date": "YYYY-MM-DD",            // required. Start/departure/check-in date
  "endDate": "YYYY-MM-DD",         // travel only: arrival date if it differs from date (crosses midnight / multi-day)
  "startTime": "HH:mm",            // 24h DESTINATION-local time. Omit for all-day notes
  "endTime": "HH:mm",             // optional, destination-local
  "timezone": "IANA tz",          // OPTIONAL. Usually omit — the app derives it from location.
  "location": string,              // full address / city (used for maps AND to set the time zone)
  "from": string,                  // travel only: departure airport/place
  "to": string,                    // travel only: arrival airport/place
  "number": string,                // travel only: flight/train number
  "gate": string,                  // travel only: gate or platform
  "nights": number,                // lodging only: number of nights
  "confirmation": string,          // reservation/confirmation number
  "phone": string,
  "seatsOrRoom": string,           // travel seats OR hotel room number
  "notes": string
}

Rules:
- Output a JSON array even for a single item.
- Use 24-hour times. Convert AM/PM. Do not invent data you don't see.
- Times are LOCAL TO THE DESTINATION. A 7pm dinner in Paris is "startTime":"19:00" — never
  convert it to the reader's home time zone. Include a "location" (with city/country) so the
  app can set the correct time zone automatically; you can omit "timezone".
- If a hotel stay is given by check-in and check-out dates, set date=check-in and nights=(nights between).
- For travel that arrives on a later day than it departs (overnight flight, multi-day train/cruise),
  set "endDate" to the arrival date. Omit "endDate" when arrival is the same day as departure.
- Omit fields you don't have rather than using null.

Reservation / notes follow:
`

const TYPES: ItemType[] = ['travel', 'lodging', 'dining', 'activity', 'note']

function asString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined
  const s = String(v).trim()
  return s || undefined
}

function normTime(v: unknown): string | undefined {
  const s = asString(v)
  if (!s) return undefined
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function normDate(v: unknown): string | undefined {
  const s = asString(v)
  if (!s) return undefined
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return undefined
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

export interface ParseResult {
  items: ItineraryItem[]
  errors: string[]
}

/** Parse and validate pasted LLM JSON into itinerary items. */
export function parseItems(text: string): ParseResult {
  const errors: string[] = []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    // tolerate ```json fences and surrounding prose
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return { items: [], errors: ['Could not find JSON. Paste a JSON array.'] }
    try {
      data = JSON.parse(m[0])
    } catch (e) {
      return { items: [], errors: [`Invalid JSON: ${(e as Error).message}`] }
    }
  }

  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] })?.items)
      ? (data as { items: unknown[] }).items
      : [data]

  const items: ItineraryItem[] = []
  arr.forEach((row, i) => {
    const r = row as Record<string, unknown>
    const type = asString(r.type)?.toLowerCase() as ItemType | undefined
    if (!type || !TYPES.includes(type)) {
      errors.push(`Item ${i + 1}: missing/invalid "type".`)
      return
    }
    const date = normDate(r.date)
    if (!date) {
      errors.push(`Item ${i + 1}: missing/invalid "date" (need YYYY-MM-DD).`)
      return
    }
    let subtype = asString(r.subtype)?.toLowerCase()
    if (type === 'travel' && subtype && !TRAVEL_SUBTYPES.includes(subtype as never))
      subtype = 'airplane'
    if (type === 'activity' && subtype && !ACTIVITY_SUBTYPES.includes(subtype as never))
      subtype = 'activity'

    items.push({
      type,
      title: asString(r.title) || 'Untitled',
      subtype,
      date,
      endDate: normDate(r.endDate),
      startTime: normTime(r.startTime),
      endTime: normTime(r.endTime),
      timezone: asString(r.timezone),
      location: asString(r.location),
      from: asString(r.from),
      to: asString(r.to),
      number: asString(r.number),
      gate: asString(r.gate),
      nights: r.nights != null ? Number(r.nights) || undefined : undefined,
      confirmation: asString(r.confirmation),
      phone: asString(r.phone),
      seatsOrRoom: asString(r.seatsOrRoom),
      notes: asString(r.notes),
    })
  })

  return { items, errors }
}

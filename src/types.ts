// Core data model for GrandEase Traveler (web).
// A Trip == one Google Calendar. An itinerary Item == one Calendar event.

export type ItemType = 'travel' | 'lodging' | 'dining' | 'activity' | 'note'

export const TRAVEL_SUBTYPES = [
  'airplane',
  'train',
  'car',
  'subway',
  'ship',
] as const
export type TravelSubtype = (typeof TRAVEL_SUBTYPES)[number]

export const ACTIVITY_SUBTYPES = [
  'activity',
  'meeting',
  'driving',
  'art',
  'sightseeing',
  'beach',
  'entertainment',
  'dance',
  'shopping',
  'gymnastics',
  'tennis',
  'baseball',
  'basketball',
  'football',
  'yoga',
] as const
export type ActivitySubtype = (typeof ACTIVITY_SUBTYPES)[number]

// A single itinerary item. This flat shape is ALSO the LLM import schema.
export interface ItineraryItem {
  /** Google Calendar event id (absent for not-yet-saved items). */
  id?: string
  type: ItemType
  /** Carrier / hotel / restaurant / activity provider / note title. */
  title: string
  /** Travel subtype or activity subtype. */
  subtype?: string
  /** Start date, YYYY-MM-DD (local to the trip). */
  date: string
  /** Start time, HH:mm (24h). Omit for all-day / untimed notes. */
  startTime?: string
  /** End time, HH:mm (24h). Optional. */
  endTime?: string
  /** IANA timezone, e.g. "America/Los_Angeles". Defaults to device tz. */
  timezone?: string
  location?: string
  /** Travel: departure code/place. */
  from?: string
  /** Travel: arrival code/place. */
  to?: string
  /** Travel: flight / train / confirmation number. */
  number?: string
  /** Lodging: number of nights. */
  nights?: number
  /** Reservation / confirmation number. */
  confirmation?: string
  phone?: string
  /** Travel seats OR lodging room number. */
  seatsOrRoom?: string
  notes?: string
}

// A Trip is backed by a Google secondary calendar.
export interface Trip {
  /** Google calendarId. */
  id: string
  name: string
  /** YYYY-MM-DD, may be derived/stored in calendar description. */
  startDate: string
  endDate: string
  /** Access role from calendarList: "owner" | "writer" | "reader". */
  accessRole: string
  /** Calendar color (hex) if available. */
  color?: string
  /** Default DESTINATION timezone for new items on this trip (IANA id). */
  timezone?: string
}

// Marker stored in a trip calendar's description so we can find "our" calendars.
export interface TripMeta {
  grandease: 1
  v: number
  start?: string
  end?: string
  /** Default destination timezone for the trip. */
  tz?: string
}

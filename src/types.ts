// Core data model for GrandEase Traveler (web).
// A Trip is a `trips` row in Supabase; an itinerary Item is an `items` row.

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
  /** Item id (UUID; absent for not-yet-saved items). */
  id?: string
  type: ItemType
  /** Carrier / hotel / restaurant / activity provider / note title. */
  title: string
  /** Travel subtype or activity subtype. */
  subtype?: string
  /** Start date, YYYY-MM-DD (local to the trip). */
  date: string
  /** Travel: arrival date, YYYY-MM-DD. Absent means arrival is the same day as `date`. */
  endDate?: string
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
  /** Travel: gate or platform. */
  gate?: string
  /** Lodging: number of nights. */
  nights?: number
  /** Reservation / confirmation number. */
  confirmation?: string
  phone?: string
  /** Travel seats OR lodging room number. */
  seatsOrRoom?: string
  notes?: string
}

// A destination on a given day. Days carry the previous destination forward
// until a new one is set; a day may have up to 3 places (e.g. while traveling).
export interface DayPlace {
  /** Start time this place becomes "current", HH:mm (24h). First is usually 00:00. */
  time: string
  /** Human place name, e.g. "Paris, France". */
  name: string
  /** IANA timezone auto-detected from the name. */
  tz?: string
}

/** Explicitly-set destinations for one date. Stored sparsely (only set days). */
export interface DayLocations {
  /** YYYY-MM-DD. */
  date: string
  /** Places for the day, sorted by time. */
  places: DayPlace[]
}

// A Trip is a `trips` row in Supabase.
export interface Trip {
  /** Trip UUID. */
  id: string
  name: string
  /** YYYY-MM-DD. */
  startDate: string
  endDate: string
  /** Derived access role: "owner" | "writer" | "reader" (canEdit = !== "reader"). */
  accessRole: string
  /** Optional color (hex) if available. */
  color?: string
  /** Default DESTINATION timezone for new items on this trip (IANA id). */
  timezone?: string
  /** Per-day destinations (sparse; carry forward). */
  locations?: DayLocations[]
}

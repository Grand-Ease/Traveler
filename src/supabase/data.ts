// Supabase data adapter.
//
// This module exposes the SAME surface the offline store expects (see
// src/store/store.ts). The store talks to the backend ONLY through this file,
// so swapping backends is a one-line import change in the store.
//
// Times are stored as wall-clock text (HH:mm) + IANA timezone, never as
// timestamptz — the row<->type mappers below translate the DB column names
// (snake_case, from_place/to_place/seats_or_room/end_date) to the app's
// ItineraryItem shape (from/to/seatsOrRoom/endDate).

import type { DayLocations, ItineraryItem, Trip } from '../types'
import { throwFunctionInvokeError } from './functionErrors'
import { supabase } from './client'

// ---------- row shapes ----------

interface TripRow {
  id: string
  owner_id: string
  name: string
  start_date: string
  end_date: string
  timezone: string | null
  color: string | null
  locations: DayLocations[] | null
  created_at?: string
  updated_at?: string
}

interface ItemRow {
  id: string
  trip_id: string
  type: ItineraryItem['type']
  title: string
  subtype: string | null
  date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  timezone: string | null
  location: string | null
  from_place: string | null
  to_place: string | null
  number: string | null
  gate: string | null
  nights: number | null
  confirmation: string | null
  phone: string | null
  seats_or_room: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

interface MemberTripRow {
  role: string
  trip: TripRow | null
}

interface MemberRow {
  id: string
  user_id: string | null
  email: string
  role: string
  accepted: boolean
  invited_at: string
  last_sent_at: string | null
}

// ---------- role / access mapping ----------

// The app's existing convention: canEdit = accessRole !== 'reader'.
//   owner  -> 'owner'
//   editor -> 'writer'
//   viewer -> 'reader'
function roleToAccess(role: string): string {
  if (role === 'owner') return 'owner'
  if (role === 'editor') return 'writer'
  return 'reader'
}

// ---------- mappers ----------

function rowToTrip(row: TripRow, role: string): Trip {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    accessRole: roleToAccess(role),
    color: row.color ?? undefined,
    timezone: row.timezone ?? undefined,
    locations: row.locations ?? undefined,
  }
}

function rowToItem(row: ItemRow): ItineraryItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    subtype: row.subtype ?? undefined,
    date: row.date,
    endDate: row.end_date ?? undefined,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    timezone: row.timezone ?? undefined,
    location: row.location ?? undefined,
    from: row.from_place ?? undefined,
    to: row.to_place ?? undefined,
    number: row.number ?? undefined,
    gate: row.gate ?? undefined,
    nights: row.nights ?? undefined,
    confirmation: row.confirmation ?? undefined,
    phone: row.phone ?? undefined,
    seatsOrRoom: row.seats_or_room ?? undefined,
    notes: row.notes ?? undefined,
  }
}

// Build an insert/update payload for `items`. Includes `id` only when the
// caller supplied one (the store mints a real UUID so local id == server id).
function itemToRow(tripId: string, item: ItineraryItem): Record<string, unknown> {
  const row: Record<string, unknown> = {
    trip_id: tripId,
    type: item.type,
    title: item.title,
    subtype: item.subtype ?? null,
    date: item.date,
    end_date: item.endDate ?? null,
    start_time: item.startTime ?? null,
    end_time: item.endTime ?? null,
    timezone: item.timezone ?? null,
    location: item.location ?? null,
    from_place: item.from ?? null,
    to_place: item.to ?? null,
    number: item.number ?? null,
    gate: item.gate ?? null,
    nights: item.nights ?? null,
    confirmation: item.confirmation ?? null,
    phone: item.phone ?? null,
    seats_or_room: item.seatsOrRoom ?? null,
    notes: item.notes ?? null,
  }
  if (item.id) row.id = item.id
  return row
}

// ---------- helpers ----------

// Read the signed-in user id from the LOCAL persisted session (no network).
async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Not signed in.')
  return id
}

// ---------- trips ----------

export async function listTrips(): Promise<Trip[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('trip_members')
    .select('role, trip:trips(*)')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as MemberTripRow[]
  const trips = rows
    .filter((r) => r.trip)
    .map((r) => rowToTrip(r.trip as TripRow, r.role))
  trips.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
  return trips
}

export async function createTrip(
  name: string,
  start: string,
  end: string,
  tz?: string,
  locations?: DayLocations[],
  id?: string,
): Promise<Trip> {
  const userId = await requireUserId()
  const insert: Record<string, unknown> = {
    owner_id: userId,
    name,
    start_date: start,
    end_date: end,
    timezone: tz ?? null,
    locations: locations ?? null,
  }
  if (id) insert.id = id
  const { data, error } = await supabase
    .from('trips')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  // A DB trigger inserts the owner's trip_members row automatically.
  return rowToTrip(data as unknown as TripRow, 'owner')
}

export async function updateTrip(trip: Trip): Promise<void> {
  const { error } = await supabase
    .from('trips')
    .update({
      name: trip.name,
      start_date: trip.startDate,
      end_date: trip.endDate,
      timezone: trip.timezone ?? null,
      color: trip.color ?? null,
      locations: trip.locations ?? null,
    })
    .eq('id', trip.id)
  if (error) throw new Error(error.message)
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Leave a shared trip (delete your own membership) without deleting the trip. */
export async function unsubscribeTrip(id: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', id)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

// ---------- items ----------

export async function listItems(tripId: string): Promise<ItineraryItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('trip_id', tripId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as ItemRow[]
  return rows.map(rowToItem)
}

export async function addItem(tripId: string, item: ItineraryItem): Promise<ItineraryItem> {
  const { data, error } = await supabase
    .from('items')
    .insert(itemToRow(tripId, item))
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToItem(data as unknown as ItemRow)
}

export async function updateItem(tripId: string, item: ItineraryItem): Promise<ItineraryItem> {
  if (!item.id) return addItem(tripId, item)
  const { data, error } = await supabase
    .from('items')
    .update(itemToRow(tripId, item))
    .eq('id', item.id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToItem(data as unknown as ItemRow)
}

export async function deleteItem(_tripId: string, id: string): Promise<void> {
  void _tripId
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---------- sharing (membership model) ----------

export interface Share {
  id: string
  userId?: string
  email: string
  /** DB role: 'owner' | 'editor' | 'viewer'. */
  role: string
  accepted: boolean
  invitedAt: string
  lastSentAt?: string
}

export async function listShares(tripId: string): Promise<Share[]> {
  const { data, error } = await supabase.rpc('list_trip_shares', { p_trip: tripId })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as MemberRow[]
  return rows.map((m) => ({
    id: m.id,
    userId: m.user_id || undefined,
    email: m.email,
    role: m.role,
    accepted: m.accepted,
    invitedAt: m.invited_at,
    lastSentAt: m.last_sent_at ?? undefined,
  }))
}

export interface InviteResult {
  status: 'added' | 'invited'
  emailSent: boolean
  emailSkipped?: boolean
  emailError?: string
}

export async function shareTrip(
  tripId: string,
  email: string,
  role: 'editor' | 'viewer',
): Promise<InviteResult> {
  const { data, error } = await supabase.functions.invoke('send-trip-invite', {
    body: { tripId, email, role },
  })
  if (error) await throwFunctionInvokeError(error)
  if (data?.error) throw new Error(String(data.error))
  return data as InviteResult
}

export async function unshareTrip(tripId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_trip: tripId, p_user: userId })
  if (error) throw new Error(error.message)
}

export async function removePendingInvite(tripId: string, inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_pending_invite', {
    p_trip: tripId,
    p_invite: inviteId,
  })
  if (error) throw new Error(error.message)
}

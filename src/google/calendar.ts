import { APP_MARKER, META_VERSION } from '../config'
import type { ItineraryItem, Trip, TripMeta } from '../types'
import { eventToItem, itemToEvent, type GEvent } from '../lib/convert'
import { getToken } from './auth'

const BASE = 'https://www.googleapis.com/calendar/v3'

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.error?.message) msg = body.error.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- trip metadata stored in the calendar description ----

function encodeMeta(start: string, end: string, tz?: string): string {
  const meta: TripMeta = { grandease: 1, v: META_VERSION, start, end, tz }
  return `${APP_MARKER}\n${JSON.stringify(meta)}`
}

function parseMeta(description?: string): TripMeta | null {
  if (!description || !description.includes(APP_MARKER)) return null
  const line = description.split('\n').find((l) => l.trim().startsWith('{'))
  if (!line) return { grandease: 1, v: META_VERSION }
  try {
    const m = JSON.parse(line)
    if (m && m.grandease === 1) return m
  } catch {
    /* ignore */
  }
  return { grandease: 1, v: META_VERSION }
}

// ---- Trips (calendars) ----

interface CalListEntry {
  id: string
  summary: string
  description?: string
  accessRole: string
  backgroundColor?: string
  primary?: boolean
}

export async function listTrips(): Promise<Trip[]> {
  const trips: Trip[] = []
  let pageToken: string | undefined
  do {
    const q = new URLSearchParams({ minAccessRole: 'reader', showHidden: 'false' })
    if (pageToken) q.set('pageToken', pageToken)
    const data = await api<{ items: CalListEntry[]; nextPageToken?: string }>(
      `/users/me/calendarList?${q}`,
    )
    for (const c of data.items || []) {
      const meta = parseMeta(c.description)
      if (!meta) continue // only our trip calendars
      trips.push({
        id: c.id,
        name: c.summary,
        startDate: meta.start || '',
        endDate: meta.end || '',
        accessRole: c.accessRole,
        color: c.backgroundColor,
        timezone: meta.tz,
      })
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  trips.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
  return trips
}

export async function createTrip(
  name: string,
  start: string,
  end: string,
  tz?: string,
): Promise<Trip> {
  const cal = await api<{ id: string }>(`/calendars`, {
    method: 'POST',
    body: JSON.stringify({ summary: name, description: encodeMeta(start, end, tz) }),
  })
  // Match the trip calendar's own timezone to the destination so native
  // calendar apps also anchor these events to that zone.
  if (tz) {
    try {
      await api(`/calendars/${encodeURIComponent(cal.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ timeZone: tz }),
      })
    } catch {
      /* non-fatal */
    }
  }
  return { id: cal.id, name, startDate: start, endDate: end, accessRole: 'owner', timezone: tz }
}

export async function updateTrip(trip: Trip): Promise<void> {
  await api(`/calendars/${encodeURIComponent(trip.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      summary: trip.name,
      description: encodeMeta(trip.startDate, trip.endDate, trip.timezone),
      ...(trip.timezone ? { timeZone: trip.timezone } : {}),
    }),
  })
}

export async function deleteTrip(id: string): Promise<void> {
  // DELETE removes an owned secondary calendar; otherwise just unsubscribe.
  await api(`/calendars/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Remove a shared trip from your list without deleting the source calendar. */
export async function unsubscribeTrip(id: string): Promise<void> {
  await api(`/users/me/calendarList/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---- Items (events) ----

export async function listItems(calendarId: string): Promise<ItineraryItem[]> {
  const items: ItineraryItem[] = []
  let pageToken: string | undefined
  do {
    const q = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      showDeleted: 'false',
    })
    if (pageToken) q.set('pageToken', pageToken)
    const data = await api<{ items: GEvent[]; nextPageToken?: string }>(
      `/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
    )
    for (const ev of data.items || []) items.push(eventToItem(ev))
    pageToken = data.nextPageToken
  } while (pageToken)
  return items
}

export async function addItem(
  calendarId: string,
  item: ItineraryItem,
): Promise<ItineraryItem> {
  const ev = await api<GEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', body: JSON.stringify(itemToEvent(item)) },
  )
  return eventToItem(ev)
}

export async function updateItem(
  calendarId: string,
  item: ItineraryItem,
): Promise<ItineraryItem> {
  if (!item.id) return addItem(calendarId, item)
  const ev = await api<GEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(item.id)}`,
    { method: 'PUT', body: JSON.stringify(itemToEvent(item)) },
  )
  return eventToItem(ev)
}

export async function deleteItem(calendarId: string, eventId: string): Promise<void> {
  await api(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' },
  )
}

// ---- Sharing (ACL) ----

export async function shareTrip(
  calendarId: string,
  email: string,
  role: 'writer' | 'reader' = 'writer',
): Promise<void> {
  await api(`/calendars/${encodeURIComponent(calendarId)}/acl`, {
    method: 'POST',
    body: JSON.stringify({ role, scope: { type: 'user', value: email } }),
  })
}

export interface AclEntry {
  id: string
  role: string
  scope: { type: string; value?: string }
}

export async function listShares(calendarId: string): Promise<AclEntry[]> {
  const data = await api<{ items: AclEntry[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/acl`,
  )
  return (data.items || []).filter((a) => a.scope.type === 'user')
}

export async function unshareTrip(calendarId: string, ruleId: string): Promise<void> {
  await api(
    `/calendars/${encodeURIComponent(calendarId)}/acl/${encodeURIComponent(ruleId)}`,
    { method: 'DELETE' },
  )
}

// Offline-first data layer.
//
// Google Calendar is the source of truth. This store keeps a local cache
// (localStorage) so the app is instant and works offline, and a queue of
// pending mutations that are flushed to Google when connectivity returns.
//
// UI reads from the cache synchronously and subscribes to changes; every
// mutation is applied optimistically to the cache and enqueued, then a sync
// is attempted. On sync we flush the queue (remapping temp IDs -> real IDs)
// and then pull fresh server state.

import type { ItineraryItem, Trip } from '../types'
import * as api from '../google/calendar'

// ---------- persistence ----------

const K_TRIPS = 'grandease.cache.trips'
const K_ITEMS = (calId: string) => `grandease.cache.items.${calId}`
const K_QUEUE = 'grandease.queue'
const K_IDMAP = 'grandease.idmap'

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

// ---------- queued operations ----------

type Op =
  | { kind: 'trip.create'; tempId: string; name: string; start: string; end: string; tries?: number }
  | { kind: 'trip.update'; id: string; name: string; start: string; end: string; tries?: number }
  | { kind: 'trip.delete'; id: string; owned: boolean; tries?: number }
  | { kind: 'item.add'; calendarId: string; tempId: string; item: ItineraryItem; tries?: number }
  | { kind: 'item.update'; calendarId: string; item: ItineraryItem; tries?: number }
  | { kind: 'item.delete'; calendarId: string; id: string; tries?: number }

// ---------- in-memory state ----------

let trips: Trip[] = readJSON<Trip[]>(K_TRIPS, [])
const itemsCache = new Map<string, ItineraryItem[]>()
let queue: Op[] = readJSON<Op[]>(K_QUEUE, [])
let idMap: Record<string, string> = readJSON<Record<string, string>>(K_IDMAP, {})

let syncing = false
let lastError: string | undefined
let lastSyncedAt: number | undefined = undefined

const listeners = new Set<() => void>()
function emit() {
  for (const fn of listeners) fn()
}
export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---------- helpers ----------

const uid = () =>
  'tmp_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random())
const resolve = (id: string) => idMap[id] || id
export const isOnline = () => navigator.onLine

function persistTrips() {
  writeJSON(K_TRIPS, trips)
}
function persistItems(calId: string) {
  writeJSON(K_ITEMS(calId), itemsCache.get(calId) || [])
}
function persistQueue() {
  writeJSON(K_QUEUE, queue)
}
function persistIdMap() {
  writeJSON(K_IDMAP, idMap)
}

function loadItems(calId: string): ItineraryItem[] {
  if (!itemsCache.has(calId)) itemsCache.set(calId, readJSON<ItineraryItem[]>(K_ITEMS(calId), []))
  return itemsCache.get(calId)!
}

// ---------- status ----------

export interface SyncStatus {
  online: boolean
  pending: number
  syncing: boolean
  lastError?: string
  lastSyncedAt?: number
}
export function getStatus(): SyncStatus {
  return { online: isOnline(), pending: queue.length, syncing, lastError, lastSyncedAt }
}

// ---------- reads ----------

export function getTrips(): Trip[] {
  return trips
}
export function getItems(calId: string): ItineraryItem[] {
  return loadItems(resolve(calId))
}

// ---------- trip mutations (optimistic) ----------

export function createTrip(name: string, start: string, end: string): Trip {
  const tempId = uid()
  const trip: Trip = { id: tempId, name, startDate: start, endDate: end, accessRole: 'owner' }
  trips = [...trips, trip].sort((a, b) => a.startDate.localeCompare(b.startDate))
  persistTrips()
  queue.push({ kind: 'trip.create', tempId, name, start, end })
  persistQueue()
  emit()
  void sync()
  return trip
}

export function updateTrip(trip: Trip): void {
  const id = resolve(trip.id)
  trips = trips.map((t) => (t.id === id ? { ...trip, id } : t))
  persistTrips()
  const create = queue.find(
    (o) => o.kind === 'trip.create' && o.tempId === trip.id,
  ) as Extract<Op, { kind: 'trip.create' }> | undefined
  if (create) {
    create.name = trip.name
    create.start = trip.startDate
    create.end = trip.endDate
  } else {
    queue = queue.filter((o) => !(o.kind === 'trip.update' && o.id === id))
    queue.push({
      kind: 'trip.update',
      id,
      name: trip.name,
      start: trip.startDate,
      end: trip.endDate,
    })
  }
  persistQueue()
  emit()
  void sync()
}

export function deleteTrip(trip: Trip): void {
  const id = resolve(trip.id)
  trips = trips.filter((t) => t.id !== id)
  persistTrips()
  itemsCache.delete(id)
  localStorage.removeItem(K_ITEMS(id))

  const hadCreate = queue.some((o) => o.kind === 'trip.create' && o.tempId === trip.id)
  // Drop any queued ops that reference this trip (matching temp or real id).
  const refs = new Set([id, trip.id])
  queue = queue.filter((o) => {
    if (o.kind === 'trip.create' && o.tempId === trip.id) return false
    if (o.kind === 'trip.update' && refs.has(o.id)) return false
    if ((o.kind === 'item.add' || o.kind === 'item.update' || o.kind === 'item.delete') &&
        refs.has(o.calendarId))
      return false
    return true
  })
  // Only tell the server to delete if it ever existed there.
  if (!hadCreate) {
    queue.push({ kind: 'trip.delete', id, owned: trip.accessRole === 'owner' })
  }
  persistQueue()
  emit()
  void sync()
}

// ---------- item mutations (optimistic) ----------

export function addItem(calIdRaw: string, item: ItineraryItem): ItineraryItem {
  const calId = resolve(calIdRaw)
  const tempId = uid()
  const saved: ItineraryItem = { ...item, id: tempId }
  const list = [...loadItems(calId), saved]
  itemsCache.set(calId, list)
  persistItems(calId)
  queue.push({ kind: 'item.add', calendarId: calId, tempId, item: saved })
  persistQueue()
  emit()
  void sync()
  return saved
}

export function updateItem(calIdRaw: string, item: ItineraryItem): ItineraryItem {
  const calId = resolve(calIdRaw)
  const list = loadItems(calId).map((i) => (i.id === item.id ? item : i))
  itemsCache.set(calId, list)
  persistItems(calId)

  const add = queue.find(
    (o) => o.kind === 'item.add' && o.tempId === item.id,
  ) as Extract<Op, { kind: 'item.add' }> | undefined
  if (add) {
    add.item = item
  } else {
    queue = queue.filter((o) => !(o.kind === 'item.update' && o.item.id === item.id))
    queue.push({ kind: 'item.update', calendarId: calId, item })
  }
  persistQueue()
  emit()
  void sync()
  return item
}

export function deleteItem(calIdRaw: string, id: string): void {
  const calId = resolve(calIdRaw)
  const list = loadItems(calId).filter((i) => i.id !== id)
  itemsCache.set(calId, list)
  persistItems(calId)

  const hadAdd = queue.some((o) => o.kind === 'item.add' && o.tempId === id)
  queue = queue.filter((o) => {
    if (o.kind === 'item.add' && o.tempId === id) return false
    if (o.kind === 'item.update' && o.item.id === id) return false
    return true
  })
  if (!hadAdd) queue.push({ kind: 'item.delete', calendarId: calId, id })
  persistQueue()
  emit()
  void sync()
}

// ---------- sync engine ----------

function isNetworkError(e: unknown): boolean {
  if (!isOnline()) return true
  if (e instanceof TypeError) return true // fetch network failure
  const m = (e as Error)?.message?.toLowerCase() || ''
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed')
  )
}
function isNotFound(e: unknown): boolean {
  const m = (e as Error)?.message?.toLowerCase() || ''
  return m.includes('not found') || m.includes('404') || m.includes('410') || m.includes('deleted')
}

function mapId(tempId: string, realId: string) {
  idMap[tempId] = realId
  persistIdMap()
  // Rewrite references in the remaining queue.
  for (const o of queue) {
    if ('calendarId' in o && o.calendarId === tempId) o.calendarId = realId
    if (o.kind === 'trip.update' && o.id === tempId) o.id = realId
    if (o.kind === 'trip.delete' && o.id === tempId) o.id = realId
    if (o.kind === 'item.update' && o.item.id === tempId) o.item = { ...o.item, id: realId }
    if (o.kind === 'item.delete' && o.id === tempId) o.id = realId
  }
  persistQueue()
}

async function applyOp(op: Op): Promise<void> {
  switch (op.kind) {
    case 'trip.create': {
      const t = await api.createTrip(op.name, op.start, op.end)
      // Migrate cached items from the temp calendar id to the real one.
      const temp = loadItems(op.tempId)
      if (temp.length) {
        itemsCache.set(t.id, temp)
        persistItems(t.id)
      }
      itemsCache.delete(op.tempId)
      localStorage.removeItem(K_ITEMS(op.tempId))
      trips = trips.map((x) => (x.id === op.tempId ? { ...t } : x))
      persistTrips()
      mapId(op.tempId, t.id)
      break
    }
    case 'trip.update':
      await api.updateTrip({
        id: resolve(op.id),
        name: op.name,
        startDate: op.start,
        endDate: op.end,
        accessRole: 'owner',
      })
      break
    case 'trip.delete':
      try {
        op.owned ? await api.deleteTrip(resolve(op.id)) : await api.unsubscribeTrip(resolve(op.id))
      } catch (e) {
        if (!isNotFound(e)) throw e
      }
      break
    case 'item.add': {
      const calId = resolve(op.calendarId)
      const { id: _drop, ...body } = op.item
      void _drop
      const saved = await api.addItem(calId, body as ItineraryItem)
      const list = loadItems(calId).map((i) => (i.id === op.tempId ? saved : i))
      itemsCache.set(calId, list)
      persistItems(calId)
      mapId(op.tempId, saved.id!)
      break
    }
    case 'item.update': {
      const calId = resolve(op.calendarId)
      await api.updateItem(calId, { ...op.item, id: resolve(op.item.id!) })
      break
    }
    case 'item.delete': {
      const calId = resolve(op.calendarId)
      try {
        await api.deleteItem(calId, resolve(op.id))
      } catch (e) {
        if (!isNotFound(e)) throw e
      }
      break
    }
  }
}

async function flush(): Promise<void> {
  while (queue.length) {
    const op = queue[0]
    try {
      await applyOp(op)
      queue.shift()
      persistQueue()
    } catch (e) {
      if (isNetworkError(e)) throw e // stop; keep queue for later
      op.tries = (op.tries || 0) + 1
      if (op.tries >= 5) {
        // Poison op — drop it so the queue isn't stuck forever.
        queue.shift()
        persistQueue()
        lastError = `Skipped a change after repeated errors: ${(e as Error).message}`
      } else {
        persistQueue()
        throw e // stop this pass; retry next sync
      }
    }
  }
}

async function pull(): Promise<void> {
  const fresh = await api.listTrips()
  trips = fresh
  persistTrips()
  // Refresh items for calendars we have cached (open/visited trips).
  const cachedCalIds = fresh.map((t) => t.id).filter((id) => itemsCache.has(id))
  for (const calId of cachedCalIds) {
    const items = await api.listItems(calId)
    itemsCache.set(calId, items)
    persistItems(calId)
  }
}

export async function sync(): Promise<void> {
  if (syncing || !isOnline()) return
  syncing = true
  lastError = undefined
  emit()
  try {
    await flush()
    await pull()
    lastSyncedAt = Date.now()
  } catch (e) {
    if (!isNetworkError(e)) lastError = (e as Error).message
  } finally {
    syncing = false
    emit()
  }
}

/** Ensure a trip's items are fetched from the server at least once (when online). */
export async function refreshItems(calId: string): Promise<void> {
  loadItems(resolve(calId)) // hydrate from cache
  emit()
  if (isOnline() && queue.length === 0) {
    try {
      const items = await api.listItems(resolve(calId))
      itemsCache.set(resolve(calId), items)
      persistItems(resolve(calId))
      emit()
    } catch {
      /* offline / transient — cache stands */
    }
  } else {
    void sync()
  }
}

// React to connectivity changes.
window.addEventListener('online', () => {
  emit()
  void sync()
})
window.addEventListener('offline', () => emit())

import { useEffect, useState } from 'react'
import type { ItineraryItem, Trip } from '../types'
import * as store from './store'

export function useSyncStatus(): store.SyncStatus {
  const [status, setStatus] = useState<store.SyncStatus>(store.getStatus())
  useEffect(() => store.subscribe(() => setStatus(store.getStatus())), [])
  return status
}

export function useTrips(): Trip[] {
  const [trips, setTrips] = useState<Trip[]>(store.getTrips())
  useEffect(() => {
    const unsub = store.subscribe(() => setTrips(store.getTrips()))
    void store.sync() // pull latest when online
    return unsub
  }, [])
  return trips
}

/** Live trip from the store (reflects edits/sync), falling back to `initial`. */
export function useTrip(initial: Trip): Trip {
  const [trip, setTrip] = useState<Trip>(initial)
  useEffect(() => {
    const update = () => setTrip(store.getTrips().find((t) => t.id === initial.id) || initial)
    update()
    return store.subscribe(update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id])
  return trip
}

export function useItems(calId: string): ItineraryItem[] {
  const [items, setItems] = useState<ItineraryItem[]>(store.getItems(calId))
  useEffect(() => {
    const unsub = store.subscribe(() => setItems(store.getItems(calId)))
    void store.refreshItems(calId)
    return unsub
  }, [calId])
  return items
}

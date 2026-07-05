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

export function useItems(calId: string): ItineraryItem[] {
  const [items, setItems] = useState<ItineraryItem[]>(store.getItems(calId))
  useEffect(() => {
    const unsub = store.subscribe(() => setItems(store.getItems(calId)))
    void store.refreshItems(calId)
    return unsub
  }, [calId])
  return items
}

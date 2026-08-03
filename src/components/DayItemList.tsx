import { useMemo } from 'react'
import type { ItineraryItem } from '../types'
import {
  itemAffectsDay,
  lodgingCoversDay,
  sortTimeForDay,
  stayPhase,
  type StayPhase,
} from '../lib/itineraryDay'
import type { MapCat } from './DayMap'
import ItemCard from './ItemCard'

type Leg = 'departure' | 'arrival'

interface ListEntry {
  key: string
  item: ItineraryItem
  leg?: Leg
  stay?: StayPhase
  time?: string
}

interface Props {
  items: ItineraryItem[]
  day: string
  cats: Record<MapCat, boolean>
  canEdit: boolean
  onEdit: (item: ItineraryItem) => void
  onDelete: (item: ItineraryItem) => void
  onAdd: () => void
}

/**
 * One day's itinerary cards. Entries mirror the map: a travel item splits into
 * a departure leg (on its departure day) and an arrival leg (on its arrival
 * day); everything else is a single entry. The category chips toggle each
 * leg/type on and off.
 */
export default function DayItemList({
  items,
  day,
  cats,
  canEdit,
  onEdit,
  onDelete,
  onAdd,
}: Props) {
  const entries = useMemo<ListEntry[]>(() => {
    const out: ListEntry[] = []
    for (const it of items) {
      if (it.type === 'travel') {
        if (cats.departure && it.date === day)
          out.push({ key: `${it.id}-dep`, item: it, leg: 'departure', time: it.startTime })
        const arrDate = it.endDate || it.date
        if (cats.arrival && arrDate === day)
          out.push({ key: `${it.id}-arr`, item: it, leg: 'arrival', time: it.endTime })
      } else if (it.type === 'lodging') {
        if (!cats.lodging) continue
        if (lodgingCoversDay(it, day))
          out.push({
            key: it.id || `${it.date}-${it.title}`,
            item: it,
            stay: stayPhase(it, day),
            time: sortTimeForDay(it, day),
          })
      } else if (cats[it.type as MapCat] && it.date === day) {
        out.push({ key: it.id || `${it.date}-${it.title}`, item: it, time: it.startTime })
      }
    }
    out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
    return out
  }, [items, day, cats])

  const hasAnyItems = useMemo(
    () => items.some((item) => itemAffectsDay(item, day)),
    [items, day],
  )

  return (
    <>
      {entries.length === 0 && (
        <div className="text-center py-16 text-white/40">
          <p>
            {hasAnyItems
              ? 'No items match the selected filters.'
              : 'Nothing planned for this day.'}
          </p>
          {canEdit && (
            <button className="btn-primary mt-4" onClick={onAdd}>
              Add something
            </button>
          )}
        </div>
      )}
      {entries.map((entry) => (
        <ItemCard
          key={entry.key}
          item={entry.item}
          leg={entry.leg}
          stay={entry.stay}
          canEdit={canEdit}
          onEdit={() => onEdit(entry.item)}
          onDelete={() => onDelete(entry.item)}
        />
      ))}
    </>
  )
}

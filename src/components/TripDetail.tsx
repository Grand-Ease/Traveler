import { useEffect, useMemo, useState } from 'react'
import {
  Home as HomeIcon,
  List as ListIcon,
  Map as MapIcon,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { DayPlace, ItineraryItem, Trip } from '../types'
import { itemAffectsDay, tripDays } from '../lib/itineraryDay'
import { setDayPlaces } from '../lib/locations'
import { useDaySwipe } from '../hooks/useDaySwipe'
import * as store from '../store/store'
import { useItems, useTrip } from '../store/hooks'
import { TYPE_ICONS } from './icons'
import DayMap, { type MapCat } from './DayMap'
import DayHeaderCard from './DayHeaderCard'
import DayItemList from './DayItemList'
import SwipeDeck from './SwipeDeck'
import ItemForm from './ItemForm'
import ImportModal from './ImportModal'
import SyncBadge from './SyncBadge'

interface Props {
  trip: Trip
  onBack: () => void
}

// Shared multi-select categories for BOTH list and map. Travel is split into
// departure/arrival; the rest map 1:1 to item types.
const CATS: MapCat[] = ['departure', 'arrival', 'lodging', 'dining', 'activity', 'note']
const CAT_ICON: Record<MapCat, LucideIcon> = {
  departure: PlaneTakeoff,
  arrival: PlaneLanding,
  lodging: TYPE_ICONS.lodging,
  dining: TYPE_ICONS.dining,
  activity: TYPE_ICONS.activity,
  note: TYPE_ICONS.note,
}
const CAT_LABEL: Record<MapCat, string> = {
  departure: 'Departure',
  arrival: 'Arrival',
  lodging: 'Lodging',
  dining: 'Dining',
  activity: 'Activity',
  note: 'Note',
}

export default function TripDetail({ trip: tripProp, onBack }: Props) {
  const trip = useTrip(tripProp)
  const items = useItems(trip.id)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [cats, setCats] = useState<Record<MapCat, boolean>>({
    departure: true,
    arrival: true,
    lodging: true,
    dining: true,
    activity: true,
    note: true,
  })
  // Track the selected day as a DATE STRING so it survives `days` recomputing
  // (e.g. after adding an item), instead of an index that gets reset.
  const [selectedDay, setSelectedDay] = useState('')
  const [editing, setEditing] = useState<ItineraryItem | null>(null)
  const [importing, setImporting] = useState(false)

  const canEdit = trip.accessRole !== 'reader'

  // All days = trip range unioned with any item dates that fall outside.
  const days = useMemo(() => tripDays(trip, items), [items, trip])

  useEffect(() => {
    // Only pick a default day when the current selection isn't valid (initial
    // mount, or the selected day disappeared). Otherwise keep the user's day so
    // adding an item doesn't snap back to today/first day.
    if (selectedDay && days.includes(selectedDay)) return
    const today = new Date().toISOString().slice(0, 10)
    setSelectedDay(days.includes(today) ? today : days[0])
  }, [days, selectedDay])

  const day = days.includes(selectedDay) ? selectedDay : days[0]
  const dayIndex = Math.max(0, days.indexOf(day))

  // The map owns its own drag/zoom gestures, and a modal covering the page
  // shouldn't drag the day underneath it, so the deck only runs in list mode.
  const deckActive = viewMode === 'list' && !editing && !importing
  const swipe = useDaySwipe({
    index: dayIndex,
    count: days.length,
    enabled: deckActive,
    onCommit: (index) => setSelectedDay(days[index]),
  })
  const prevDay = deckActive ? days[dayIndex - 1] : undefined
  const nextDay = deckActive ? days[dayIndex + 1] : undefined

  // The whole day's items (the map uses these; it applies `cats` itself).
  const allDayItems = useMemo(
    () => items.filter((item) => itemAffectsDay(item, day)),
    [items, day],
  )

  function removeItem(it: ItineraryItem) {
    if (!it.id) return
    if (!confirm(`Delete “${it.title}”?`)) return
    store.deleteItem(trip.id, it.id)
  }

  function saveDayPlaces(forDay: string, places: DayPlace[]) {
    store.updateTrip({ ...trip, locations: setDayPlaces(trip, forDay, places) })
  }

  function startAdd(forDay: string) {
    // New items default to an activity at noon with a +1h end; the type can be
    // changed in the form.
    setEditing({
      type: 'activity',
      title: '',
      date: forDay,
      startTime: '12:00',
      endTime: '13:00',
    })
  }

  const headerCard = (forDay: string) => (
    <DayHeaderCard
      trip={trip}
      items={items}
      day={forDay}
      dayIndex={days.indexOf(forDay)}
      dayCount={days.length}
      canEdit={canEdit}
      onPrev={() => swipe.slide(-1)}
      onNext={() => swipe.slide(1)}
      onSavePlaces={saveDayPlaces}
    />
  )

  const itemList = (forDay: string) => (
    <DayItemList
      items={items}
      day={forDay}
      cats={cats}
      canEdit={canEdit}
      onEdit={setEditing}
      onDelete={removeItem}
      onAdd={() => startAdd(forDay)}
    />
  )

  return (
    // One day spans this element's width, which is what the deck translates by.
    <div ref={swipe.containerRef} className="flex flex-col h-full max-w-2xl mx-auto w-full">
      {/* Header (fixed, does not scroll) */}
      <div className="shrink-0">
        <div className="safe-top">
          <div className="flex justify-end mb-1 px-4">
            <SyncBadge />
          </div>
          <SwipeDeck
            trackRef={swipe.trackRef}
            cellClassName="px-4"
            previous={prevDay && headerCard(prevDay)}
            next={nextDay && headerCard(nextDay)}
          >
            {headerCard(day)}
          </SwipeDeck>
        </div>

        {/* Mode toggle (segmented) + shared category filters */}
        <div
          className="flex items-center gap-2 px-4 py-3 overflow-x-auto"
          data-no-day-swipe
        >
          {/* Leftmost: a segmented List | Map switch. Its pill shape and paired
              icons read as a mode toggle, distinct from the round filter chips. */}
          <div className="shrink-0 inline-flex items-center h-10 rounded-full border border-white/15 overflow-hidden">
            {(['list', 'map'] as const).map((m) => {
              const active = viewMode === m
              const Ico = m === 'list' ? ListIcon : MapIcon
              const label = m === 'list' ? 'List view' : 'Map view'
              return (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  aria-label={label}
                  title={label}
                  aria-pressed={active}
                  className={`inline-flex items-center justify-center w-10 h-10 ${
                    active ? 'bg-teal text-white' : 'text-white/50 hover:bg-white/5'
                  }`}
                >
                  <Ico size={18} />
                </button>
              )
            })}
          </div>

          <div className="w-px h-6 bg-white/10 shrink-0" />

          {/* Shared filters: multi-select in both list and map modes. */}
          {CATS.map((c) => {
            const active = cats[c]
            const Ico = CAT_ICON[c]
            const label = CAT_LABEL[c]
            return (
              <button
                key={c}
                onClick={() => setCats((m) => ({ ...m, [c]: !m[c] }))}
                aria-label={label}
                title={label}
                aria-pressed={active}
                className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border ${
                  active
                    ? 'bg-teal text-white border-teal'
                    : 'border-white/15 text-white/40 hover:bg-white/5'
                }`}
              >
                <Ico size={18} />
              </button>
            )
          })}
        </div>
      </div>

      {viewMode === 'map' ? (
        /* Map fills the middle region and manages its own gestures. */
        <div className="flex-1 min-h-0">
          <DayMap items={allDayItems} day={day} cats={cats} />
        </div>
      ) : (
        /* Items (only this region scrolls vertically) */
        <SwipeDeck
          trackRef={swipe.trackRef}
          className="flex-1 min-h-0"
          cellClassName="h-full overflow-y-auto touch-pan-y px-4 pb-4 space-y-2"
          previous={prevDay && itemList(prevDay)}
          next={nextDay && itemList(nextDay)}
        >
          {itemList(day)}
        </SwipeDeck>
      )}

      {/* Bottom bar (fixed, does not scroll) */}
      <div className="shrink-0 border-t border-white/10 bg-black">
        <div className="flex items-center justify-between px-6 pt-3 safe-bottom">
          <button
            onClick={onBack}
            className="flex flex-col items-center gap-1 text-xs text-white hover:text-teal"
          >
            <HomeIcon size={22} />
            Trips
          </button>
          {canEdit && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setImporting(true)}
                className="flex flex-col items-center gap-1 text-xs text-white hover:text-teal"
              >
                <Sparkles size={22} />
                Import
              </button>
              <button
                onClick={() => startAdd(day)}
                className="w-14 h-14 -mt-6 rounded-full bg-teal hover:bg-teal-deep flex items-center justify-center shadow-lg"
              >
                <Plus size={28} />
              </button>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <ItemForm
          calendarId={trip.id}
          trip={trip}
          itineraryItems={items}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            // Keep the current day when the saved item still belongs on it
            // (e.g. editing an arrival leg while viewing the arrival day).
            if (itemAffectsDay(saved, day)) return
            if (saved.date) setSelectedDay(saved.date)
          }}
        />
      )}
      {importing && (
        <ImportModal
          calendarId={trip.id}
          trip={trip}
          day={day}
          onClose={() => setImporting(false)}
          onImported={(saved) => {
            setImporting(false)
            // Jump to the earliest imported day so the new items are visible
            // (they usually span multiple days beyond the current selection).
            const first = saved
              .map((s) => s.date)
              .filter(Boolean)
              .sort()[0]
            if (first) setSelectedDay(first)
          }}
        />
      )}
    </div>
  )
}

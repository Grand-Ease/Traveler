import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
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
import { addDays, eachDay, weekdayLong } from '../lib/format'
import { activePlaceIndex, placesForDay, refTimeForDay, setDayPlaces } from '../lib/locations'
import * as store from '../store/store'
import { useItems, useTrip } from '../store/hooks'
import { TYPE_ICONS } from './icons'
import DayMap, { type MapCat } from './DayMap'
import ItemCard from './ItemCard'
import ItemForm from './ItemForm'
import ImportModal from './ImportModal'
import DayLocations from './DayLocations'
import DayWeather from './DayWeather'
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

type Leg = 'departure' | 'arrival'
interface ListEntry {
  key: string
  item: ItineraryItem
  leg?: Leg
  time?: string
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
  const days = useMemo(() => {
    const set = new Set<string>()
    if (trip.startDate && trip.endDate)
      for (const d of eachDay(trip.startDate, trip.endDate)) set.add(d)
    for (const it of items) {
      if (it.date) set.add(it.date)
    }
    const arr = [...set].sort()
    return arr.length ? arr : [trip.startDate || new Date().toISOString().slice(0, 10)]
  }, [items, trip.startDate, trip.endDate])

  // Which items appear on a given day (lodging spans its nights).
  function itemsOnDay(day: string): ItineraryItem[] {
    return items.filter((it) => {
      if (it.type === 'lodging') {
        const nights = Math.max(1, it.nights || 1)
        return day >= it.date && day < addDays(it.date, nights)
      }
      return it.date === day
    })
  }

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

  // The day's active destination (used for the header weather lookup).
  const dayPlaces = placesForDay(trip, day).places
  const activePlaceName = dayPlaces[activePlaceIndex(dayPlaces, refTimeForDay(day))]?.name

  // The whole day's items (the map uses these; it applies `cats` itself).
  const allDayItems = useMemo(
    () => itemsOnDay(day),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, day],
  )

  // List entries mirror the map: a travel item is split into a departure leg
  // (on its departure day) and an arrival leg (on its arrival day); everything
  // else is a single entry. The category chips toggle each leg/type on and off.
  const listEntries = useMemo<ListEntry[]>(() => {
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
        const nights = Math.max(1, it.nights || 1)
        if (day >= it.date && day < addDays(it.date, nights))
          out.push({ key: it.id || `${it.date}-${it.title}`, item: it, time: it.startTime })
      } else if (cats[it.type as MapCat] && it.date === day) {
        out.push({ key: it.id || `${it.date}-${it.title}`, item: it, time: it.startTime })
      }
    }
    out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
    return out
  }, [items, day, cats])

  function removeItem(it: ItineraryItem) {
    if (!it.id) return
    if (!confirm(`Delete “${it.title}”?`)) return
    store.deleteItem(trip.id, it.id)
  }

  function saveDayPlaces(places: DayPlace[]) {
    store.updateTrip({ ...trip, locations: setDayPlaces(trip, day, places) })
  }

  const goPrev = () => setSelectedDay(days[Math.max(0, dayIndex - 1)])
  const goNext = () => setSelectedDay(days[Math.min(days.length - 1, dayIndex + 1)])

  // Horizontal swipe anywhere on the screen navigates days.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current
    touchStart.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // Require a clearly horizontal swipe so vertical scrolling isn't hijacked.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) goNext()
    else goPrev()
  }

  function startAdd() {
    // New items default to an activity at noon with a +1h end; the type can be
    // changed in the form.
    setEditing({
      type: 'activity',
      title: '',
      date: day,
      startTime: '12:00',
      endTime: '13:00',
    })
  }

  const totalDay = itemsOnDay(day).length

  return (
    <div
      className="flex flex-col h-full max-w-2xl mx-auto w-full"
      // Scope day-swipe to list mode so the map keeps full control of its own
      // drag/zoom gestures.
      onTouchStart={viewMode === 'list' ? onTouchStart : undefined}
      onTouchEnd={viewMode === 'list' ? onTouchEnd : undefined}
    >
      {/* Header (fixed, does not scroll) */}
      <div className="shrink-0">
        <div className="px-4 safe-top">
          <div className="flex justify-end mb-1">
            <SyncBadge />
          </div>
          <div className="bg-headerCard border border-white/20 rounded-2xl p-4">
            <DayLocations trip={trip} day={day} canEdit={canEdit} onSave={saveDayPlaces} />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={goPrev}
                disabled={dayIndex === 0}
                className="p-1 disabled:opacity-30"
              >
                <ChevronLeft size={22} />
              </button>
              <div className="text-center">
                <h1 className="text-xl font-bold">{weekdayLong(day)}</h1>
                <p className="text-white/50 text-xs mt-1">
                  {trip.name} · Day {dayIndex + 1} of {days.length} · {totalDay} item
                  {totalDay === 1 ? '' : 's'}
                </p>
                <DayWeather place={activePlaceName} date={day} />
              </div>
              <button
                onClick={goNext}
                disabled={dayIndex >= days.length - 1}
                className="p-1 disabled:opacity-30"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* Mode toggle (segmented) + shared category filters */}
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto">
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
          <DayMap items={allDayItems} cats={cats} />
        </div>
      ) : (
        /* Items (only this region scrolls vertically) */
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {listEntries.length === 0 && (
            <div className="text-center py-16 text-white/40">
              <p>
                {allDayItems.length
                  ? 'No items match the selected filters.'
                  : 'Nothing planned for this day.'}
              </p>
              {canEdit && (
                <button className="btn-primary mt-4" onClick={startAdd}>
                  Add something
                </button>
              )}
            </div>
          )}
          {listEntries.map((entry) => (
            <ItemCard
              key={entry.key}
              item={entry.item}
              leg={entry.leg}
              canEdit={canEdit}
              onEdit={() => setEditing(entry.item)}
              onDelete={() => removeItem(entry.item)}
            />
          ))}
        </div>
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
                onClick={startAdd}
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
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            // Stay on the day the item lives on (usually the current day).
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
          onImported={() => setImporting(false)}
        />
      )}
    </div>
  )
}

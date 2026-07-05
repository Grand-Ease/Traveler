import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  ListChecks,
  Map as MapIcon,
  Plus,
  Sparkles,
} from 'lucide-react'
import type { DayPlace, ItineraryItem, ItemType, Trip } from '../types'
import { addDays, eachDay, TYPE_LABEL, weekdayLong } from '../lib/format'
import { directionsUrl } from '../lib/mapLinks'
import { setDayPlaces } from '../lib/locations'
import * as store from '../store/store'
import { useItems, useTrip } from '../store/hooks'
import { TYPE_ICONS } from './icons'
import ItemCard from './ItemCard'
import ItemForm from './ItemForm'
import ImportModal from './ImportModal'
import DayLocations from './DayLocations'
import SyncBadge from './SyncBadge'

interface Props {
  trip: Trip
  onBack: () => void
}

type Filter = 'all' | ItemType
const FILTERS: Filter[] = ['all', 'travel', 'lodging', 'dining', 'activity', 'note']

export default function TripDetail({ trip: tripProp, onBack }: Props) {
  const trip = useTrip(tripProp)
  const items = useItems(trip.id)
  const [filter, setFilter] = useState<Filter>('all')
  const [dayIndex, setDayIndex] = useState(0)
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
    // Jump to today if it's within the trip, else first day.
    const today = new Date().toISOString().slice(0, 10)
    const idx = days.indexOf(today)
    setDayIndex(idx >= 0 ? idx : 0)
  }, [days])

  const day = days[Math.min(dayIndex, days.length - 1)]
  const dayItems = itemsOnDay(day)
    .filter((it) => filter === 'all' || it.type === filter)
    .sort((a, b) => (a.startTime || '99').localeCompare(b.startTime || '99'))

  // Ordered, deduped list of mappable addresses for the whole current day.
  const mapStops = useMemo(() => {
    const ordered = itemsOnDay(day).sort((a, b) =>
      (a.startTime || '99').localeCompare(b.startTime || '99'),
    )
    const addresses: string[] = []
    for (const it of ordered) {
      const raw =
        it.type === 'travel' ? it.to || it.location || it.from : it.location
      const addr = (raw || '').trim()
      if (!addr) continue
      // Collapse consecutive duplicates.
      if (addresses[addresses.length - 1] === addr) continue
      addresses.push(addr)
    }
    return addresses
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, day])

  function removeItem(it: ItineraryItem) {
    if (!it.id) return
    if (!confirm(`Delete “${it.title}”?`)) return
    store.deleteItem(trip.id, it.id)
  }

  function saveDayPlaces(places: DayPlace[]) {
    store.updateTrip({ ...trip, locations: setDayPlaces(trip, day, places) })
  }

  function openMap() {
    const url = directionsUrl(mapStops)
    if (url) window.open(url, '_blank', 'noopener')
  }

  const goPrev = () => setDayIndex((i) => Math.max(0, i - 1))
  const goNext = () => setDayIndex((i) => Math.min(days.length - 1, i + 1))

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
    const type: ItemType = filter === 'all' ? 'activity' : filter
    // Default new items to noon; give types with an end field a +1h default.
    const hasEnd = type !== 'note' && type !== 'lodging'
    setEditing({
      type,
      title: '',
      date: day,
      startTime: '12:00',
      ...(hasEnd ? { endTime: '13:00' } : {}),
    })
  }

  const totalDay = itemsOnDay(day).length

  return (
    <div
      className="flex flex-col h-full max-w-2xl mx-auto w-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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

        {/* Category filter (icon-only) */}
        <div className="flex gap-2 px-4 py-3">
          {FILTERS.map((f) => {
            const active = filter === f
            const Ico = f === 'all' ? ListChecks : TYPE_ICONS[f]
            const label = f === 'all' ? 'All' : TYPE_LABEL[f]
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-label={label}
                title={label}
                className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border ${
                  active
                    ? 'bg-teal text-white border-teal'
                    : 'border-white/15 text-white/60 hover:bg-white/5'
                }`}
              >
                <Ico size={18} />
              </button>
            )
          })}
          {(() => {
            const hasStops = mapStops.length > 0
            return (
              <button
                onClick={openMap}
                disabled={!hasStops}
                aria-label="Map day's stops"
                title={hasStops ? "Map day's stops" : 'No locations to map today'}
                className={`shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full border border-white/10 text-white/70 hover:bg-white/5 ${
                  hasStops ? '' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <MapIcon size={18} />
              </button>
            )
          })()}
        </div>
      </div>

      {/* Items (only this region scrolls vertically) */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {dayItems.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p>Nothing planned{filter === 'all' ? '' : ` for ${TYPE_LABEL[filter as ItemType]}`} on this day.</p>
            {canEdit && (
              <button className="btn-primary mt-4" onClick={startAdd}>
                Add something
              </button>
            )}
          </div>
        )}
        {dayItems.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            canEdit={canEdit}
            onEdit={() => setEditing(it)}
            onDelete={() => removeItem(it)}
          />
        ))}
      </div>

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
            if (saved.date) {
              const idx = days.indexOf(saved.date)
              if (idx >= 0) setDayIndex(idx)
            }
          }}
        />
      )}
      {importing && (
        <ImportModal
          calendarId={trip.id}
          onClose={() => setImporting(false)}
          onImported={() => setImporting(false)}
        />
      )}
    </div>
  )
}

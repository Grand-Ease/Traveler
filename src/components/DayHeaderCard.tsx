import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DayPlace, ItineraryItem, Trip } from '../types'
import { weekdayLong } from '../lib/format'
import { itemAffectsDay } from '../lib/itineraryDay'
import { activePlaceIndex, effectivePlacesForDay, refTimeForDay } from '../lib/locations'
import { enrichPlaceTimezones } from '../lib/geo'
import DayLocations from './DayLocations'
import DayWeather from './DayWeather'

interface Props {
  trip: Trip
  items: ItineraryItem[]
  day: string
  dayIndex: number
  dayCount: number
  canEdit: boolean
  onPrev: () => void
  onNext: () => void
  onSavePlaces: (day: string, places: DayPlace[]) => void
}

/**
 * One day's header: its destination(s), title and forecast. Everything here is
 * derived from `day` alone, so the deck can mount a card per visible day.
 */
export default function DayHeaderCard({
  trip,
  items,
  day,
  dayIndex,
  dayCount,
  canEdit,
  onPrev,
  onNext,
  onSavePlaces,
}: Props) {
  const effective = useMemo(
    () => effectivePlacesForDay(trip, items, day),
    [trip, items, day],
  )
  const [places, setPlaces] = useState(effective.places)

  // Dynamic places are transient; enrich their missing timezones through the
  // geocoding cache without persisting them into trip.locations.
  useEffect(() => {
    let cancelled = false
    setPlaces(effective.places)
    if (effective.source === 'explicit') return
    void enrichPlaceTimezones(effective.places).then((enriched) => {
      if (!cancelled) setPlaces(enriched)
    })
    return () => {
      cancelled = true
    }
  }, [effective])

  // The day's active destination drives the weather lookup.
  const activePlace = places[activePlaceIndex(places, refTimeForDay(day))]?.name
  const total = items.filter((item) => itemAffectsDay(item, day)).length

  return (
    <div className="bg-headerCard border border-white/20 rounded-2xl p-4">
      <DayLocations
        places={places}
        source={effective.source}
        day={day}
        canEdit={canEdit}
        onSave={(next) => onSavePlaces(day, next)}
      />
      <div className="flex items-center justify-between mt-2">
        <button
          onClick={onPrev}
          disabled={dayIndex === 0}
          aria-label="Previous day"
          className="p-1 disabled:opacity-30"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{weekdayLong(day)}</h1>
          <p className="text-white/50 text-xs mt-1">
            {trip.name} · Day {dayIndex + 1} of {dayCount} · {total} item
            {total === 1 ? '' : 's'}
          </p>
          <DayWeather place={activePlace} date={day} />
        </div>
        <button
          onClick={onNext}
          disabled={dayIndex >= dayCount - 1}
          aria-label="Next day"
          className="p-1 disabled:opacity-30"
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  )
}

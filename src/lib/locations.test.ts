import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Trip } from '../types'
import {
  effectivePlacesForDay,
  setDayPlaces,
} from './locations'

const trip = (locations: Trip['locations'] = []): Trip => ({
  id: 'trip',
  name: 'Test trip',
  startDate: '2026-07-01',
  endDate: '2026-07-10',
  accessRole: 'owner',
  locations,
})

const travel = (overrides: Partial<ItineraryItem> = {}): ItineraryItem => ({
  type: 'travel',
  title: 'Travel',
  date: '2026-07-01',
  startTime: '08:00',
  endTime: '10:00',
  from: 'Paris',
  to: 'London',
  ...overrides,
})

describe('effective day locations', () => {
  it('gives an explicit override precedence over itinerary-derived places', () => {
    const result = effectivePlacesForDay(
      trip([{ date: '2026-07-01', places: [{ time: '00:00', name: 'Rome' }] }]),
      [travel()],
      '2026-07-01',
    )

    expect(result).toMatchObject({
      source: 'explicit',
      places: [{ time: '00:00', name: 'Rome' }],
    })
  })

  it('returns to dynamic derivation when an explicit override is cleared', () => {
    const original = trip([
      { date: '2026-07-01', places: [{ time: '00:00', name: 'Rome' }] },
    ])
    const cleared = { ...original, locations: setDayPlaces(original, '2026-07-01', []) }

    expect(effectivePlacesForDay(cleared, [travel()], '2026-07-01')).toMatchObject({
      source: 'derived',
      places: [
        { time: '00:00', name: 'Paris' },
        { time: '10:00', name: 'London' },
      ],
    })
  })

  it('builds a same-day timeline from the first origin and arrivals', () => {
    expect(effectivePlacesForDay(trip(), [travel()], '2026-07-01')).toMatchObject({
      source: 'derived',
      places: [
        { time: '00:00', name: 'Paris' },
        { time: '10:00', name: 'London' },
      ],
    })
  })

  it('puts an overnight travel destination on its arrival day', () => {
    const item = travel({
      date: '2026-07-01',
      endDate: '2026-07-02',
      startTime: '22:00',
      endTime: '07:30',
    })

    expect(effectivePlacesForDay(trip(), [item], '2026-07-02')).toMatchObject({
      source: 'derived',
      places: [
        { time: '00:00', name: 'Paris' },
        { time: '07:30', name: 'London' },
      ],
    })
  })

  it('uses active lodging as a baseline unless travel establishes it later', () => {
    const lodging: ItineraryItem = {
      type: 'lodging',
      title: 'Hotel',
      date: '2026-07-01',
      nights: 2,
      location: 'London',
    }

    expect(effectivePlacesForDay(trip(), [lodging], '2026-07-01')).toMatchObject({
      source: 'derived',
      places: [{ time: '00:00', name: 'London' }],
    })
    expect(effectivePlacesForDay(trip(), [lodging, travel()], '2026-07-01').places).toEqual([
      { time: '00:00', name: 'Paris' },
      { time: '10:00', name: 'London' },
    ])
  })

  it('inherits the previous final effective location on an otherwise empty day', () => {
    expect(effectivePlacesForDay(trip(), [travel()], '2026-07-02')).toMatchObject({
      source: 'inherited',
      inherited: true,
      places: [{ time: '00:00', name: 'London' }],
    })
  })

  it('deduplicates consecutive equivalent locations', () => {
    const items = [
      travel({ to: ' london ' }),
      travel({
        startTime: '11:00',
        endTime: '13:00',
        from: 'London',
        to: 'LONDON',
      }),
    ]

    expect(effectivePlacesForDay(trip(), items, '2026-07-01').places).toEqual([
      { time: '00:00', name: 'Paris' },
      { time: '10:00', name: 'london' },
    ])
  })

  it('limits generated timelines to three places while preserving the final place', () => {
    const items = [
      travel({ endTime: '09:00', to: 'A' }),
      travel({ startTime: '09:30', endTime: '11:00', from: 'A', to: 'B' }),
      travel({ startTime: '12:00', endTime: '14:00', from: 'B', to: 'C' }),
    ]

    expect(effectivePlacesForDay(trip(), items, '2026-07-01').places).toEqual([
      { time: '00:00', name: 'Paris' },
      { time: '09:00', name: 'A' },
      { time: '14:00', name: 'C' },
    ])
  })
})

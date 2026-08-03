import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Trip } from '../types'
import {
  itemAffectsDay,
  lodgingStartsDay,
  sortTimeForDay,
  stayPhase,
  tripDays,
} from './itineraryDay'

const hotel = (): ItineraryItem => ({
  type: 'lodging',
  title: 'Hotel',
  date: '2026-07-01',
  nights: 2,
  startTime: '15:00',
  location: 'London',
})

const trip = (): Trip => ({
  id: 'trip',
  name: 'Test trip',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  accessRole: 'owner',
})

describe('itemAffectsDay', () => {
  it('includes travel on both departure and arrival days', () => {
    const item: ItineraryItem = {
      type: 'travel',
      title: 'Flight',
      date: '2026-07-01',
      endDate: '2026-07-02',
    }

    expect(itemAffectsDay(item, '2026-07-01')).toBe(true)
    expect(itemAffectsDay(item, '2026-07-02')).toBe(true)
    expect(itemAffectsDay(item, '2026-07-03')).toBe(false)
  })

  it('spans lodging across its nights and the checkout morning', () => {
    const item = hotel()

    expect(itemAffectsDay(item, '2026-06-30')).toBe(false)
    expect(itemAffectsDay(item, '2026-07-01')).toBe(true)
    expect(itemAffectsDay(item, '2026-07-02')).toBe(true)
    // You wake up here and leave, so the day still starts at the hotel.
    expect(itemAffectsDay(item, '2026-07-03')).toBe(true)
    expect(itemAffectsDay(item, '2026-07-04')).toBe(false)
  })

  it('matches single-day items only on their date', () => {
    const item: ItineraryItem = {
      type: 'activity',
      title: 'Museum',
      date: '2026-07-02',
    }

    expect(itemAffectsDay(item, '2026-07-01')).toBe(false)
    expect(itemAffectsDay(item, '2026-07-02')).toBe(true)
  })
})

describe('lodging day phases', () => {
  it('treats every day after check-in as starting at the hotel', () => {
    const item = hotel()

    expect(lodgingStartsDay(item, '2026-07-01')).toBe(false)
    expect(lodgingStartsDay(item, '2026-07-02')).toBe(true)
    expect(lodgingStartsDay(item, '2026-07-03')).toBe(true)
    expect(lodgingStartsDay(item, '2026-07-04')).toBe(false)
  })

  it('names the phase of the stay', () => {
    const item = hotel()

    expect(stayPhase(item, '2026-07-01')).toBe('checkin')
    expect(stayPhase(item, '2026-07-02')).toBe('staying')
    expect(stayPhase(item, '2026-07-03')).toBe('checkout')
  })

  it('sorts a continuing stay to the start of the day', () => {
    const item = hotel()

    // Check-in day keeps the arrival time, so it slots in where it belongs.
    expect(sortTimeForDay(item, '2026-07-01')).toBe('15:00')
    expect(sortTimeForDay(item, '2026-07-02')).toBe('00:00')
    expect(sortTimeForDay(item, '2026-07-03')).toBe('00:00')
  })

  it('defaults a single night and orders other items by start time', () => {
    const oneNight: ItineraryItem = { type: 'lodging', title: 'Inn', date: '2026-07-01' }
    expect(itemAffectsDay(oneNight, '2026-07-02')).toBe(true)
    expect(itemAffectsDay(oneNight, '2026-07-03')).toBe(false)

    const museum: ItineraryItem = {
      type: 'activity',
      title: 'Museum',
      date: '2026-07-02',
      startTime: '09:00',
    }
    expect(sortTimeForDay(museum, '2026-07-02')).toBe('09:00')
    // An untimed item still sorts last.
    expect(sortTimeForDay({ ...museum, startTime: undefined }, '2026-07-02')).toBe('99')
  })
})

describe('tripDays', () => {
  it('includes cross-day travel arrival dates outside the trip range', () => {
    const days = tripDays(trip(), [
      {
        type: 'travel',
        title: 'Flight',
        date: '2026-07-03',
        endDate: '2026-07-05',
      },
    ])

    expect(days).toContain('2026-07-05')
  })
})

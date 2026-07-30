import { describe, expect, it } from 'vitest'
import type { ItineraryItem, Trip } from '../types'
import { itemAffectsDay, tripDays } from './itineraryDay'

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

  it('spans lodging across its nights', () => {
    const item: ItineraryItem = {
      type: 'lodging',
      title: 'Hotel',
      date: '2026-07-01',
      nights: 2,
      location: 'London',
    }

    expect(itemAffectsDay(item, '2026-07-01')).toBe(true)
    expect(itemAffectsDay(item, '2026-07-02')).toBe(true)
    expect(itemAffectsDay(item, '2026-07-03')).toBe(false)
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

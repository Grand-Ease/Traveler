import { describe, expect, it } from 'vitest'
import { isPlaceableTitle } from './geo'

describe('isPlaceableTitle', () => {
  it('accepts titles naming a specific venue', () => {
    expect(isPlaceableTitle('Café de Flore')).toBe(true)
    expect(isPlaceableTitle('Hotel Le Meurice')).toBe(true)
    expect(isPlaceableTitle('Musée d’Orsay')).toBe(true)
    expect(isPlaceableTitle('Eiffel Tower')).toBe(true)
    expect(isPlaceableTitle('Dinner at Septime')).toBe(true)
  })

  it('rejects titles that only describe an activity', () => {
    expect(isPlaceableTitle('Dinner')).toBe(false)
    expect(isPlaceableTitle('Free time')).toBe(false)
    expect(isPlaceableTitle('Check out of the hotel')).toBe(false)
    expect(isPlaceableTitle('Morning coffee')).toBe(false)
    expect(isPlaceableTitle('Museum visit')).toBe(false)
  })

  it('rejects empty and punctuation-only titles', () => {
    expect(isPlaceableTitle('')).toBe(false)
    expect(isPlaceableTitle('   ')).toBe(false)
    expect(isPlaceableTitle('— ???')).toBe(false)
  })

  it('ignores words too short to identify a place', () => {
    expect(isPlaceableTitle('Go to it')).toBe(false)
  })
})

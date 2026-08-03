import { describe, expect, it } from 'vitest'
import { dampedOffset, releaseVelocity, resolveSwipe } from './swipeGesture'

/** A day panel one phone wide, sitting in the middle of a five-day trip. */
const WIDTH = 400
const release = (offset: number, velocity: number, index = 2, count = 5) =>
  resolveSwipe({ offset, velocity, width: WIDTH, index, count })

describe('releaseVelocity', () => {
  it('is zero without at least two samples', () => {
    expect(releaseVelocity([])).toBe(0)
    expect(releaseVelocity([{ x: 10, t: 0 }])).toBe(0)
  })

  it('measures px per millisecond, signed by direction', () => {
    expect(releaseVelocity([{ x: 0, t: 0 }, { x: 100, t: 100 }])).toBe(1)
    expect(releaseVelocity([{ x: 100, t: 0 }, { x: 0, t: 100 }])).toBe(-1)
  })

  it('reads a finger that stopped before lifting as a slow release', () => {
    const samples = [
      { x: 0, t: 0 },
      { x: 200, t: 50 },
      { x: 200, t: 400 },
    ]

    expect(releaseVelocity(samples)).toBe(0)
  })

  it('ignores samples older than the velocity window', () => {
    const samples = [
      { x: 0, t: 0 }, // outside the 100ms window, so it must not count
      { x: 50, t: 200 },
      { x: 100, t: 250 },
    ]

    expect(releaseVelocity(samples)).toBe(1)
  })
})

describe('dampedOffset', () => {
  it('follows the finger exactly between days', () => {
    expect(dampedOffset(120, 2, 5)).toBe(120)
    expect(dampedOffset(-120, 2, 5)).toBe(-120)
  })

  it('damps dragging off either end of the trip', () => {
    expect(dampedOffset(100, 0, 5)).toBeCloseTo(30)
    expect(dampedOffset(-100, 4, 5)).toBeCloseTo(-30)
  })

  it('still follows the finger when dragging back inside the trip', () => {
    expect(dampedOffset(-100, 0, 5)).toBe(-100)
    expect(dampedOffset(100, 4, 5)).toBe(100)
  })
})

describe('resolveSwipe', () => {
  it('commits a flick that barely moved', () => {
    const outcome = release(-60, -3)

    expect(outcome.target).toBe(3)
    expect(outcome.offset).toBe(-WIDTH)
  })

  it('lands a hard flick almost immediately', () => {
    expect(release(-60, -3).duration).toBe(120)
  })

  it('eases a slow drag across at its own pace', () => {
    const outcome = release(-200, -0.02)

    expect(outcome.target).toBe(3)
    expect(outcome.duration).toBe(320)
  })

  it('snaps back a slow drag that never crossed the threshold', () => {
    const outcome = release(-100, -0.02)

    expect(outcome.target).toBe(2)
    expect(outcome.offset).toBe(0)
    expect(outcome.duration).toBe(200)
  })

  it('reads a rightward drag as the previous day', () => {
    const outcome = release(200, 0.02)

    expect(outcome.target).toBe(1)
    expect(outcome.offset).toBe(WIDTH)
  })

  it('snaps back at the ends of the trip however hard it is flicked', () => {
    expect(release(-60, -3, 4, 5).target).toBe(4)
    expect(release(60, 3, 0, 5).target).toBe(0)
  })

  it('snaps back before the panel has been measured', () => {
    const outcome = resolveSwipe({
      offset: -300,
      velocity: -3,
      width: 0,
      index: 2,
      count: 5,
    })

    expect(outcome.target).toBe(2)
    expect(outcome.offset).toBe(0)
  })

  it('settles instantly when there is nothing to undo', () => {
    expect(release(0, 0).duration).toBe(0)
  })
})

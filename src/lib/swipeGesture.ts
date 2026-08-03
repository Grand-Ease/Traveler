// Pure maths behind the day-to-day swipe. Kept out of the React hook so the
// thresholds that decide "did that flick count?" can be tested directly.

/** Past this speed (px/ms) a flick commits however far it actually travelled. */
export const FLING_VELOCITY = 0.35
/** Slower drags instead have to cross this fraction of the panel width. */
export const COMMIT_FRACTION = 0.35
/** Slop allowed before the gesture locks to an axis. */
export const AXIS_LOCK_PX = 8
/** Dragging beyond the first/last day is damped rather than blocked outright. */
export const EDGE_RESISTANCE = 0.3
/** Release speed is measured over the tail of the drag, not its whole length,
 *  so pausing before lifting a finger reads as a slow release. */
export const VELOCITY_WINDOW_MS = 100

const MIN_SETTLE_MS = 120
const MAX_SETTLE_MS = 320
const SNAP_BACK_MS = 200

export interface Sample {
  x: number
  t: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Release speed in px/ms, positive when the finger was moving right. Measured
 * over the tail of the gesture so a long slow drag that stops before lift-off
 * reports ~0 rather than its average speed.
 */
export function releaseVelocity(samples: Sample[]): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  const since = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? samples[0]
  if (since === last) return 0
  return (last.x - since.x) / Math.max(1, last.t - since.t)
}

/**
 * How far the track should follow a finger that has moved `dx`. Movement into a
 * day that exists is followed exactly; movement off either end is damped, so
 * the edge of the trip is felt rather than hit.
 */
export function dampedOffset(dx: number, index: number, count: number): number {
  const beyondStart = dx > 0 && index === 0
  const beyondEnd = dx < 0 && index >= count - 1
  return beyondStart || beyondEnd ? dx * EDGE_RESISTANCE : dx
}

export interface SwipeRelease {
  /** Signed drag distance in px at release, already damped. */
  offset: number
  /** Release speed in px/ms; positive means the finger moved right. */
  velocity: number
  /** Width of one day panel in px. */
  width: number
  index: number
  count: number
}

export interface SwipeOutcome {
  /** Day to land on. Equals `index` when the drag snaps back. */
  target: number
  /** Where the track has to end up, in px. */
  offset: number
  /** How long the settle should take, in ms. */
  duration: number
}

/**
 * Decide where a released drag lands. A flick past FLING_VELOCITY commits on
 * speed alone; anything slower has to have dragged far enough. The settle
 * inherits the finger's speed, so a hard flick finishes almost immediately
 * while a slow drag eases the rest of the way across.
 */
export function resolveSwipe({
  offset,
  velocity,
  width,
  index,
  count,
}: SwipeRelease): SwipeOutcome {
  const snapBack: SwipeOutcome = {
    target: index,
    offset: 0,
    duration: offset === 0 ? 0 : SNAP_BACK_MS,
  }
  if (!width) return snapBack

  // A negative offset drags the next day into view, a positive one the previous.
  let direction = 0
  if (Math.abs(velocity) >= FLING_VELOCITY) direction = velocity < 0 ? 1 : -1
  else if (Math.abs(offset) > width * COMMIT_FRACTION) direction = offset < 0 ? 1 : -1

  const target = index + direction
  if (!direction || target < 0 || target >= count) return snapBack

  const remaining = Math.max(0, width - Math.abs(offset))
  const speed = Math.abs(velocity)
  return {
    target,
    offset: -direction * width,
    duration: clamp(
      speed > 0.05 ? remaining / speed : MAX_SETTLE_MS,
      MIN_SETTLE_MS,
      MAX_SETTLE_MS,
    ),
  }
}

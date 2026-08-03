import { useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import {
  AXIS_LOCK_PX,
  dampedOffset,
  releaseVelocity,
  resolveSwipe,
  type Sample,
} from '../lib/swipeGesture'

/** Samples kept for the release-velocity estimate (~130ms at 60fps). */
const MAX_SAMPLES = 8
const BUTTON_SLIDE_MS = 260
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)'

interface Options {
  /** Index of the day currently centred. */
  index: number
  /** Total number of days. */
  count: number
  /** Whether neighbouring days are mounted. When false, navigation jumps. */
  enabled: boolean
  onCommit: (index: number) => void
}

export interface DaySwipe {
  /** The element the gesture listens on, and whose width one day spans. */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Attach to every track that should move as one. */
  trackRef: (el: HTMLElement | null) => (() => void) | void
  /** Move one day, animated when possible. */
  slide: (direction: -1 | 1) => void
}

interface Drag {
  startX: number
  startY: number
  axis: 'none' | 'x'
  offset: number
  samples: Sample[]
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Drives a day-to-day carousel: the tracks follow the finger during a drag and
 * then settle at a speed inherited from the flick.
 */
export function useDaySwipe({ index, count, enabled, onCommit }: Options): DaySwipe {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tracks = useRef(new Set<HTMLElement>())
  const drag = useRef<Drag | null>(null)
  const animating = useRef(false)
  const timer = useRef(0)

  // Touch listeners are bound once, so they read their options through a ref.
  const latest = useRef({ index, count, enabled, onCommit })
  latest.current = { index, count, enabled, onCommit }

  const trackRef = useCallback((el: HTMLElement | null) => {
    if (!el) return
    tracks.current.add(el)
    return () => {
      tracks.current.delete(el)
    }
  }, [])

  const move = useCallback((offset: number, transition: string) => {
    for (const el of tracks.current) {
      el.style.transition = transition
      el.style.willChange = 'transform'
      el.style.transform = `translate3d(${offset}px, 0, 0)`
    }
  }, [])

  /** Drop every trace of the gesture so the centre day sits at rest. */
  const rest = useCallback(() => {
    for (const el of tracks.current) {
      // Clear the transition first, or removing the transform would animate it.
      el.style.transition = 'none'
      el.style.transform = ''
      el.style.willChange = ''
    }
    // Flush the reset so a subsequent transition starts from this position.
    void containerRef.current?.offsetHeight
  }, [])

  const commit = useCallback(
    (target: number) => {
      // Swap the day and drop the transform within one task, so the browser
      // paints the new day already centred instead of flashing it in.
      flushSync(() => latest.current.onCommit(target))
      rest()
    },
    [rest],
  )

  const settle = useCallback(
    (offset: number, duration: number, done: () => void) => {
      if (!duration) {
        done()
        return
      }
      animating.current = true
      move(offset, `transform ${duration}ms ${EASE}`)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        animating.current = false
        done()
      }, duration)
    },
    [move],
  )

  const slide = useCallback(
    (direction: -1 | 1) => {
      const { index: from, count: total, enabled: canAnimate } = latest.current
      const target = from + direction
      if (animating.current || drag.current || target < 0 || target >= total) return
      const width = containerRef.current?.clientWidth || 0
      if (!canAnimate || !width || prefersReducedMotion()) {
        latest.current.onCommit(target)
        return
      }
      settle(-direction * width, BUTTON_SLIDE_MS, () => commit(target))
    },
    [commit, settle],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onTouchStart(e: TouchEvent) {
      if (!latest.current.enabled || animating.current || e.touches.length !== 1) return
      const touch = e.touches[0]
      // Regions that pan horizontally themselves opt out of the day gesture.
      if ((touch.target as Element | null)?.closest?.('[data-no-day-swipe]')) return
      drag.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        axis: 'none',
        offset: 0,
        samples: [{ x: touch.clientX, t: e.timeStamp }],
      }
    }

    function onTouchMove(e: TouchEvent) {
      const d = drag.current
      if (!d) return
      // A second finger means a pinch; hand the gesture back to the browser.
      if (e.touches.length !== 1) {
        drag.current = null
        rest()
        return
      }
      const touch = e.touches[0]
      const dx = touch.clientX - d.startX
      const dy = touch.clientY - d.startY

      if (d.axis === 'none') {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
        // A vertical intent ends the gesture and leaves the list scrolling.
        if (Math.abs(dy) >= Math.abs(dx)) {
          drag.current = null
          return
        }
        d.axis = 'x'
      }

      // Non-passive listener: this is what stops the page scrolling underneath.
      e.preventDefault()
      d.samples.push({ x: touch.clientX, t: e.timeStamp })
      if (d.samples.length > MAX_SAMPLES) d.samples.shift()

      const { index: at, count: total } = latest.current
      d.offset = dampedOffset(dx, at, total)
      move(d.offset, 'none')
    }

    function onTouchEnd() {
      const d = drag.current
      drag.current = null
      if (!d || d.axis !== 'x') return

      const { index: at, count: total } = latest.current
      const outcome = resolveSwipe({
        offset: d.offset,
        velocity: releaseVelocity(d.samples),
        width: container?.clientWidth || 0,
        index: at,
        count: total,
      })

      const landed = outcome.target !== at
      const duration = prefersReducedMotion() ? 0 : outcome.duration
      settle(outcome.offset, duration, landed ? () => commit(outcome.target) : rest)
    }

    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)
    container.addEventListener('touchcancel', onTouchEnd)
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
      container.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [commit, move, rest, settle])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // The day can also change from outside the deck (saving or importing an item
  // jumps to its date); make sure no stale drag offset survives that.
  useEffect(() => {
    if (!animating.current && !drag.current) rest()
  }, [index, rest])

  return { containerRef, trackRef, slide }
}

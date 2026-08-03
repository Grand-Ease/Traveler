import type { ReactNode } from 'react'

interface Props {
  /** From useDaySwipe; every deck sharing it moves in lockstep. */
  trackRef: (el: HTMLElement | null) => (() => void) | void
  /** Classes for the clipping viewport. */
  className?: string
  /** Classes shared by all three cells. */
  cellClassName?: string
  previous?: ReactNode
  next?: ReactNode
  children: ReactNode
}

/**
 * Three days side by side, moved as one by the shared track ref. Only the
 * centre cell takes part in layout — the neighbours hang off either edge — so a
 * taller or shorter neighbouring day never resizes the viewport. Neighbours are
 * inert: they stay out of the tab order and the accessibility tree until a
 * swipe promotes one of them to the centre.
 */
export default function SwipeDeck({
  trackRef,
  className = '',
  cellClassName = '',
  previous,
  next,
  children,
}: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={trackRef} className="relative h-full">
        {previous && (
          <div className={`absolute top-0 right-full w-full ${cellClassName}`} inert>
            {previous}
          </div>
        )}
        <div className={cellClassName}>{children}</div>
        {next && (
          <div className={`absolute top-0 left-full w-full ${cellClassName}`} inert>
            {next}
          </div>
        )}
      </div>
    </div>
  )
}

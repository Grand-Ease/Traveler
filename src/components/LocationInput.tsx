import { useEffect, useRef, useState } from 'react'
import { MapPin, Plane, Search, TrainFront, X } from 'lucide-react'
import {
  inferPlaceFromTitle,
  resolvePlaces,
  searchPlaces,
  type PlaceCandidate,
} from '../lib/geo'
import { looksLikeTransportCode } from '../lib/transportCodes'

interface Props {
  label: string
  value?: string
  onChange: (v: string) => void
  /** Travel subtype hint for code expansion (airplane, train, …). */
  mode?: string
  placeholder?: string
  /** Called when a candidate is auto-accepted or picked (tz available). */
  onResolved?: (place: PlaceCandidate) => void
  /** City/region to bias searches toward, e.g. the day's destination. */
  near?: string
  /** Searched when the field is empty — typically the event's title. */
  fallbackQuery?: string
  /** Offer the best `fallbackQuery` match while the field is still empty. */
  suggest?: boolean
}

/**
 * Text field that expands airport/rail codes and offers a picker when
 * geocoding returns multiple plausible places.
 */
export default function LocationInput({
  label,
  value,
  onChange,
  mode,
  placeholder,
  onResolved,
  near,
  fallbackQuery,
  suggest,
}: Props) {
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([])
  const [open, setOpen] = useState(false)
  const [looking, setLooking] = useState(false)
  const [noMatches, setNoMatches] = useState(false)
  const [suggestion, setSuggestion] = useState<PlaceCandidate | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | undefined>(undefined)
  const reqRef = useRef(0)
  const suggestRef = useRef<number | undefined>(undefined)
  // Skip re-resolve right after we write an expanded/picked label ourselves.
  const skipNextRef = useRef(false)

  const searchQuery = (value || '').trim() || (fallbackQuery || '').trim()

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    const q = (value || '').trim()
    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }
    if (!q) {
      setCandidates([])
      setOpen(false)
      setLooking(false)
      return
    }

    // Only auto-resolve short codes or when the field looks unfinished.
    // Full addresses still geocode on blur via resolveNow.
    const shouldPreview = looksLikeTransportCode(q)
    if (!shouldPreview) {
      setCandidates([])
      setOpen(false)
      return
    }

    const myReq = ++reqRef.current
    setLooking(true)
    debounceRef.current = window.setTimeout(async () => {
      try {
        const list = await resolvePlaces(q, { mode })
        if (myReq !== reqRef.current) return
        setLooking(false)
        if (list.length === 1) {
          accept(list[0])
          return
        }
        if (list.length > 1) {
          setCandidates(list)
          setOpen(true)
        } else {
          setCandidates([])
          setOpen(false)
        }
      } catch {
        if (myReq !== reqRef.current) return
        setLooking(false)
        setCandidates([])
        setOpen(false)
      }
    }, 450)

    return () => window.clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode])

  // Offer the venue implied by the title while the field is still empty. The
  // guesswork lives in inferPlaceFromTitle, which returns null for titles too
  // generic to place ("Dinner"), so nothing is proposed unless it's specific.
  useEffect(() => {
    window.clearTimeout(suggestRef.current)
    const title = (fallbackQuery || '').trim()
    if (!suggest || dismissed || (value || '').trim() || !title) {
      setSuggestion(null)
      return
    }
    let cancelled = false
    suggestRef.current = window.setTimeout(async () => {
      const place = await inferPlaceFromTitle(title, near)
      if (!cancelled) setSuggestion(place)
    }, 800)
    return () => {
      cancelled = true
      window.clearTimeout(suggestRef.current)
    }
  }, [suggest, dismissed, value, fallbackQuery, near])

  function accept(place: PlaceCandidate) {
    skipNextRef.current = true
    onChange(place.label)
    setCandidates([])
    setOpen(false)
    setLooking(false)
    setNoMatches(false)
    setSuggestion(null)
    onResolved?.(place)
  }

  /** Explicit search: the field's text, or the event title when it's empty. */
  async function runSearch() {
    if (!searchQuery) return
    const myReq = ++reqRef.current
    setLooking(true)
    setNoMatches(false)
    setOpen(false)
    try {
      const list = await searchPlaces(searchQuery, { mode, near })
      if (myReq !== reqRef.current) return
      setLooking(false)
      setCandidates(list)
      setOpen(list.length > 0)
      setNoMatches(list.length === 0)
    } catch {
      if (myReq !== reqRef.current) return
      setLooking(false)
      setNoMatches(true)
    }
  }

  async function resolveNow() {
    const q = (value || '').trim()
    if (!q) return
    // Already expanded (contains a parenthetical code) — leave alone.
    if (/\([A-Za-z]{3}\)\s*$/.test(q) && !looksLikeTransportCode(q)) return

    const myReq = ++reqRef.current
    setLooking(true)
    try {
      const list = await resolvePlaces(q, { mode })
      if (myReq !== reqRef.current) return
      setLooking(false)
      if (list.length === 1) {
        // Only rewrite when we typed a bare code or the label clearly improved.
        if (looksLikeTransportCode(q) || list[0].kind !== 'place') {
          accept(list[0])
        } else {
          onResolved?.(list[0])
        }
        return
      }
      if (list.length > 1) {
        setCandidates(list)
        setOpen(true)
      }
    } catch {
      if (myReq !== reqRef.current) return
      setLooking(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="field pr-11"
          value={value || ''}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            setNoMatches(false)
            onChange(e.target.value)
          }}
          onBlur={() => {
            // Delay so a click on a candidate still registers.
            window.setTimeout(() => {
              if (!open) void resolveNow()
            }, 150)
          }}
          onFocus={() => {
            if (candidates.length > 1) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void runSearch()
            }
          }}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-white/50 hover:text-teal disabled:opacity-30 disabled:hover:text-white/50"
          title={
            (value || '').trim()
              ? 'Search for this address'
              : `Search for “${fallbackQuery || ''}”`
          }
          aria-label="Search for an address"
          disabled={!searchQuery}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void runSearch()}
        >
          <Search size={16} />
        </button>
      </div>
      {looking && (
        <p className="text-[11px] text-white/40 mt-1">Looking up place…</p>
      )}
      {noMatches && !looking && (
        <p className="text-[11px] text-amber-400/80 mt-1">
          No places found for “{searchQuery}”{near ? ` near ${near}` : ''}.
        </p>
      )}
      {open && candidates.length > 0 && (
        <ul
          className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#1a1a1a] shadow-lg"
          role="listbox"
        >
          {candidates.map((c, i) => {
            const Ico = c.kind === 'airport' ? Plane : c.kind === 'station' ? TrainFront : null
            return (
              <li key={`${c.lat},${c.lon},${i}`}>
                <button
                  type="button"
                  role="option"
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/10 flex items-start gap-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => accept(c)}
                >
                  {Ico && <Ico size={14} className="mt-0.5 shrink-0 text-teal" />}
                  <span className="leading-snug">{c.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {suggestion && !open && (
        <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-teal/30 bg-teal/10 px-2.5 py-2">
          <MapPin size={14} className="mt-0.5 shrink-0 text-teal" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white/50">Suggested from the name</p>
            <p className="text-xs leading-snug break-words">{suggestion.label}</p>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs font-semibold text-teal px-2 py-1 rounded hover:bg-white/10"
            onClick={() => accept(suggestion)}
          >
            Use
          </button>
          <button
            type="button"
            className="shrink-0 text-white/40 hover:text-white/70 p-1"
            aria-label="Dismiss suggestion"
            onClick={() => {
              setDismissed(true)
              setSuggestion(null)
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Plane, TrainFront } from 'lucide-react'
import { resolvePlaces, type PlaceCandidate } from '../lib/geo'
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
}: Props) {
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([])
  const [open, setOpen] = useState(false)
  const [looking, setLooking] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | undefined>(undefined)
  const reqRef = useRef(0)
  // Skip re-resolve right after we write an expanded/picked label ourselves.
  const skipNextRef = useRef(false)

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

  function accept(place: PlaceCandidate) {
    skipNextRef.current = true
    onChange(place.label)
    setCandidates([])
    setOpen(false)
    setLooking(false)
    onResolved?.(place)
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
      <input
        type="text"
        className="field"
        value={value || ''}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          // Delay so a click on a candidate still registers.
          window.setTimeout(() => {
            if (!open) void resolveNow()
          }, 150)
        }}
        onFocus={() => {
          if (candidates.length > 1) setOpen(true)
        }}
      />
      {looking && (
        <p className="text-[11px] text-white/40 mt-1">Looking up place…</p>
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
    </div>
  )
}

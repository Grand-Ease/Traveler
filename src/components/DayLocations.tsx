import { useState } from 'react'
import { ChevronRight, MapPin, Plus, X } from 'lucide-react'
import type { DayPlace, Trip } from '../types'
import { activePlaceIndex, placesForDay, refTimeForDay } from '../lib/locations'
import { timezoneForQuery } from '../lib/geo'
import { tzAbbrev } from '../lib/timezones'
import { formatTime } from '../lib/format'

interface Props {
  trip: Trip
  day: string
  canEdit: boolean
  onSave: (places: DayPlace[]) => void
}

// Editable per-day destination(s). The active place (by time of day) is shown
// large and yellow; others are smaller and white. Editing a location detects
// its timezone automatically.
export default function DayLocations({ trip, day, canEdit, onSave }: Props) {
  const { places } = placesForDay(trip, day)
  const active = activePlaceIndex(places, refTimeForDay(day))
  const [draft, setDraft] = useState<DayPlace[] | null>(null)
  const [detecting, setDetecting] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)

  function beginEdit(addBlank = false) {
    if (!canEdit) return
    const seed = places.length
      ? places.map((p) => ({ ...p }))
      : [{ time: '00:00', name: '' }]
    if (addBlank && seed.length < 3) seed.push({ time: '12:00', name: '' })
    setDraft(seed)
  }

  function setRow(i: number, patch: Partial<DayPlace>) {
    setDraft((d) => d!.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }

  async function detect(i: number, name: string) {
    if (!name.trim()) return
    setDetecting((m) => ({ ...m, [i]: true }))
    const tz = await timezoneForQuery(name)
    setDetecting((m) => ({ ...m, [i]: false }))
    if (tz) setRow(i, { tz })
  }

  function addRow() {
    setDraft((d) => {
      if (!d || d.length >= 3) return d
      const t = d.length === 1 ? '12:00' : d[d.length - 1].time
      return [...d, { time: t, name: '' }]
    })
  }

  function removeRow(i: number) {
    setDraft((d) => d!.filter((_, idx) => idx !== i))
  }

  async function commit() {
    if (!draft) return
    setSaving(true)
    const cleaned = draft.filter((p) => p.name.trim())
    const withTz = await Promise.all(
      cleaned.map(async (p) => {
        if (p.tz) return p
        const tz = await timezoneForQuery(p.name)
        return { ...p, tz: tz || undefined }
      }),
    )
    const sorted = [...withTz].sort((a, b) => a.time.localeCompare(b.time))
    if (sorted.length === 1) sorted[0] = { ...sorted[0], time: '00:00' } // first anchors at midnight
    onSave(sorted)
    setSaving(false)
    setDraft(null)
    setDetecting({})
  }

  // ---- editing ----
  if (draft) {
    return (
      <div className="mt-2 space-y-2">
        {draft.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <MapPin size={16} className="text-teal shrink-0" />
            <input
              className="field flex-1 !py-1.5"
              value={p.name}
              autoFocus={i === draft.length - 1 && !p.name}
              placeholder="Destination (city, place)"
              onChange={(e) => setRow(i, { name: e.target.value, tz: undefined })}
              onBlur={(e) => detect(i, e.target.value)}
            />
            {draft.length > 1 && (
              <input
                type="time"
                className="field !py-1.5 w-[7rem]"
                value={p.time}
                onChange={(e) => setRow(i, { time: e.target.value })}
              />
            )}
            {draft.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                className="text-white/40 hover:text-red-400 p-1"
                title="Remove"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button
            onClick={addRow}
            disabled={draft.length >= 3}
            className="inline-flex items-center gap-1 text-sm text-teal disabled:text-white/30"
          >
            <Plus size={16} /> Add place
          </button>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost !py-1.5"
              onClick={() => {
                setDraft(null)
                setDetecting({})
              }}
            >
              Cancel
            </button>
            <button className="btn-primary !py-1.5" onClick={commit} disabled={saving}>
              {saving ? 'Saving…' : 'Done'}
            </button>
          </div>
        </div>
        {Object.values(detecting).some(Boolean) && (
          <p className="text-xs text-white/40">Detecting timezone…</p>
        )}
      </div>
    )
  }

  // ---- read-only (centered, places side-by-side; fixed height) ----
  if (!places.length) {
    return (
      <div className="h-9 flex items-center justify-center">
        {canEdit && (
          <button
            onClick={() => beginEdit()}
            className="inline-flex items-center gap-1.5 text-white/50 hover:text-white"
          >
            <MapPin size={18} /> <span className="text-lg">Set destination</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="h-9 flex items-center justify-center">
      <div
        className={`flex items-center justify-center flex-wrap gap-x-2 ${
          canEdit ? 'cursor-pointer' : ''
        }`}
        onClick={canEdit ? () => beginEdit() : undefined}
      >
        {places.map((p, i) => {
          const isActive = i === active
          const tzTag = p.tz ? tzAbbrev(p.tz) : ''
          return (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={16} className="text-white/30 shrink-0" />}
              <MapPin
                size={isActive ? 18 : 13}
                className={isActive ? 'text-yellow-300 shrink-0' : 'text-white/40 shrink-0'}
              />
              <span
                className={`whitespace-nowrap ${
                  isActive ? 'text-2xl font-bold text-yellow-300' : 'text-base text-white/80'
                }`}
              >
                {p.name}
              </span>
              {places.length > 1 && (
                <span
                  className={isActive ? 'text-yellow-300/80 text-xs' : 'text-white/40 text-xs'}
                >
                  {formatTime(p.time)}
                </span>
              )}
              {tzTag && places.length === 1 && (
                <span className="text-yellow-300/70 text-xs">{tzTag}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

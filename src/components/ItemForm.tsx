import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import {
  ACTIVITY_SUBTYPES,
  TRAVEL_SUBTYPES,
  type ItineraryItem,
  type ItemType,
  type Trip,
} from '../types'
import * as store from '../store/store'
import { TYPE_LABEL } from '../lib/format'
import { dayTimezone } from '../lib/locations'
import { deviceTimezone, tzAbbrev } from '../lib/timezones'
import { hasLocation, timezoneForItem } from '../lib/geo'
import { iconFor, TYPE_ICONS } from './icons'
import Modal from './Modal'

interface Props {
  calendarId: string
  initial: ItineraryItem
  /** Trip whose day destinations supply a default timezone. */
  trip?: Trip
  onClose: () => void
  onSaved: (item: ItineraryItem, isNew: boolean) => void
}

const TYPES: ItemType[] = ['travel', 'lodging', 'dining', 'activity', 'note']

/** Add one hour to an `HH:mm` string, wrapping past midnight (23:30 -> 00:30). */
function addOneHour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const total = (h * 60 + m + 60) % (24 * 60)
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export default function ItemForm({ calendarId, trip, initial, onClose, onSaved }: Props) {
  const [item, setItem] = useState<ItineraryItem>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detecting, setDetecting] = useState(false)
  // undefined = not yet attempted, null = attempted but not found
  const [detectedTz, setDetectedTz] = useState<string | null | undefined>(
    initial.timezone,
  )
  // Once the user edits End directly, stop auto-following the Start time.
  const [endTouched, setEndTouched] = useState(false)
  const isNew = !item.id

  const set = <K extends keyof ItineraryItem>(k: K, v: ItineraryItem[K]) =>
    setItem((p) => ({ ...p, [k]: v }))

  // Auto-detect the destination timezone from the location as the user types.
  const debounceRef = useRef<number | undefined>(undefined)
  const reqRef = useRef(0)
  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    if (!hasLocation(item)) {
      setDetecting(false)
      setDetectedTz(undefined)
      return
    }
    const myReq = ++reqRef.current
    setDetecting(true)
    debounceRef.current = window.setTimeout(async () => {
      const tz = await timezoneForItem(item)
      if (myReq !== reqRef.current) return // superseded
      setDetecting(false)
      setDetectedTz(tz)
      setItem((p) => ({ ...p, timezone: tz || undefined }))
    }, 700)
    return () => window.clearTimeout(debounceRef.current)
    // Re-run when the relevant location inputs change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.location, item.from, item.to, item.type])

  async function save() {
    if (!item.title.trim()) {
      setError('Please enter a title.')
      return
    }
    setSaving(true)
    setError('')
    try {
      // Resolve the timezone before saving. Priority: the item's own location,
      // then the day's active destination, then whatever was already set
      // (falling back to the device tz at render time).
      let toSave = item
      if (hasLocation(item)) {
        const tz = (await timezoneForItem(item)) || item.timezone
        toSave = { ...item, timezone: tz }
      } else if (!item.timezone && trip) {
        const tz = dayTimezone(trip, item.date, item.startTime)
        if (tz) toSave = { ...item, timezone: tz }
      }
      const saved = isNew
        ? store.addItem(calendarId, toSave)
        : store.updateItem(calendarId, toSave)
      onSaved(saved, isNew)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const titleLabel =
    item.type === 'travel'
      ? 'Carrier'
      : item.type === 'lodging'
        ? 'Hotel name'
        : item.type === 'dining'
          ? 'Restaurant'
          : item.type === 'activity'
            ? 'Name / provider'
            : 'Title'

  return (
    <Modal
      title={`${isNew ? 'Add' : 'Edit'} ${TYPE_LABEL[item.type]}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {isNew && (
          <div className="grid grid-cols-5 gap-2">
            {TYPES.map((t) => {
              const Ico = TYPE_ICONS[t]
              const active = item.type === t
              return (
                <button
                  key={t}
                  onClick={() => set('type', t)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs ${
                    active
                      ? 'bg-teal/20 border-teal text-white'
                      : 'border-white/10 text-white/60 hover:bg-white/5'
                  }`}
                >
                  <Ico size={20} />
                  {TYPE_LABEL[t]}
                </button>
              )
            })}
          </div>
        )}

        {item.type === 'travel' && (
          <SubtypeRow
            type="travel"
            values={TRAVEL_SUBTYPES as unknown as string[]}
            selected={item.subtype || 'airplane'}
            onSelect={(s) => set('subtype', s)}
          />
        )}
        {item.type === 'activity' && (
          <SubtypeRow
            label="Kind"
            type="activity"
            values={ACTIVITY_SUBTYPES as unknown as string[]}
            selected={item.subtype || 'activity'}
            onSelect={(s) => set('subtype', s)}
            scroll
          />
        )}

        <Text label={titleLabel} value={item.title} onChange={(v) => set('title', v)} />

        {item.type === 'travel' && (
          <div className="grid grid-cols-2 gap-3">
            <Text label="Flight / train #" value={item.number} onChange={(v) => set('number', v)} />
            <Text label="Gate / Platform" value={item.gate} onChange={(v) => set('gate', v)} />
            <Text label="From" value={item.from} onChange={(v) => set('from', v)} />
            <Text label="To" value={item.to} onChange={(v) => set('to', v)} />
          </div>
        )}

        {item.type === 'travel' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Departure date">
                <input
                  type="date"
                  className="field"
                  value={item.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              </Field>
              <Field label="Departure time">
                <input
                  type="time"
                  className="field"
                  value={item.startTime || ''}
                  onChange={(e) => {
                    const v = e.target.value
                    // Auto-follow the arrival time at +1h until the user edits it
                    // (an empty arrival still counts as untouched).
                    const follow = v && (!endTouched || !item.endTime)
                    setItem((p) => ({
                      ...p,
                      startTime: v,
                      ...(follow ? { endTime: addOneHour(v) } : {}),
                    }))
                  }}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Arrival date">
                <input
                  type="date"
                  className="field"
                  value={item.endDate || ''}
                  min={item.date || undefined}
                  onChange={(e) => set('endDate', e.target.value || undefined)}
                />
              </Field>
              <Field label="Arrival time">
                <input
                  type="time"
                  className="field"
                  value={item.endTime || ''}
                  onChange={(e) => {
                    setEndTouched(true)
                    set('endTime', e.target.value)
                  }}
                />
              </Field>
            </div>
            <Text label="Seats" value={item.seatsOrRoom} onChange={(v) => set('seatsOrRoom', v)} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label={item.type === 'lodging' ? 'Check-in date' : 'Date'}>
              <input
                type="date"
                className="field"
                value={item.date}
                onChange={(e) => set('date', e.target.value)}
              />
            </Field>
            {item.type === 'lodging' ? (
              <Field label="Nights">
                <input
                  type="number"
                  min={1}
                  className="field"
                  value={item.nights ?? 1}
                  onChange={(e) => set('nights', Number(e.target.value))}
                />
              </Field>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start">
                  <input
                    type="time"
                    className="field"
                    value={item.startTime || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      // Auto-follow End at +1h until the user edits End themselves
                      // (an empty End still counts as untouched).
                      const follow = v && (!endTouched || !item.endTime)
                      setItem((p) => ({
                        ...p,
                        startTime: v,
                        ...(follow ? { endTime: addOneHour(v) } : {}),
                      }))
                    }}
                  />
                </Field>
                {item.type !== 'note' && (
                  <Field label="End">
                    <input
                      type="time"
                      className="field"
                      value={item.endTime || ''}
                      onChange={(e) => {
                        setEndTouched(true)
                        set('endTime', e.target.value)
                      }}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        )}

        <Text
          label="Location / address"
          value={item.location}
          onChange={(v) => set('location', v)}
          placeholder={
            item.type === 'travel'
              ? 'Optional — from/to are used for the time zone'
              : 'Sets the map pin and the local time zone'
          }
        />

        {item.type !== 'lodging' && (
          <p className="text-xs -mt-2 flex items-center gap-1.5">
            <MapPin size={12} className="text-white/40 shrink-0" />
            {detecting ? (
              <span className="text-white/50">Detecting time zone from location…</span>
            ) : detectedTz ? (
              <span className="text-teal/90">
                Time zone: {tzAbbrev(detectedTz)} — set automatically from the location.
              </span>
            ) : hasLocation(item) ? (
              <span className="text-amber-400/90">
                Couldn’t detect a time zone. Add a city/country; otherwise your device time
                ({tzAbbrev(deviceTimezone)}) is used.
              </span>
            ) : (
              <span className="text-white/40">
                Add a location and the local time zone is set automatically.
              </span>
            )}
          </p>
        )}

        {item.type !== 'note' && (
          <div className="grid grid-cols-2 gap-3">
            <Text
              label={item.type === 'lodging' ? 'Room #' : 'Confirmation #'}
              value={item.type === 'lodging' ? item.seatsOrRoom : item.confirmation}
              onChange={(v) =>
                item.type === 'lodging' ? set('seatsOrRoom', v) : set('confirmation', v)
              }
            />
            <Text label="Phone" value={item.phone} onChange={(v) => set('phone', v)} />
          </div>
        )}
        {item.type === 'lodging' && (
          <Text
            label="Confirmation #"
            value={item.confirmation}
            onChange={(v) => set('confirmation', v)}
          />
        )}

        <Field label="Notes">
          <textarea
            className="field min-h-[80px]"
            value={item.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </Modal>
  )
}

function SubtypeRow({
  type,
  values,
  selected,
  onSelect,
  label,
  scroll,
}: {
  type: ItemType
  values: string[]
  selected: string
  onSelect: (s: string) => void
  label?: string
  scroll?: boolean
}) {
  const row = (
    <div className={scroll ? 'flex gap-2 overflow-x-auto' : 'flex gap-2'}>
      {values.map((s) => {
        const Ico = iconFor({ type, subtype: s })
        const active = selected === s
        return (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className={`${
              scroll
                ? 'shrink-0 w-11 h-11'
                : 'flex-1 py-2'
            } flex items-center justify-center rounded-xl border ${
              active
                ? 'bg-teal/20 border-teal text-white'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
            title={s}
            aria-label={s}
          >
            <Ico size={20} />
          </button>
        )
      })}
    </div>
  )
  if (!label) return row
  return (
    <div>
      <label className="label">{label}</label>
      {row}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function Text({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value?: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <input
        type="text"
        className="field"
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

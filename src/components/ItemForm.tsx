import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import {
  ACTIVITY_SUBTYPES,
  TRAVEL_SUBTYPES,
  type ItineraryItem,
  type ItemType,
} from '../types'
import { addItem, updateItem } from '../google/calendar'
import { TYPE_LABEL } from '../lib/format'
import { deviceTimezone, tzCity } from '../lib/timezones'
import { hasLocation, timezoneForItem } from '../lib/geo'
import { iconFor, TYPE_ICONS } from './icons'
import Modal from './Modal'

interface Props {
  calendarId: string
  initial: ItineraryItem
  onClose: () => void
  onSaved: (item: ItineraryItem, isNew: boolean) => void
}

const TYPES: ItemType[] = ['travel', 'lodging', 'dining', 'activity', 'note']

export default function ItemForm({ calendarId, initial, onClose, onSaved }: Props) {
  const [item, setItem] = useState<ItineraryItem>({ ...initial })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detecting, setDetecting] = useState(false)
  // undefined = not yet attempted, null = attempted but not found
  const [detectedTz, setDetectedTz] = useState<string | null | undefined>(
    initial.timezone,
  )
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
      // Ensure the timezone reflects the current location before saving
      // (cached, so this is instant if already resolved).
      let toSave = item
      if (hasLocation(item)) {
        const tz = (await timezoneForItem(item)) || undefined
        toSave = { ...item, timezone: tz }
      }
      const saved = isNew
        ? await addItem(calendarId, toSave)
        : await updateItem(calendarId, toSave)
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
            values={TRAVEL_SUBTYPES as unknown as string[]}
            selected={item.subtype || 'airplane'}
            onSelect={(s) => set('subtype', s)}
          />
        )}
        {item.type === 'activity' && (
          <div>
            <label className="label">Kind</label>
            <select
              className="field"
              value={item.subtype || 'activity'}
              onChange={(e) => set('subtype', e.target.value)}
            >
              {ACTIVITY_SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <Text label={titleLabel} value={item.title} onChange={(v) => set('title', v)} />

        {item.type === 'travel' && (
          <div className="grid grid-cols-2 gap-3">
            <Text label="Flight / train #" value={item.number} onChange={(v) => set('number', v)} />
            <Text label="Seats" value={item.seatsOrRoom} onChange={(v) => set('seatsOrRoom', v)} />
            <Text label="From" value={item.from} onChange={(v) => set('from', v)} />
            <Text label="To" value={item.to} onChange={(v) => set('to', v)} />
          </div>
        )}

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
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </Field>
              {item.type !== 'note' && (
                <Field label="End">
                  <input
                    type="time"
                    className="field"
                    value={item.endTime || ''}
                    onChange={(e) => set('endTime', e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}
        </div>

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
                Time zone: {tzCity(detectedTz)} — set automatically from the location.
              </span>
            ) : hasLocation(item) ? (
              <span className="text-amber-400/90">
                Couldn’t detect a time zone. Add a city/country; otherwise your device time
                ({tzCity(deviceTimezone)}) is used.
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
  values,
  selected,
  onSelect,
}: {
  values: string[]
  selected: string
  onSelect: (s: string) => void
}) {
  return (
    <div className="flex gap-2">
      {values.map((s) => {
        const Ico = iconFor({ type: 'travel', subtype: s })
        const active = selected === s
        return (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className={`flex-1 flex items-center justify-center py-2 rounded-xl border ${
              active
                ? 'bg-teal/20 border-teal text-white'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
            title={s}
          >
            <Ico size={20} />
          </button>
        )
      })}
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

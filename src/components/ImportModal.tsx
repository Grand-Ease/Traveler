import { useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import type { ItineraryItem, Trip } from '../types'
import * as store from '../store/store'
import { supabase } from '../supabase/client'
import { hasLocation, timezoneForItem } from '../lib/geo'
import { parseItems } from '../lib/schema'
import { defaultTimezone, TYPE_LABEL, weekdayLong } from '../lib/format'
import Modal from './Modal'

interface Props {
  calendarId: string
  trip?: Trip
  day?: string
  onClose: () => void
  onImported: (items: ItineraryItem[]) => void
}

// Pull the structured { errors } body out of a non-2xx edge-function response.
// Guarded because the body may not be JSON (e.g. a gateway/timeout error).
async function readFunctionError(error: FunctionsHttpError): Promise<string> {
  try {
    const body = await error.context.json()
    const errors = (body as { errors?: string[]; error?: string; message?: string })
    if (Array.isArray(errors.errors) && errors.errors.length) return errors.errors.join(' ')
    if (errors.error) return errors.error
    if (errors.message) return errors.message
  } catch {
    /* not JSON — fall through to the generic message */
  }
  return error.message
}

export default function ImportModal({ calendarId, trip, day, onClose, onImported }: Props) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ItineraryItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function extract() {
    const value = text.trim()
    if (!value) return
    setExtracting(true)
    setSaveError('')
    setParsed([])
    setErrors([])
    try {
      const { data, error } = await supabase.functions.invoke('text-to-events', {
        body: {
          text: value,
          context: {
            tripStart: trip?.startDate,
            tripEnd: trip?.endDate,
            currentDate: day || new Date().toISOString().slice(0, 10),
            defaultTimezone: trip?.timezone || defaultTimezone,
          },
        },
      })
      if (error) {
        // For non-2xx, invoke() returns a FunctionsHttpError BEFORE the
        // structured { errors } body is read — so read it off the response to
        // surface "Daily AI limit reached" / "Unauthorized" etc.
        if (error instanceof FunctionsHttpError) {
          setSaveError(await readFunctionError(error))
        } else {
          setSaveError((error as Error).message)
        }
        return
      }
      const result = data as { items?: unknown[]; errors?: string[] }
      // A 2xx response can still carry structured errors.
      if (result.errors && result.errors.length > 0 && !(result.items && result.items.length)) {
        setErrors(result.errors)
        return
      }
      // Run the model output through the local validator as a safety net.
      const { items, errors: parseErrors } = parseItems(JSON.stringify(result.items ?? []))
      setParsed(items)
      setErrors([...(result.errors ?? []), ...parseErrors])
      if (items.length === 0 && (result.errors ?? []).length === 0 && parseErrors.length === 0) {
        setErrors(['No itinerary items were found in that text.'])
      }
    } catch (e) {
      setSaveError((e as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  async function importAll() {
    setSaving(true)
    setSaveError('')
    try {
      const saved: ItineraryItem[] = []
      for (const it of parsed) {
        // Auto-detect the timezone from the location when the model didn't supply one.
        let tz = it.timezone
        if (!tz && hasLocation(it)) tz = (await timezoneForItem(it)) || undefined
        saved.push(store.addItem(calendarId, { ...it, timezone: tz }))
      }
      onImported(saved)
    } catch (e) {
      setSaveError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Add from email / dictation"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={importAll}
            disabled={saving || parsed.length === 0}
          >
            {saving ? 'Adding…' : `Add ${parsed.length || ''} item${parsed.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-white/5 rounded-xl p-3 text-sm text-white/70 space-y-2">
          <p className="font-medium text-white">How it works</p>
          <ol className="list-decimal list-inside space-y-1 text-white/60">
            <li>Paste a reservation email, or dictate your plans, into the box below.</li>
            <li>Tap Extract — AI turns it into itinerary items.</li>
            <li>Review the preview and add them to your trip.</li>
          </ol>
        </div>

        <div>
          <label className="label">Reservation email or notes</label>
          <textarea
            className="field min-h-[140px] text-sm"
            placeholder="Paste your confirmation email or type your plans…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="btn-primary w-full mt-2"
            onClick={extract}
            disabled={extracting || !text.trim()}
          >
            {extracting ? 'Extracting…' : 'Extract'}
          </button>
        </div>

        {errors.length > 0 && (
          <div className="text-amber-400 text-sm space-y-1">
            {errors.map((e, i) => (
              <p key={i}>⚠ {e}</p>
            ))}
          </div>
        )}

        {parsed.length > 0 && (
          <div className="space-y-2">
            <p className="label">Preview ({parsed.length})</p>
            {parsed.map((it, i) => (
              <div key={i} className="bg-white/5 rounded-lg px-3 py-2 text-sm">
                <span className="text-teal">{TYPE_LABEL[it.type]}</span> · {it.title}
                <span className="text-white/40">
                  {' '}
                  — {it.date ? weekdayLong(it.date) : ''}
                  {it.startTime ? ` ${it.startTime}` : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
      </div>
    </Modal>
  )
}

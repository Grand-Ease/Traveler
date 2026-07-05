import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ItineraryItem } from '../types'
import * as store from '../store/store'
import { hasLocation, timezoneForItem } from '../lib/geo'
import { parseItems } from '../lib/schema'
import { SCHEMA_PROMPT } from '../lib/schema'
import { TYPE_LABEL, weekdayLong } from '../lib/format'
import Modal from './Modal'

interface Props {
  calendarId: string
  onClose: () => void
  onImported: (items: ItineraryItem[]) => void
}

export default function ImportModal({ calendarId, onClose, onImported }: Props) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ItineraryItem[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function preview(t: string) {
    setText(t)
    setSaveError('')
    if (!t.trim()) {
      setParsed([])
      setErrors([])
      return
    }
    const { items, errors } = parseItems(t)
    setParsed(items)
    setErrors(errors)
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(SCHEMA_PROMPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function importAll() {
    setSaving(true)
    setSaveError('')
    try {
      const saved: ItineraryItem[] = []
      for (const it of parsed) {
        // Auto-detect the timezone from the location when the LLM didn't supply one.
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
            <li>Copy the schema prompt below.</li>
            <li>
              Paste it into any AI chat (ChatGPT, Claude, Gemini) followed by your reservation
              email or dictation.
            </li>
            <li>Paste the JSON it returns into the box, review, and add.</li>
          </ol>
          <button
            onClick={copyPrompt}
            className="btn-ghost inline-flex items-center gap-1 !px-2 !py-1"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy schema prompt'}
          </button>
        </div>

        <div>
          <label className="label">Paste JSON</label>
          <textarea
            className="field min-h-[120px] font-mono text-xs"
            placeholder='[ { "type": "travel", "title": "United", ... } ]'
            value={text}
            onChange={(e) => preview(e.target.value)}
          />
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

import { useState } from 'react'
import type { Trip } from '../types'
import { toDateOnly } from '../lib/format'
import * as store from '../store/store'
import Modal from './Modal'

interface Props {
  edit?: Trip
  onClose: () => void
  onSaved: (trip: Trip) => void
}

export default function AddTripModal({ edit, onClose, onSaved }: Props) {
  const today = toDateOnly(new Date())
  const [name, setName] = useState(edit?.name || '')
  const [start, setStart] = useState(edit?.startDate || today)
  const [end, setEnd] = useState(edit?.endDate || today)
  const [error, setError] = useState('')

  function save() {
    if (!name.trim()) return setError('Please enter a trip name.')
    if (end < start) return setError('End date must be on or after the start date.')
    if (edit) {
      const updated = { ...edit, name: name.trim(), startDate: start, endDate: end }
      store.updateTrip(updated)
      onSaved(updated)
    } else {
      onSaved(store.createTrip(name.trim(), start, end))
    }
  }

  return (
    <Modal
      title={edit ? 'Edit Trip' : 'New Trip'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            {edit ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Trip name</label>
          <input
            className="field"
            value={name}
            autoFocus
            placeholder="e.g. Japan 2026"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start date</label>
            <input
              type="date"
              className="field"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="label">End date</label>
            <input
              type="date"
              className="field"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        {!edit && (
          <p className="text-white/40 text-xs">
            This creates a dedicated Google Calendar for the trip. Share it to let others
            view and edit the itinerary. Each item’s time zone is set automatically from its
            location.
          </p>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { getClientId, getMapsKey, setClientId, setMapsKey } from '../config'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const [clientId, setId] = useState(getClientId())
  const [mapsKey, setKey] = useState(getMapsKey())
  const [saved, setSaved] = useState(false)

  function save() {
    setClientId(clientId)
    setMapsKey(mapsKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={save}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Google OAuth Client ID</label>
          <input
            className="field"
            placeholder="xxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setId(e.target.value)}
          />
          <p className="text-white/40 text-xs mt-1">
            Changing this signs you out; sign in again after saving.
          </p>
        </div>
        <div>
          <label className="label">Google Maps API key</label>
          <input
            className="field"
            placeholder="AIza… (for automatic time zones)"
            value={mapsKey}
            onChange={(e) => setKey(e.target.value)}
          />
          <p className="text-white/40 text-xs mt-1">
            Enables accurate geocoding for automatic time-zone detection. Restrict the key to
            your site’s domain in Google Cloud Console.
          </p>
        </div>
        <p className="text-white/30 text-xs">Keys are stored only in this browser.</p>
      </div>
    </Modal>
  )
}

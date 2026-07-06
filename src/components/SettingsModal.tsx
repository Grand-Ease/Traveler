import { useState } from 'react'
import { getMapsKey, isMapsKeyFromEnv, setMapsKey } from '../config'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const [mapsKey, setKey] = useState(getMapsKey())
  const [saved, setSaved] = useState(false)

  const managedMapsKey = isMapsKeyFromEnv()

  function save() {
    if (!managedMapsKey) setMapsKey(mapsKey)
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
          {!managedMapsKey && (
            <button className="btn-primary" onClick={save}>
              {saved ? 'Saved!' : 'Save'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!managedMapsKey ? (
          <div>
            <label className="label">Google Maps API key</label>
            <input
              className="field"
              placeholder="AIza… (for automatic time zones)"
              value={mapsKey}
              onChange={(e) => setKey(e.target.value)}
            />
            <p className="text-white/40 text-xs mt-1">
              Optional. Enables accurate geocoding for automatic time-zone detection. Restrict
              the key to your site’s domain in Google Cloud Console. Without it, a keyless
              fallback is used.
            </p>
          </div>
        ) : (
          <p className="text-white/40 text-sm">
            Maps is configured by this app’s deployment — there’s nothing to set up here.
          </p>
        )}
        {!managedMapsKey && (
          <p className="text-white/30 text-xs">Keys are stored only in this browser.</p>
        )}
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import {
  getClientId,
  getMapsKey,
  isClientIdFromEnv,
  isMapsKeyFromEnv,
  setClientId,
  setMapsKey,
} from '../config'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const [clientId, setId] = useState(getClientId())
  const [mapsKey, setKey] = useState(getMapsKey())
  const [saved, setSaved] = useState(false)

  const managedClientId = isClientIdFromEnv()
  const managedMapsKey = isMapsKeyFromEnv()
  // Nothing for the user to configure when both are baked into the build.
  const fullyManaged = managedClientId && managedMapsKey

  function save() {
    if (!managedClientId) setClientId(clientId)
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
          {!fullyManaged && (
            <button className="btn-primary" onClick={save}>
              {saved ? 'Saved!' : 'Save'}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {!managedClientId && (
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
        )}
        {!managedMapsKey && (
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
        )}
        {fullyManaged ? (
          <p className="text-white/40 text-sm">
            Google sign-in and maps are configured by this app’s deployment — there’s nothing to
            set up here.
          </p>
        ) : (
          <p className="text-white/30 text-xs">Keys are stored only in this browser.</p>
        )}
      </div>
    </Modal>
  )
}

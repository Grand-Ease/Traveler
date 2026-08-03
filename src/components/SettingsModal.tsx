import { useState } from 'react'
import {
  DEMO_MAP_ID,
  getMapsKey,
  getMapsMapId,
  isMapIdFromEnv,
  isMapsKeyFromEnv,
  setMapsKey,
  setMapsMapId,
} from '../config'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const [mapsKey, setKey] = useState(getMapsKey())
  const storedMapId = getMapsMapId()
  const [mapId, setMapId] = useState(storedMapId === DEMO_MAP_ID ? '' : storedMapId)
  const [saved, setSaved] = useState(false)

  const managedMapsKey = isMapsKeyFromEnv()
  const managedMapId = isMapIdFromEnv()

  function save() {
    if (!managedMapsKey) setMapsKey(mapsKey)
    if (!managedMapId) setMapsMapId(mapId)
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
              Optional. Enables accurate geocoding for automatic time-zone detection. Enable
              “Places API (New)” on the key for the best results when searching venues by
              name. Restrict the key to your site’s domain in Google Cloud Console. Without
              it, a keyless fallback is used.
            </p>
          </div>
        ) : (
          <p className="text-white/40 text-sm">
            Maps is configured by this app’s deployment — there’s nothing to set up here.
          </p>
        )}
        {!managedMapId && (
          <div>
            <label className="label">Google Maps Map ID</label>
            <input
              className="field"
              placeholder="Optional — uses a demo ID when blank"
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
            />
            <p className="text-white/40 text-xs mt-1">
              Styles the map and its pins. Create one free in Cloud Console → Map
              Management. Without it a Google demo ID is used, which is fine for testing
              but not meant for production.
            </p>
          </div>
        )}
        {!managedMapsKey && (
          <p className="text-white/30 text-xs">Keys are stored only in this browser.</p>
        )}
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import {
  asset,
  getClientId,
  getMapsKey,
  isClientIdFromEnv,
  isMapsKeyFromEnv,
  setClientId,
  setMapsKey,
} from '../config'
import { signIn } from '../google/auth'

interface Props {
  onSignedIn: () => void
}

export default function SignIn({ onSignedIn }: Props) {
  const [clientId, setId] = useState(getClientId())
  const [mapsKey, setKey] = useState(getMapsKey())
  // Credentials baked into the build take over; users never configure anything.
  const managed = isClientIdFromEnv()
  const [needsSetup, setNeedsSetup] = useState(!managed && !getClientId())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function doSignIn() {
    setBusy(true)
    setError('')
    try {
      if (needsSetup) {
        if (!clientId.trim()) throw new Error('Enter your Google OAuth Client ID.')
        setClientId(clientId)
        setMapsKey(mapsKey)
      }
      await signIn()
      onSignedIn()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col items-center justify-center px-6 py-10 text-center">
      <img
        src={asset('logo-cube.png')}
        alt=""
        className="w-28 h-28 object-contain mb-4 drop-shadow-xl"
        draggable={false}
      />
      <h1 className="text-2xl font-bold">GrandEase Traveler</h1>
      <p className="text-white/50 mt-1 mb-8">Where will you go?</p>

      {needsSetup && (
        <div className="w-full max-w-sm text-left mb-4">
          <label className="label">Google OAuth Client ID</label>
          <input
            className="field"
            placeholder="xxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setId(e.target.value)}
          />
          <p className="text-white/40 text-xs mt-2">
            One-time setup. Create an OAuth Client ID in Google Cloud Console (see the README),
            then paste it here. Stored only in this browser.
          </p>

          {!isMapsKeyFromEnv() && (
            <>
              <label className="label mt-4">Google Maps API key</label>
              <input
                className="field"
                placeholder="AIza… (for automatic time zones)"
                value={mapsKey}
                onChange={(e) => setKey(e.target.value)}
              />
              <p className="text-white/40 text-xs mt-2">
                Recommended. Enables accurate address geocoding so each item’s time zone is set
                automatically. Without it, a keyless fallback is used.
              </p>
            </>
          )}
        </div>
      )}

      <button className="btn-primary w-full max-w-sm" onClick={doSignIn} disabled={busy}>
        {busy ? 'Connecting…' : 'Sign in with Google'}
      </button>

      {!needsSetup && !managed && (
        <button
          className="text-white/40 text-xs mt-3 hover:text-white/70"
          onClick={() => setNeedsSetup(true)}
        >
          Change Client ID
        </button>
      )}

      {error && <p className="text-red-400 text-sm mt-4 max-w-sm">{error}</p>}
    </div>
  )
}

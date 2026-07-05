import { useEffect, useState } from 'react'
import type { Trip } from './types'
import { getToken, hasSignedInBefore, hasValidToken } from './google/auth'
import { getClientId } from './config'
import SignIn from './components/SignIn'
import Home from './components/Home'
import TripDetail from './components/TripDetail'
import Splash from './components/Splash'

type Screen = { name: 'home' } | { name: 'trip'; trip: Trip }

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  useEffect(() => {
    // Session restore on load. Critically, this NEVER opens an OAuth popup:
    // iOS blocks popups not tied to a user gesture, which would hang the app on
    // the splash screen. Interactive sign-in only happens from the button tap.
    async function restore() {
      if (!getClientId()) return setChecking(false) // first-run setup
      if (hasValidToken()) {
        setAuthed(true)
        return setChecking(false)
      }
      // Offline returning user: enter with cached data; sync when back online.
      if (!navigator.onLine && hasSignedInBefore()) {
        setAuthed(true)
        return setChecking(false)
      }
      // Online: attempt a SILENT token refresh (no popup, times out fast).
      // If it can't (first sign-in, or iOS blocks the silent iframe), fall
      // back to the sign-in screen where a tap can open the popup.
      try {
        await getToken()
        setAuthed(true)
      } catch {
        /* needs interactive sign-in via the button */
      } finally {
        setChecking(false)
      }
    }
    restore()
  }, [])

  if (checking) return <Splash />

  if (!authed) return <SignIn onSignedIn={() => setAuthed(true)} />

  if (screen.name === 'trip')
    return <TripDetail trip={screen.trip} onBack={() => setScreen({ name: 'home' })} />

  return (
    <Home
      onOpenTrip={(trip) => setScreen({ name: 'trip', trip })}
      onSignOut={() => {
        setAuthed(false)
        setScreen({ name: 'home' })
      }}
    />
  )
}

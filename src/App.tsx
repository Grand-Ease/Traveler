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
    // Offline-first session restore: if the user has signed in before, let them
    // straight into the app (cached data works offline); refresh the token in the
    // background so writes can sync when possible.
    async function restore() {
      if (!getClientId()) return setChecking(false)
      if (hasValidToken() || hasSignedInBefore()) {
        setAuthed(true)
        setChecking(false)
        if (!hasValidToken() && navigator.onLine) {
          try {
            await getToken()
          } catch {
            /* token refresh may need interaction; sync will surface any issue */
          }
        }
        return
      }
      try {
        await getToken()
        setAuthed(true)
      } catch {
        /* needs interactive sign-in */
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

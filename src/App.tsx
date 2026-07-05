import { useEffect, useState } from 'react'
import type { Trip } from './types'
import { getToken, hasValidToken } from './google/auth'
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
    // Try to silently restore a session on load.
    async function restore() {
      if (!getClientId()) return setChecking(false)
      if (hasValidToken()) {
        setAuthed(true)
        return setChecking(false)
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

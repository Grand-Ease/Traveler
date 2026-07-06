import { useEffect, useState } from 'react'
import type { Trip } from './types'
import { supabase } from './supabase/client'
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
    let mounted = true

    // getSession() reads the persisted session locally (no network), so
    // returning users — including offline — are authed instantly without a
    // hang on the splash screen.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setAuthed(!!data.session)
      setChecking(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setAuthed(!!session)
      setChecking(false)
      // On a fresh sign-in, turn any pending email invites into memberships.
      if (event === 'SIGNED_IN' && session) {
        supabase.rpc('claim_invites').then(
          () => {},
          () => {},
        )
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (checking) return <Splash />

  if (!authed) return <SignIn />

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

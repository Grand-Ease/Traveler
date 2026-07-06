import { useEffect, useState } from 'react'
import type { Trip } from './types'
import { supabase, supabaseConfigError } from './supabase/client'
import * as store from './store/store'
import SignIn from './components/SignIn'
import Home from './components/Home'
import TripDetail from './components/TripDetail'
import Splash from './components/Splash'

type Screen = { name: 'home' } | { name: 'trip'; trip: Trip }

// Turn any pending email invites into memberships. Safe to call more than once
// (the RPC is idempotent), so we run it both after restoring an existing
// session AND on a fresh SIGNED_IN. On a successful claim of NEW memberships,
// refresh trips so the shared trip appears without a manual reload.
async function claimInvites() {
  try {
    const { data, error } = await supabase.rpc('claim_invites')
    if (error) {
      console.warn('claim_invites failed:', error.message)
      return
    }
    if (typeof data === 'number' && data > 0) void store.sync()
  } catch (e) {
    console.warn('claim_invites failed:', (e as Error).message)
  }
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })

  useEffect(() => {
    if (supabaseConfigError) return
    let mounted = true

    // getSession() reads the persisted session locally (no network), so
    // returning users — including offline — are authed instantly without a
    // hang on the splash screen.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setAuthed(!!data.session)
      setChecking(false)
      // Claim invites on session restore too, so users with pending email
      // invites get shared trips after a normal reload (not just at sign-in).
      if (data.session) void claimInvites()
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setAuthed(!!session)
      setChecking(false)
      // On a fresh sign-in, turn any pending email invites into memberships.
      if (event === 'SIGNED_IN' && session) void claimInvites()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Not configured: show a clear, visible message instead of failing silently.
  if (supabaseConfigError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold text-white">App isn’t configured</h1>
          <p className="text-white/70 text-sm">
            The Supabase connection details are missing, so the app can’t start.
          </p>
          <p className="text-white/50 text-sm">
            Set <code className="text-white">VITE_SUPABASE_ANON_KEY</code> and{' '}
            <code className="text-white">VITE_SUPABASE_URL</code> in your{' '}
            <code className="text-white">.env</code> file (or GitHub Actions secrets) and rebuild.
          </p>
        </div>
      </div>
    )
  }

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

import { useState } from 'react'
import { asset } from '../config'
import { supabase } from '../supabase/client'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function signInWithGoogle() {
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      })
      if (error) throw error
      // Browser redirects to Google; auth state resolves on return.
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  async function sendMagicLink() {
    const value = email.trim()
    if (!value) return setError('Enter your email address.')
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: window.location.href },
      })
      if (error) throw error
      setSent(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
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

      <div className="w-full max-w-sm space-y-4">
        <button className="btn-primary w-full" onClick={signInWithGoogle} disabled={busy}>
          {busy ? 'Connecting…' : 'Sign in with Google'}
        </button>

        <div className="flex items-center gap-3 text-white/30 text-xs">
          <div className="flex-1 border-t border-white/10" />
          or
          <div className="flex-1 border-t border-white/10" />
        </div>

        {sent ? (
          <p className="text-white/70 text-sm">
            Check your inbox — we sent a magic sign-in link to{' '}
            <span className="text-white">{email.trim()}</span>. Open it on this device to
            finish signing in.
          </p>
        ) : (
          <div className="text-left space-y-2">
            <label className="label">Email</label>
            <input
              className="field"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
            />
            <button
              className="btn-ghost w-full"
              onClick={sendMagicLink}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Email me a magic link'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-4 max-w-sm">{error}</p>}
    </div>
  )
}

import { createClient } from '@supabase/supabase-js'

// Read config from the Vite build env. VITE_SUPABASE_URL has a sensible default
// (the project URL) but the anon key MUST be supplied at build time (it's a
// public key, safe to ship). Both are also documented in .env.example.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://ucxfxzjgszpdhenajuxc.supabase.co'

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''

const SUPABASE_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`

// Validate config at import WITHOUT throwing — a throw here would white-screen
// the static SPA. Instead we expose the problem so the UI can show a clear,
// visible message (see App.tsx). The anon key is a public key supplied at
// build time; when it's missing the client would otherwise fail silently.
function computeConfigError(): string | null {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
  return missing.length ? `Missing ${missing.join(' and ')}` : null
}

export const supabaseConfigError: string | null = computeConfigError()

export function isSupabaseConfigured(): boolean {
  return supabaseConfigError === null
}

// Supabase may refresh an expired token over the network while its client
// initializes. Use the persisted session only as a fast startup hint so a
// returning user can see the locally cached app while that refresh runs.
export function hasPersistedSession(): boolean {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY)
    if (!raw) return false
    const session = JSON.parse(raw) as Record<string, unknown>
    return typeof session.access_token === 'string' && typeof session.refresh_token === 'string'
  } catch {
    return false
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: SUPABASE_STORAGE_KEY,
  },
})

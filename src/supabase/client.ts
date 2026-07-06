import { createClient } from '@supabase/supabase-js'

// Read config from the Vite build env. VITE_SUPABASE_URL has a sensible default
// (the project URL) but the anon key MUST be supplied at build time (it's a
// public key, safe to ship). Both are also documented in .env.example.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  'https://ucxfxzjgszpdhenajuxc.supabase.co'

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

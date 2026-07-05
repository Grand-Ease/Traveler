// Google Identity Services (GIS) OAuth token flow — 100% browser, no secret.
import { GOOGLE_SCOPES, getClientId } from '../config'

// Minimal typings for the GIS global we use.
interface TokenResponse {
  access_token: string
  expires_in: number
  error?: string
}
interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void
  callback: (resp: TokenResponse) => void
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
          }) => TokenClient
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

const TOKEN_KEY = 'grandease.token'
const TOKEN_EXP_KEY = 'grandease.tokenExp'
const SIGNED_IN_BEFORE = 'grandease.signedInBefore'

/** True if the user has completed an interactive sign-in on this device before. */
export function hasSignedInBefore(): boolean {
  return localStorage.getItem(SIGNED_IN_BEFORE) === '1'
}

let tokenClient: TokenClient | null = null
// Persisted in localStorage so the session survives app/tab restarts (access
// tokens last ~1h). sessionStorage would be wiped on every launch.
let accessToken: string | null = localStorage.getItem(TOKEN_KEY)
let tokenExpiry = Number(localStorage.getItem(TOKEN_EXP_KEY) || 0)

function waitForGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      if (window.google?.accounts?.oauth2) return resolve()
      if (Date.now() - started > 10000)
        return reject(new Error('Google sign-in library failed to load.'))
      setTimeout(tick, 50)
    }
    tick()
  })
}

async function ensureClient(): Promise<TokenClient> {
  if (tokenClient) return tokenClient
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing Google Client ID.')
  await waitForGis()
  tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_SCOPES,
    callback: () => {}, // set per-request below
  })
  return tokenClient
}

function persist(token: string, expiresIn: number) {
  accessToken = token
  tokenExpiry = Date.now() + (expiresIn - 60) * 1000 // refresh 60s early
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXP_KEY, String(tokenExpiry))
  localStorage.setItem(SIGNED_IN_BEFORE, '1')
}

export function hasValidToken(): boolean {
  return !!accessToken && Date.now() < tokenExpiry
}

// Request a token with a timeout so a blocked popup / ITP-blocked silent iframe
// never leaves a promise hanging forever (which would freeze the app on load).
async function requestToken(prompt: string, timeoutMs: number): Promise<string> {
  const client = await ensureClient()
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('Sign-in timed out.'))
    }, timeoutMs)
    client.callback = (resp) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (resp.error) return reject(new Error(resp.error))
      persist(resp.access_token, resp.expires_in)
      resolve(resp.access_token)
    }
    client.requestAccessToken({ prompt })
  })
}

/**
 * Interactive sign-in. MUST be called from a user gesture (button tap) so the
 * browser allows the OAuth popup — iOS blocks popups opened without a gesture.
 */
export async function signIn(): Promise<string> {
  return requestToken('consent', 120000)
}

/**
 * Return a valid token WITHOUT ever opening a popup. Uses the silent grant
 * (prompt: 'none'); rejects if interaction is required. Safe to call on load
 * and from background sync — never blocks the UI.
 */
export async function getToken(): Promise<string> {
  if (hasValidToken()) return accessToken!
  return requestToken('none', 8000)
}

export function signOut() {
  const t = accessToken
  accessToken = null
  tokenExpiry = 0
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXP_KEY)
  localStorage.removeItem(SIGNED_IN_BEFORE)
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t)
}

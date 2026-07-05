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
let accessToken: string | null = sessionStorage.getItem(TOKEN_KEY)
let tokenExpiry = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || 0)

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
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(TOKEN_EXP_KEY, String(tokenExpiry))
  localStorage.setItem(SIGNED_IN_BEFORE, '1')
}

export function hasValidToken(): boolean {
  return !!accessToken && Date.now() < tokenExpiry
}

/** Interactive sign-in (shows Google account chooser / consent). */
export async function signIn(): Promise<string> {
  const client = await ensureClient()
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      persist(resp.access_token, resp.expires_in)
      resolve(resp.access_token)
    }
    client.requestAccessToken({ prompt: 'consent' })
  })
}

/** Return a valid token, silently refreshing if possible. */
export async function getToken(): Promise<string> {
  if (hasValidToken()) return accessToken!
  const client = await ensureClient()
  return new Promise((resolve, reject) => {
    client.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error))
      persist(resp.access_token, resp.expires_in)
      resolve(resp.access_token)
    }
    client.requestAccessToken({ prompt: '' }) // silent if already consented
  })
}

export function signOut() {
  const t = accessToken
  accessToken = null
  tokenExpiry = 0
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_EXP_KEY)
  localStorage.removeItem(SIGNED_IN_BEFORE)
  if (t && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(t)
}

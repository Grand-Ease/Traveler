import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Register before rendering so a first-time visitor's assets are precached in
// the same visit. In dev this is a no-op stub. `autoUpdate` means a new deploy
// installs and takes over on its own — no update prompt.
registerSW({ immediate: true })

// One-time cleanup of the pre-Workbox cache (the hand-rolled public/sw.js).
// Its entries are unreachable now but would otherwise sit in storage forever.
if ('caches' in window) void caches.delete('grandease-v1')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

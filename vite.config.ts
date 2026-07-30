import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Relative base so the build works on GitHub Pages project sites
// (https://user.github.io/<repo>/) without hard-coding the repo name.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Offline app shell. Workbox generates dist/sw.js with a precache manifest
    // of the real (hashed) build output, so every deploy ships a worker that
    // knows exactly which assets to keep — the shell can never reference an
    // asset that isn't cached.
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done explicitly in main.tsx.
      injectRegister: null,
      // Keep the hand-written public/manifest.webmanifest and its <link> in
      // index.html rather than generating a second one.
      manifest: false,
      workbox: {
        // splash.png (~1.3MB) and logo-cube.png are rendered by the app itself,
        // so they belong in the shell alongside the JS/CSS.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
})

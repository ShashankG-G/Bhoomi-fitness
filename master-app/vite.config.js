import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed as a static bundle to GitHub Pages under a repo subpath (e.g.
// /bhoomi-fitness/staff/), not at domain root. Set VITE_BASE_PATH at build
// time to override; defaults to '/' for local dev. The PWA manifest's
// start_url/scope and icon paths all derive from this so installability
// keeps working no matter where the build is hosted.
const base = process.env.VITE_BASE_PATH || '/'

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Bhoomi Fitness Staff',
        short_name: 'Bhoomi Staff',
        description: 'Bhoomi Fitness front-desk staff app - entry scanning, member lookup, cafeteria queue',
        theme_color: '#0b0b0c',
        background_color: '#0b0b0c',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Never cache API calls - staff always needs live data (entry decisions,
        // order queue, member search). Only precache the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5174
  },
  preview: {
    host: true,
    port: 4173
  }
})

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

const DAY = 24 * 60 * 60

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app that still opens offline: helplines, saved content and the last
    // weather/facility results keep working when the network drops (common in disasters).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'nivra_logo.png', 'guest_pfp.png'],
      manifest: {
        name: 'NIVRA — Citizen & Student Assistance',
        short_name: 'NIVRA',
        description: 'Scholarships, government schemes and emergency help for India in one place.',
        theme_color: '#07070d',
        background_color: '#07070d',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en-IN',
        categories: ['education', 'utilities', 'government'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Emergency', url: '/emergency', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
          { name: 'Ask NIVRA', url: '/assistant', icons: [{ src: 'pwa-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['**/pwa-512.png', '**/pwa-maskable-512.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // public reference content — show cached instantly, refresh in the background
            urlPattern: ({ url }) => /^\/api\/(scholarships|schemes|loans|guides|items)/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'nivra-content', expiration: { maxEntries: 120, maxAgeSeconds: 7 * DAY } },
          },
          {
            // last known weather / alerts / nearby facilities for when the network drops
            urlPattern: ({ url }) => /^\/api\/geo\/(weather|alerts|facilities|place)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'nivra-geo', networkTimeoutSeconds: 6, expiration: { maxEntries: 40, maxAgeSeconds: 2 * DAY } },
          },
          {
            // map tiles the user has already viewed (OSM policy: no bulk prefetching)
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 300, maxAgeSeconds: 14 * DAY }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * DAY } },
          },
          // User data (trackers, reports, profile) and AI calls are never cached.
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})

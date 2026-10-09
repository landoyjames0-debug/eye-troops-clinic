import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['eye-troops-logo.png'],
      manifest: {
        id: '/',
        name: 'Eye TroOps Optical Clinic',
        short_name: 'Eye TroOps',
        description: 'Patient, visit, prescription, order, and payment management for Eye TroOps Optical Clinic.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FBF5EC',
        theme_color: '#FBF5EC',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        navigateFallbackDenylist: [/^\/(?:rest|auth|storage)\/v1\//],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {},
})

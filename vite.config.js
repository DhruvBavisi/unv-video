import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  envPrefix: ['VITE', 'SOCKET'],
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: {
        name: 'UNDERCOVER',
        short_name: 'UNDERCOVER',
        description: 'A classified investigation file brought to life as a cinematic game. WHO CAN YOU TRUST?',
        id: '/',
        scope: '/',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0c0d',
        theme_color: '#0b0c0d',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    cors: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    cors: true,
  },
})

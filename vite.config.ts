import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Le site est publié sur https://<compte>.github.io/ludotheque/
const base = '/ludotheque/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Ma Ludothèque',
        short_name: 'Ludothèque',
        description: 'Ma collection de jeux de société, jeux vidéo et jeux de rôle',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f4efe6',
        theme_color: '#1f3a5f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})

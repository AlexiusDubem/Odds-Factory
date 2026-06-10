import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png'],
      manifest: {
        name: 'Odds Factory',
        short_name: 'Odds Factory',
        description: 'Optimize your booking codes effortlessly.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      // Proxies SportyBet API calls (for loading booking codes via the Vite dev server)
      '/api/sportybet': {
        target: 'https://www.sportybet.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/sportybet/, '/api/ng'),
        headers: {
          'Origin': 'https://www.sportybet.com',
          'Referer': 'https://www.sportybet.com/ng/',
        },
      },
      // Proxies booking requests to the local Playwright server (booking-server.mjs)
      '/api/local': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local/, ''),
      },
    },
  },
})
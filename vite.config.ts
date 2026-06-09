import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local/, ''),
      },
    },
  },
})
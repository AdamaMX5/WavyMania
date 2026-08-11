import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // TicketService doesn't send CORS headers itself (handled at the NGINX
      // layer in production, per the shared MSArchitecture conventions) and
      // isn't deployed under a stable domain yet — proxy it locally so the
      // dev-server origin matches and the browser never sees a cross-origin
      // request. Overridden entirely when VITE_TICKET_SERVICE_URL is set
      // (eventClient.ts then calls that URL directly and this proxy is unused).
      '/api/ticket': {
        target: process.env.TICKET_SERVICE_PROXY_TARGET || 'http://localhost:3004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ticket/, ''),
      },
      // Same rationale as /api/ticket above. Default port 3003 matches wavy-app's
      // MARKET_SERVICE_PROXY_TARGET convention for a local MarketService instance.
      '/api/market': {
        target: process.env.MARKET_SERVICE_PROXY_TARGET || 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/market/, ''),
      },
    },
  },
})

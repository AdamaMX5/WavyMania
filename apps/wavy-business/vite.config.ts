import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Both wavy-app and wavy-business read from one admin-managed .env at the
// WavyMania repo root (see ../../.env.example) instead of per-app .env files —
// several services (MarketService, TicketService, PaymentService, plus the
// existing shared-platform services) are used by both frontends, so a single
// source of truth avoids keeping two copies of the same URLs in sync.
const rootDir = fileURLToPath(new URL('../..', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Third argument '' (no prefix filter) so non-VITE_-prefixed vars like
  // *_SERVICE_PROXY_TARGET are loaded too — those are Node-side (this config
  // file), never exposed to client code, unlike the VITE_-prefixed ones below
  // which import.meta.env picks up on its own via envDir.
  const env = loadEnv(mode, rootDir, '')

  return {
    envDir: rootDir,
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
          target: env.TICKET_SERVICE_PROXY_TARGET || 'http://localhost:3004',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ticket/, ''),
        },
        // Same rationale as /api/ticket above. Default port 3003 matches wavy-app's
        // MARKET_SERVICE_PROXY_TARGET convention for a local MarketService instance.
        '/api/market': {
          target: env.MARKET_SERVICE_PROXY_TARGET || 'http://localhost:3003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/market/, ''),
        },
        // Same rationale as /api/ticket above. No prior proxy target was reserved for
        // PaymentService elsewhere in the repo — 3005 continues the existing sequence
        // (3000 Wave, 3001 Geo, 3002 Activation, 3003 Market, 3004 Ticket).
        '/api/payment': {
          target: env.PAYMENT_SERVICE_PROXY_TARGET || 'http://localhost:3005',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/payment/, ''),
        },
      },
    },
  }
})

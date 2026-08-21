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
        // All services below now default to their real *.freischule.info domain
        // directly in client code (eventClient.ts etc.) — these proxy entries are
        // opt-in local-dev tooling only, used when VITE_TICKET_SERVICE_URL (etc.)
        // is explicitly set to /api/ticket to point at a locally-running instance
        // instead of production, avoiding a cross-origin request from the
        // dev-server origin (TicketService itself sends no CORS headers by
        // design; CORS is handled at the NGINX layer in production).
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

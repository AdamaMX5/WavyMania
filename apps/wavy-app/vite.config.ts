import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // WaveService doesn't send CORS headers itself (handled at the NGINX layer
      // in production, per the shared MSArchitecture conventions) and isn't
      // deployed under a stable domain yet — proxy it locally so the dev-server
      // origin matches and the browser never sees a cross-origin request.
      // Overridden entirely when VITE_WAVE_SERVICE_URL is set (waveClient.ts
      // then calls that URL directly and this proxy is unused).
      '/api/wave': {
        target: process.env.WAVE_SERVICE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/wave/, ''),
      },
      // Same rationale as /api/wave above, for GeoService (see geoClient.ts).
      // Overridden entirely when VITE_GEO_SERVICE_URL is set.
      '/api/geo': {
        target: process.env.GEO_SERVICE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/geo/, ''),
      },
      // Same rationale as /api/wave above, for ActivationService (see
      // activationClient.ts). Overridden entirely when
      // VITE_ACTIVATION_SERVICE_URL is set.
      '/api/activation': {
        target: process.env.ACTIVATION_SERVICE_PROXY_TARGET || 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/activation/, ''),
      },
    },
  },
})

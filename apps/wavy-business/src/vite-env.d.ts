/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TICKET_SERVICE_URL?: string
  readonly VITE_MARKET_SERVICE_URL?: string
  readonly VITE_PAYMENT_SERVICE_URL?: string
  readonly VITE_AUTH_SERVICE_URL?: string
  readonly VITE_GIT_SERVICE_URL?: string
  readonly VITE_GIT_SERVICE_REPO?: string
}

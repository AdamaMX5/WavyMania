import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import * as paymentsClient from './paymentsClient'
import { PaymentApiError, type MerchantAccount, type OnboardingState } from './paymentsClient'

const STATE_LABEL: Record<OnboardingState, string> = {
  pending: 'Ausstehend',
  complete: 'Abgeschlossen',
  restricted: 'Eingeschränkt',
}

const STATE_CLASS: Record<OnboardingState, string> = {
  pending: 'bg-amber-950 text-amber-300',
  complete: 'bg-cyan-950 text-cyan-300',
  restricted: 'bg-red-950 text-red-300',
}

// Set by the thin /merchant/onboarding/{complete,refresh} redirect routes (see
// App.tsx) — Stripe sends the merchant back to one of those after the hosted
// onboarding flow, and they land here with the outcome as a query param.
// `refresh-failed` is an actionable error (the automatic retry in
// OnboardingRefreshRedirect.tsx gave up) and gets the same red treatment as the
// `error` state below — not the neutral info styling `returned` uses.
const BANNERS: Record<string, { text: string; tone: 'info' | 'error' }> = {
  returned: { text: 'Willkommen zurück — wir prüfen deinen aktuellen Status.', tone: 'info' },
  'refresh-failed': {
    text: 'Der Onboarding-Link ist abgelaufen und konnte nicht automatisch erneuert werden. Bitte erneut versuchen.',
    tone: 'error',
  },
}

export function PayoutsView() {
  const { accessToken } = useAuth()
  const [searchParams] = useSearchParams()
  const [account, setAccount] = useState<MerchantAccount | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  const load = useCallback(async () => {
    if (!accessToken) return
    setError(null)
    try {
      setAccount(await paymentsClient.getMerchantAccount(accessToken))
    } catch (err) {
      setError(err instanceof PaymentApiError ? err.message : 'Status konnte nicht geladen werden.')
    }
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const startOnboarding = async () => {
    if (!accessToken) return
    setError(null)
    setRedirecting(true)
    try {
      const { onboardingUrl } =
        account === null ? await paymentsClient.createAccount(accessToken) : await paymentsClient.refreshOnboardingLink(accessToken)
      // Full navigation, not client-side routing — Stripe's hosted onboarding lives
      // outside this SPA and redirects back to /merchant/onboarding/{complete,refresh}.
      window.location.href = onboardingUrl
    } catch (err) {
      setError(err instanceof PaymentApiError ? err.message : 'Onboarding-Link konnte nicht erstellt werden.')
      setRedirecting(false)
    }
  }

  const banner = BANNERS[searchParams.get('status') ?? '']

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Auszahlungen</h1>
      <p className="mb-4 text-sm text-neutral-400">
        Events und Produkte können erst veröffentlicht werden, wenn dein Stripe-Konto vollständig eingerichtet ist —
        darüber laufen alle Auszahlungen an dich.
      </p>

      {banner && (
        <p
          className={
            banner.tone === 'error'
              ? 'mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300'
              : 'mb-4 rounded-lg border border-cyan-900 bg-cyan-950/40 p-3 text-sm text-cyan-200'
          }
        >
          {banner.text}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
      )}

      {account === undefined && !error && <p className="text-sm text-neutral-400">Lade Status …</p>}

      {account !== undefined && (
        <div className="rounded-xl border border-neutral-800 p-4">
          {account && (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-neutral-300">
                Auszahlungen {account.payoutsEnabled ? 'aktiviert' : 'noch nicht aktiviert'}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_CLASS[account.onboardingState]}`}>
                {STATE_LABEL[account.onboardingState]}
              </span>
            </div>
          )}
          {!account && <p className="mb-4 text-sm text-neutral-400">Noch kein Stripe-Konto verbunden.</p>}

          {(!account || account.onboardingState !== 'complete') && (
            <button
              type="button"
              onClick={startOnboarding}
              disabled={redirecting}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {redirecting ? 'Öffne Stripe …' : account ? 'Onboarding fortsetzen' : 'Stripe-Konto verbinden'}
            </button>
          )}
          {account?.onboardingState === 'complete' && (
            <button
              type="button"
              onClick={startOnboarding}
              disabled={redirecting}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 disabled:opacity-50"
            >
              {redirecting ? 'Öffne Stripe …' : 'Kontodaten bei Stripe aktualisieren'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

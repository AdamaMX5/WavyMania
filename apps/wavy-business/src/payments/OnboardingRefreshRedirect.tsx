import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import * as paymentsClient from './paymentsClient'

// Stripe sends the merchant here when their Account Link expired or was otherwise
// invalidated before they finished onboarding (e.g. they navigated back). Per
// Stripe's own guidance for this case, the fix is simply to mint a fresh link and
// send them straight back — not to show a dead end requiring a manual click.
export function OnboardingRefreshRedirect() {
  const { accessToken } = useAuth()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    paymentsClient
      .refreshOnboardingLink(accessToken)
      .then(({ onboardingUrl }) => {
        if (!cancelled) window.location.replace(onboardingUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [accessToken])

  if (failed) return <Navigate to="/auszahlungen?status=refresh-failed" replace />
  return <p className="p-6 text-sm text-neutral-400">Onboarding wird fortgesetzt …</p>
}

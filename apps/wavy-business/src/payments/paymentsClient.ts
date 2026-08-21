// PaymentService is now deployed under a stable domain, same as
// eventClient.ts/marketClient.ts — hardcoded default, overridable via
// VITE_PAYMENT_SERVICE_URL (root .env). Set that var to /api/payment for
// local dev against a local PaymentService instance, proxied by Vite (see
// vite.config.ts) — PaymentService itself sends no CORS headers by design
// (CORS is handled at the NGINX layer in production).
const PAYMENT_BASE_URL = import.meta.env.VITE_PAYMENT_SERVICE_URL || 'https://payment.freischule.info'

export class PaymentApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'PaymentApiError'
    this.status = status
  }
}

interface RequestOptions extends RequestInit {
  accessToken: string
}

async function request<T>(path: string, { accessToken, headers, ...init }: RequestOptions): Promise<T> {
  const res = await fetch(`${PAYMENT_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error ?? message
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new PaymentApiError(message, res.status)
  }

  return (await res.json()) as T
}

export type OnboardingState = 'pending' | 'complete' | 'restricted'

export interface MerchantAccount {
  onboardingState: OnboardingState
  payoutsEnabled: boolean
}

// `null` means "no Connect account yet" (PaymentService's 404) — a normal, common
// state for a merchant/organizer who hasn't started onboarding, not an error to
// surface. Any other failure (network, 401, 403 for a role PaymentService doesn't
// recognize) still throws PaymentApiError for the caller to show.
export async function getMerchantAccount(accessToken: string): Promise<MerchantAccount | null> {
  try {
    return await request<MerchantAccount>('/accounts/me', { accessToken })
  } catch (err) {
    if (err instanceof PaymentApiError && err.status === 404) return null
    throw err
  }
}

export function createAccount(accessToken: string) {
  return request<{ onboardingUrl: string }>('/accounts', { method: 'POST', accessToken })
}

export function refreshOnboardingLink(accessToken: string) {
  return request<{ onboardingUrl: string }>('/accounts/me/onboarding-link', { method: 'POST', accessToken })
}

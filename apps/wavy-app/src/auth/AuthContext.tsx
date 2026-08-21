import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import * as authClient from './authClient'
import { getDeviceFingerprint, getDeviceName } from './deviceFingerprint'
import { decodeAccessToken } from './jwt'
import { getAccessToken, refreshAccessToken, setAccessToken, subscribe } from './tokenStore'

interface AuthUser {
  id: string
  email: string
  roles: string[]
}

interface AuthState {
  status: 'anon' | 'authenticated' | 'loading'
  user: AuthUser | null
  accessToken: string | null
  verifyEmailPending: boolean
}

interface AuthContextValue extends AuthState {
  checkEmail: (email: string) => Promise<authClient.CheckEmailStatus>
  login: (email: string, password: string) => Promise<void>
  registerComplete: (email: string, password: string, repassword: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // tokenStore is the single source of truth for the access token (shared
  // with every service client outside the component tree, see
  // ../lib/apiRequest.ts) — this just projects it into React state.
  const accessToken = useSyncExternalStore(subscribe, getAccessToken)
  const [verifyEmailPending, setVerifyEmailPending] = useState(false)
  // Starts false: a page load/reload has no in-memory access token yet, but
  // the httpOnly refresh_token cookie (14 days) may still be valid — see the
  // bootstrap effect below. `status` stays 'loading' until that first
  // /user/refresh attempt (success or failure) resolves, so the UI never
  // flashes "please log in" for a user whose session is actually intact.
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    let cancelled = false
    refreshAccessToken().finally(() => {
      if (!cancelled) setBootstrapped(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const claims = accessToken ? decodeAccessToken(accessToken) : null
  const user: AuthUser | null = claims ? { id: claims.sub, email: claims.email, roles: claims.roles } : null
  const status: AuthState['status'] = !bootstrapped ? 'loading' : user ? 'authenticated' : 'anon'

  const value: AuthContextValue = {
    status,
    user,
    accessToken,
    verifyEmailPending,
    checkEmail: async (email) => {
      const { status } = await authClient.checkEmail(email)
      return status
    },
    login: async (email, password) => {
      const session = await authClient.login(email, password, getDeviceFingerprint(), getDeviceName())
      setAccessToken(session.access_token)
      setVerifyEmailPending(session.status === 'login_with_verify_email_send')
    },
    registerComplete: async (email, password, repassword) => {
      const session = await authClient.registerComplete(
        email,
        password,
        repassword,
        getDeviceFingerprint(),
        getDeviceName(),
      )
      setAccessToken(session.access_token)
      setVerifyEmailPending(session.status === 'login_with_verify_email_send')
    },
    requestPasswordReset: async (email) => {
      await authClient.passwordResetRequest(email)
    },
    logout: async () => {
      try {
        await authClient.logout()
      } finally {
        setAccessToken(null)
        setVerifyEmailPending(false)
      }
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

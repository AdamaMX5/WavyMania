import { createContext, useContext, useState, type ReactNode } from 'react'
import * as authClient from './authClient'
import { getDeviceFingerprint, getDeviceName } from './deviceFingerprint'

interface AuthUser {
  id: string
  email: string
  roles: string[]
}

interface AuthState {
  status: 'anon' | 'authenticated'
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

const ANON_STATE: AuthState = {
  status: 'anon',
  user: null,
  accessToken: null,
  verifyEmailPending: false,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(ANON_STATE)

  const applySession = (session: authClient.AuthSession) => {
    setState({
      status: 'authenticated',
      user: { id: session.id, email: session.email, roles: session.roles },
      accessToken: session.access_token,
      verifyEmailPending: session.status === 'login_with_verify_email_send',
    })
  }

  const value: AuthContextValue = {
    ...state,
    checkEmail: async (email) => {
      const { status } = await authClient.checkEmail(email)
      return status
    },
    login: async (email, password) => {
      const session = await authClient.login(email, password, getDeviceFingerprint(), getDeviceName())
      applySession(session)
    },
    registerComplete: async (email, password, repassword) => {
      const session = await authClient.registerComplete(
        email,
        password,
        repassword,
        getDeviceFingerprint(),
        getDeviceName(),
      )
      applySession(session)
    },
    requestPasswordReset: async (email) => {
      await authClient.passwordResetRequest(email)
    },
    logout: async () => {
      try {
        await authClient.logout()
      } finally {
        setState(ANON_STATE)
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

const AUTH_BASE_URL = 'https://auth.freischule.info'

export type CheckEmailStatus = 'login' | 'register'

export interface AuthSession {
  id: string
  email: string
  roles: string[]
  access_token: string
  status: 'login' | 'login_with_verify_email_send' | 'register'
  last_login?: string
}

export class AuthApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${AUTH_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error ?? body?.detail ?? message
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new AuthApiError(message, res.status)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function checkEmail(email: string) {
  return request<{ status: CheckEmailStatus }>('/user/check-email', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function login(
  email: string,
  password: string,
  deviceFingerprint: string,
  deviceName: string,
) {
  return request<AuthSession>('/user/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      device_fingerprint: deviceFingerprint,
      device_name: deviceName,
    }),
  })
}

export function registerComplete(
  email: string,
  password: string,
  repassword: string,
  deviceFingerprint: string,
  deviceName: string,
) {
  return request<AuthSession>('/user/register-complete', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      repassword,
      device_fingerprint: deviceFingerprint,
      device_name: deviceName,
    }),
  })
}

export function passwordResetRequest(email: string) {
  return request<void>(`/user/password-reset-request?${new URLSearchParams({ email })}`, {
    method: 'POST',
  })
}

export function resetPassword(
  token: string,
  userId: string,
  newPassword: string,
  repassword: string,
) {
  const query = new URLSearchParams({
    token,
    user_id: userId,
    new_password: newPassword,
    repassword,
  })
  return request<{ status: string }>(`/user/reset-password?${query}`, {
    method: 'POST',
  })
}

export function logout() {
  return request<{ status: string }>('/user/logout', { method: 'POST' })
}

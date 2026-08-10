import { useState, type FormEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { resetPassword, AuthApiError } from './authClient'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const userId = params.get('user_id') ?? ''

  const [password, setPassword] = useState('')
  const [repassword, setRepassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  if (!token || !userId) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center text-neutral-300">
        <p>Dieser Link ist unvollständig. Bitte den Link aus der E-Mail erneut öffnen.</p>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== repassword) {
      setError('Passwörter stimmen nicht überein.')
      return
    }
    setError(null)
    setPending(true)
    try {
      await resetPassword(token, userId, password, repassword)
      setDone(true)
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Etwas ist schiefgelaufen. Bitte erneut versuchen.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm space-y-3 p-6 text-center text-neutral-300">
        <p>Passwort gesetzt. Du kannst dich jetzt anmelden.</p>
        <button onClick={() => navigate('/')} className="text-cyan-400 underline">
          Zur Anmeldung
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h2 className="mb-4 text-lg font-semibold text-neutral-100">Neues Passwort setzen</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="password"
          required
          minLength={8}
          autoFocus
          autoComplete="new-password"
          placeholder="Neues Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Passwort wiederholen"
          value={repassword}
          onChange={(e) => setRepassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
        >
          {pending ? 'Speichere …' : 'Passwort speichern'}
        </button>
      </form>
    </div>
  )
}

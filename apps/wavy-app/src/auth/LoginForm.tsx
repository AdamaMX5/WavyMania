import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthContext'
import { AuthApiError } from './authClient'

type Step = 'email' | 'login' | 'register' | 'forgot' | 'forgot-sent'

export function LoginForm() {
  const auth = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repassword, setRepassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const runAction = async (action: () => Promise<void>) => {
    setError(null)
    setPending(true)
    try {
      await action()
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Etwas ist schiefgelaufen. Bitte erneut versuchen.')
    } finally {
      setPending(false)
    }
  }

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault()
    runAction(async () => {
      const status = await auth.checkEmail(email)
      setStep(status)
    })
  }

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault()
    runAction(() => auth.login(email, password))
  }

  const handleRegisterSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== repassword) {
      setError('Passwörter stimmen nicht überein.')
      return
    }
    runAction(() => auth.registerComplete(email, password, repassword))
  }

  const handleForgotSubmit = (e: FormEvent) => {
    e.preventDefault()
    runAction(async () => {
      await auth.requestPasswordReset(email)
      setStep('forgot-sent')
    })
  }

  const backToEmail = () => {
    setStep('email')
    setPassword('')
    setRepassword('')
    setError(null)
  }

  return (
    <div className="mx-auto max-w-sm rounded-2xl bg-neutral-900 p-6">
      <h2 className="mb-1 text-lg font-semibold text-neutral-100">Anmelden</h2>
      <p className="mb-4 text-sm text-neutral-400">
        Melde dich an, um Waves zu erstellen, Tickets zu sehen und mitzumachen.
      </p>

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="deine@email.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            {pending ? 'Prüfe …' : 'Weiter'}
          </button>
        </form>
      )}

      {step === 'login' && (
        <form onSubmit={handleLoginSubmit} className="space-y-3">
          <p className="text-sm text-neutral-400">
            {email} · <button type="button" onClick={backToEmail} className="text-cyan-400 underline">ändern</button>
          </p>
          <input
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-neutral-100 outline-none focus:border-cyan-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            {pending ? 'Melde an …' : 'Anmelden'}
          </button>
          <button
            type="button"
            onClick={() => setStep('forgot')}
            className="w-full text-center text-sm text-neutral-400 underline"
          >
            Passwort vergessen?
          </button>
        </form>
      )}

      {step === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="space-y-3">
          <p className="text-sm text-neutral-400">
            {email} ist neu bei WavyMania ·{' '}
            <button type="button" onClick={backToEmail} className="text-cyan-400 underline">ändern</button>
          </p>
          <input
            type="password"
            required
            autoFocus
            minLength={8}
            autoComplete="new-password"
            placeholder="Passwort festlegen"
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
            {pending ? 'Lege Konto an …' : 'Konto erstellen'}
          </button>
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={handleForgotSubmit} className="space-y-3">
          <p className="text-sm text-neutral-400">
            Wir schicken einen Link an <span className="text-neutral-200">{email}</span>, um ein neues Passwort zu setzen.
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-cyan-500 px-3 py-2 font-medium text-neutral-950 disabled:opacity-50"
          >
            {pending ? 'Sende …' : 'Link zum Passwort-setzen schicken'}
          </button>
          <button type="button" onClick={() => setStep('login')} className="w-full text-center text-sm text-neutral-400 underline">
            Zurück
          </button>
        </form>
      )}

      {step === 'forgot-sent' && (
        <div className="space-y-3 text-sm text-neutral-300">
          <p>Falls {email} bei uns bekannt ist, ist ein Link zum Passwort-setzen unterwegs. Bitte Posteingang prüfen.</p>
          <button type="button" onClick={backToEmail} className="w-full text-center text-cyan-400 underline">
            Zurück zur Anmeldung
          </button>
        </div>
      )}
    </div>
  )
}

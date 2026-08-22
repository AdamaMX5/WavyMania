import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createIssue, GitApiError, type CreateIssueResult } from './gitClient'

type FeedbackType = 'idea' | 'bug'

const TYPE_META: Record<FeedbackType, { label: string; icon: string; titlePrefix: string; placeholder: string }> = {
  idea: { label: 'Idee', icon: '💡', titlePrefix: '[Idee]', placeholder: 'Was schwebt dir vor?' },
  bug: { label: 'Bug', icon: '🐛', titlePrefix: '[Bug]', placeholder: 'Was ist passiert? Was hättest du erwartet?' },
}

// Floating "lightbulb" entry point, mounted once at the app root inside Gate (see App.tsx)
// so it's reachable from every screen and always has an authenticated user — GitService's
// POST /issue requires a JWT (see GitService.md), and Gate already blocks unauthenticated/
// role-less access before any children (including this widget) ever render.
// Files an idea or a bug report as a GitService issue (see gitClient.ts), tagged with a
// `wavy-business` label and a body footer so the dev team can tell it apart from the same
// widget in wavy-app (mirrors that app's own feedback/FeedbackWidget.tsx).
export function FeedbackWidget() {
  const { accessToken } = useAuth()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('idea')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateIssueResult | null>(null)

  function handleClose() {
    setOpen(false)
    setType('idea')
    setTitle('')
    setDescription('')
    setError(null)
    setResult(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSubmitting(true)
    setError(null)
    try {
      const issue = await createIssue(
        {
          title: `${TYPE_META[type].titlePrefix} ${title.trim()}`,
          body: `${description.trim()}\n\n— gemeldet aus WavyBusiness`,
          labels: [type, 'wavy-business'],
        },
        accessToken,
      )
      setResult(issue)
    } catch (err) {
      setError(err instanceof GitApiError ? err.message : 'Feedback konnte nicht gesendet werden.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Idee oder Bug melden"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-2xl shadow-lg shadow-amber-500/30"
      >
        💡
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={handleClose}>
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-xl font-semibold text-neutral-100">💡 Idee oder Bug melden</h2>
              <button onClick={handleClose} className="text-neutral-500">
                ✕
              </button>
            </div>

            {result ? (
              <div className="space-y-3">
                <p className="text-sm text-neutral-300">Danke! Issue #{result.number} wurde angelegt.</p>
                <a href={result.url} target="_blank" rel="noreferrer" className="block text-sm text-cyan-400 underline">
                  Auf GitHub ansehen
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full rounded-lg bg-neutral-800 py-2 text-sm text-neutral-200"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-2">
                  {(Object.keys(TYPE_META) as FeedbackType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        type === t
                          ? 'border-amber-500 bg-amber-950/30 text-amber-300'
                          : 'border-neutral-700 text-neutral-300'
                      }`}
                    >
                      {TYPE_META[t].icon} {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={120}
                  placeholder="Kurzer Titel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
                />
                <textarea
                  required
                  rows={4}
                  maxLength={4000}
                  placeholder={TYPE_META[type].placeholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500"
                />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-amber-500 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
                >
                  {submitting ? 'Senden …' : 'Senden'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

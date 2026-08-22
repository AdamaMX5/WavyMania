import { fetchWithRefresh } from '../lib/apiRequest'

// GitService is existing shared platform infrastructure with a stable production
// domain already (same rationale as authClient.ts) — hardcoded default URL,
// overridable via VITE_GIT_SERVICE_URL (root .env, shared with wavy-app).
const GIT_BASE_URL = import.meta.env.VITE_GIT_SERVICE_URL || 'https://git.freischule.info'

// The GitHub/Gitea repo GitService creates issues in (see GitService.md's `repo` param,
// validated server-side against /^[a-zA-Z0-9_.-]{1,100}$/) — matches this monorepo's actual
// name (`git remote -v` → github.com/AdamaMX5/WavyMania), overridable in case it ever changes.
const GIT_SERVICE_REPO = import.meta.env.VITE_GIT_SERVICE_REPO || 'WavyMania'

export class GitApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitApiError'
    this.status = status
  }
}

export interface CreateIssueInput {
  title: string
  body: string
  labels?: string[]
}

export interface CreateIssueResult {
  number: number
  url: string
}

// POST /issue requires a logged-in user's JWT (see GitService.md's Frontend section) — the
// creator's email is stored server-side for later notification, so accessToken is required
// here, unlike the optional-auth guest-checkout clients elsewhere in the platform.
export async function createIssue(input: CreateIssueInput, accessToken: string): Promise<CreateIssueResult> {
  const res = await fetchWithRefresh(`${GIT_BASE_URL}/issue`, {
    method: 'POST',
    body: JSON.stringify({ repo: GIT_SERVICE_REPO, ...input }),
    accessToken,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body?.error ?? message
    } catch {
      // response had no JSON body — keep statusText
    }
    throw new GitApiError(message, res.status)
  }

  return (await res.json()) as CreateIssueResult
}

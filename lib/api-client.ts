/**
 * Browser fetch wrapper for the app's own /api routes.
 *
 * - Adds `Authorization: Bearer <localStorage authToken>` (unless the caller set one).
 * - Adds `Content-Type: application/json` when the body is a string.
 * - On 401 it does what useAuth already did for /api/user: refresh the access token once
 *   through POST /api/auth/refresh (httpOnly refresh cookie) and retry the request once.
 *   If the refresh fails the original 401 response is returned, so callers keep their
 *   current "Unauthorized" handling.
 */

export const AUTH_TOKEN_KEY = 'authToken'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

let refreshing: Promise<string | null> | null = null

/** Refresh the access token (single in-flight request shared by all callers). */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
    .then(async (res) => {
      if (!res.ok) return null
      const { token } = await res.json()
      if (!token) return null
      localStorage.setItem(AUTH_TOKEN_KEY, token)
      return token as string
    })
    .catch((error) => {
      console.error('Token refresh failed:', error)
      return null
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers)
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    if (typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    return fetch(input, { ...init, headers })
  }

  const token = getAuthToken()
  const res = await send(token)
  if (res.status !== 401 || !token) return res

  const fresh = await refreshAccessToken()
  return fresh ? send(fresh) : res
}

/**
 * apiFetch + JSON in/out. `body` is serialised with JSON.stringify; a non-2xx status
 * throws `Error('Request failed with status code N')`; an empty/non-JSON body gives `undefined`.
 */
export async function apiJson<T>(
  input: string | URL,
  { body, ...init }: Omit<RequestInit, 'body'> & { body?: unknown } = {}
): Promise<T> {
  const res = await apiFetch(input, body === undefined ? init : { ...init, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Request failed with status code ${res.status}`)
  return (await res.json().catch(() => undefined)) as T
}

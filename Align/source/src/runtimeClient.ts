export type RuntimeConfig = {
  enabled?: boolean
  mode?: 'local' | 'remote'
  remote?: boolean
  label?: string
}

let cachedSessionToken: string | null = null

export function getSessionToken(): string {
  if (cachedSessionToken !== null) return cachedSessionToken
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  cachedSessionToken = new URLSearchParams(hash).get('session') || ''
  return cachedSessionToken
}

export function authorizedRequestInit(options: RequestInit = {}): RequestInit {
  const headers = new Headers(options.headers)
  const token = getSessionToken()
  if (token) headers.set('x-brainana-session', token)
  return { ...options, headers }
}

export async function authorizedFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, authorizedRequestInit(options))
}

export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await authorizedFetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = (payload as { error?: string }).error || `Request failed (${response.status})`
    throw new Error(message)
  }
  return payload as T
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  return requestJson<RuntimeConfig>('/api/config')
}

export function isRemoteRuntime(config: RuntimeConfig | null | undefined): boolean {
  return config?.mode === 'remote' || config?.remote === true
}

import { authorizedFetch, requestJson } from './runtimeClient'

export type RemoteEndpoint = { baseUrl: string; sessionToken: string; initialPath?: string }
let endpoint: RemoteEndpoint | null = null
const listeners = new Set<(value: RemoteEndpoint | null) => void>()

export function setRemoteEndpoint(value: RemoteEndpoint | null): void {
  endpoint = value
  for (const listener of listeners) listener(endpoint)
}

export function getRemoteEndpoint(): RemoteEndpoint | null { return endpoint }

export function onRemoteEndpointChange(listener: (value: RemoteEndpoint | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function remoteFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!endpoint) return authorizedFetch(url, options)
  const headers = new Headers(options.headers)
  headers.set('x-brainana-session', endpoint.sessionToken)
  return fetch(`${endpoint.baseUrl}${url}`, { ...options, headers })
}

export async function remoteJson<T>(url: string, options?: RequestInit): Promise<T> {
  if (!endpoint) return requestJson<T>(url, options)
  const response = await remoteFetch(url, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((payload as { error?: string }).error || `Remote request failed (${response.status})`)
  return payload as T
}

import { authorizedFetch, requestJson } from './runtimeClient'

export type ServerEntry = { name: string; path: string; directory: boolean }
export type ServerList = { path: string; parent: string | null; entries: ServerEntry[] }
export type SaveResult = { path?: string; exists?: boolean }

export function joinServerPath(a: string, b: string): string {
  return [a, b].filter(Boolean).join('/').replace(/\/{2,}/g, '/')
}

export async function listVolumeEntries(path = ''): Promise<ServerList> {
  return requestJson<ServerList>(`/api/list?path=${encodeURIComponent(path)}`)
}

export async function readVolumeFile(path: string, signal?: AbortSignal): Promise<File> {
  const response = await authorizedFetch(`/api/file?path=${encodeURIComponent(path)}`, { signal })
  if (!response.ok) throw new Error((await response.text()) || `Unable to load ${path}`)
  const blob = await response.blob()
  return new File([blob], path.split('/').pop() || 'volume', {
    type: blob.type || 'application/octet-stream',
  })
}

export async function listExportDirectories(path = ''): Promise<ServerList> {
  return requestJson<ServerList>(`/api/save-list?path=${encodeURIComponent(path)}`)
}

export async function createExportDirectory(path: string): Promise<void> {
  await requestJson('/api/save-mkdir', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

export async function saveRemoteBlob(path: string, blob: Blob, overwrite: boolean): Promise<SaveResult> {
  const response = await authorizedFetch(
    `/api/save-file?path=${encodeURIComponent(path)}&overwrite=${overwrite ? '1' : '0'}`,
    {
      method: 'POST',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    },
  )
  const payload = await response.json().catch(() => ({})) as { error?: string; path?: string }
  if (response.status === 409) return { exists: true }
  if (!response.ok) throw new Error(payload.error || `Workstation save failed (${response.status})`)
  return { path: payload.path }
}


export type LocalExportFolder = { selected: boolean; path?: string; name?: string }

export async function chooseLocalExportFolder(): Promise<LocalExportFolder> {
  return requestJson<LocalExportFolder>('/api/local-export-folder/select', { method: 'POST' })
}

export async function getLocalExportFolder(): Promise<LocalExportFolder> {
  return requestJson<LocalExportFolder>('/api/local-export-folder')
}

export async function saveLocalExportBlob(filename: string, blob: Blob, overwrite: boolean): Promise<SaveResult> {
  const response = await authorizedFetch(
    `/api/local-export-file?filename=${encodeURIComponent(filename)}&overwrite=${overwrite ? '1' : '0'}`,
    {
      method: 'POST',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    },
  )
  const payload = await response.json().catch(() => ({})) as { error?: string; path?: string }
  if (response.status === 409) return { exists: true }
  if (!response.ok) throw new Error(payload.error || `Local export failed (${response.status})`)
  return { path: payload.path }
}

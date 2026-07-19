// Export destinations. The primary path is SERVER-SIDE export (identical for local and
// remote sources, no per-browser branching). A universal ZIP download is the fallback when
// there is no writable source (or the user just wants a bundle).
import { zipSync, type Zippable } from 'fflate'
import { sourceBase, type RuntimeClient } from './runtimeClient.ts'

export interface SaveResult {
  path: string
  bytes?: number
  exists?: boolean
}

export class ServerExport {
  #client: RuntimeClient

  constructor(client: RuntimeClient) {
    this.#client = client
  }

  listFolders(sourceId: string, rel = ''): Promise<{ path: string; entries: Array<{ name: string; path: string }> }> {
    return this.#client.apiJson(`${sourceBase(sourceId)}/save-list?path=${encodeURIComponent(rel)}`)
  }

  mkdir(sourceId: string, rel: string): Promise<{ path: string }> {
    return this.#client.apiJson(`${sourceBase(sourceId)}/save-mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: rel }),
    })
  }

  /** Write a file into the source. Returns { exists:true } (409) when overwrite is refused. */
  async saveFile(sourceId: string, rel: string, data: BlobPart, overwrite = false): Promise<SaveResult> {
    const res = await this.#client.apiFetch(`${sourceBase(sourceId)}/save-file?path=${encodeURIComponent(rel)}&overwrite=${overwrite ? '1' : '0'}`, {
      method: 'POST',
      body: new Blob([data]),
    })
    // A 5xx/HTML error body would make res.json() throw a raw SyntaxError; parse defensively so
    // the caller gets the intended `Save failed (status)` message instead.
    const text = await res.text()
    let body: SaveResult & { error?: string } = {} as SaveResult
    try {
      if (text) body = JSON.parse(text)
    } catch {
      // non-JSON body (e.g. an error page) — fall through to the status-based message
    }
    if (res.status === 409) return { path: body.path ?? rel, exists: true }
    if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`)
    return body
  }
}

/** Build a ZIP Blob from named byte payloads (universal client-side fallback). */
export function buildZip(files: Record<string, Uint8Array>): Blob {
  const zipped = zipSync(files as Zippable)
  // Copy into a fresh ArrayBuffer-backed view so the Blob owns standalone bytes.
  return new Blob([zipped.slice()], { type: 'application/zip' })
}

/** Trigger a browser download of a Blob under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

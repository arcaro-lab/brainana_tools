import type { Modality } from './workstationBrowser'
import { readVolumeFile } from './filesystemClient'

export type RemoteLoadProgress = (message: string) => void

export class RemoteVolumeLoader {
  private controller: AbortController | null = null

  get loading(): boolean {
    return this.controller !== null
  }

  cancel(): void {
    this.controller?.abort()
  }

  async load(
    modality: Modality,
    paths: string[],
    loadFiles: (modality: Modality, files: File[]) => Promise<void>,
    progress: RemoteLoadProgress,
  ): Promise<'loaded' | 'cancelled'> {
    this.cancel()
    const controller = new AbortController()
    this.controller = controller
    try {
      const files: File[] = []
      for (let index = 0; index < paths.length; index += 1) {
        const path = paths[index]
        progress(`Loading ${index + 1} of ${paths.length}: ${path.split('/').pop() || path}…`)
        files.push(await readVolumeFile(path, controller.signal))
      }
      await loadFiles(modality, files)
      return 'loaded'
    } catch (error) {
      if (controller.signal.aborted) return 'cancelled'
      throw error
    } finally {
      if (this.controller === controller) this.controller = null
    }
  }
}

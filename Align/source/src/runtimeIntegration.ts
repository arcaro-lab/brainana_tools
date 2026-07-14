import { installExportDestination } from './exportDestination'
import { isRemoteRuntime, loadRuntimeConfig } from './runtimeClient'
import {
  createWorkstationBrowser,
  type LoadFiles,
  type Status,
} from './workstationBrowser'

export type { Modality } from './workstationBrowser'
export type { RuntimeConfig } from './runtimeClient'
export type { ServerEntry, ServerList } from './filesystemClient'

/**
 * Installs the browser-facing runtime adapters.
 *
 * This module intentionally contains no file-browser, transfer, or export UI
 * implementation. It only composes the smaller runtime modules.
 */
export function installRuntimeIntegration(loadFiles: LoadFiles, setStatus: Status): void {
  installExportDestination()
  const workstationBrowser = createWorkstationBrowser(loadFiles, setStatus)
  void loadRuntimeConfig()
    .then(config => {
      if (isRemoteRuntime(config)) workstationBrowser.installButtons()
    })
    .catch(error => {
      console.warn('Unable to read runtime configuration; workstation controls remain disabled.', error)
    })
}

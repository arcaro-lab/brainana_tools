import {
  chooseLocalExportFolder,
  createExportDirectory,
  joinServerPath,
  listExportDirectories,
  saveLocalExportBlob,
  saveRemoteBlob,
} from './filesystemClient'
import { isRemoteRuntime, loadRuntimeConfig, type RuntimeConfig } from './runtimeClient'

type ExportState = {
  remote: boolean
  configLoaded: boolean
  destination: 'local' | 'workstation'
  localPath: string
  localSelected: boolean
  remotePath: string
  remoteSelected: boolean
  chain: Promise<void>
  browsePath: string
}

declare global {
  interface Window {
    brainanaAlignSaveBlob?: (blob: Blob, filename: string) => Promise<void>
  }
}

const cleanName = (name: string): string =>
  String(name || 'brainana-align-output').replace(/[\\/:*?"<>|]/g, '_')

const escapeHtml = (value: string): string => value.replace(
  /[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
)

function directDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}

export function installExportDestination(): void {
  const state: ExportState = {
    remote: false,
    configLoaded: false,
    destination: 'local',
    localPath: '',
    localSelected: false,
    remotePath: '',
    remoteSelected: false,
    chain: Promise.resolve(),
    browsePath: '',
  }
  let config: RuntimeConfig | null = null

  const style = document.createElement('style')
  style.dataset.brainanaModule = 'export-destination'
  style.textContent = `
    #ba-export-panel{margin:12px 0;padding:12px;border:1px solid #59606b;border-radius:8px;background:#20252c}#ba-folder-controls{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}
    #ba-folder-path{font-size:12px;color:#aeb8c6;overflow-wrap:anywhere}#ba-export-status{min-height:18px;margin-top:8px;font-size:12px}
    .ba-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center}.ba-dialog{width:min(680px,90vw);max-height:80vh;background:#242a32;border:1px solid #697382;border-radius:10px;display:flex;flex-direction:column}
    .ba-dialog header{padding:14px 16px;font-weight:700;border-bottom:1px solid #4d5663}.ba-nav,.ba-actions{padding:10px 14px;display:flex;gap:8px;align-items:center}.ba-list{min-height:220px;overflow:auto;border-top:1px solid #404854;border-bottom:1px solid #404854}.ba-folder-row{width:100%;text-align:left;border:0;border-bottom:1px solid #38404a;border-radius:0;background:transparent;padding:10px 14px;display:flex;gap:10px}.ba-actions{justify-content:flex-end}.ba-empty{padding:16px;color:#aab4c0}.ba-msg{padding:0 14px;min-height:20px;color:#ff9696}
  `
  document.head.appendChild(style)

  const exportBody = document.querySelector('#export-modal .modal-card')
  const panel = document.createElement('div')
  panel.id = 'ba-export-panel'
  panel.innerHTML = `<div id="ba-destination-row"><label>Export destination <select id="ba-destination"><option value="local">This Mac</option><option value="workstation">Workstation</option></select></label></div><div id="ba-folder-controls"><button id="ba-folder-button" type="button">Choose local export folder</button><span id="ba-folder-path">Browser downloads if no folder is selected</span></div><div id="ba-export-status"></div>`
  exportBody?.insertBefore(panel, exportBody.querySelector('.export-grid'))

  const exportStatus = panel.querySelector<HTMLElement>('#ba-export-status')!
  const exportSetStatus = (message: string, error = false): void => {
    exportStatus.textContent = message
    exportStatus.style.color = error ? '#ff9696' : '#b7c1cf'
  }

  const folderOverlay = document.createElement('div')
  folderOverlay.className = 'ba-overlay'
  folderOverlay.innerHTML = `<div class="ba-dialog" role="dialog" aria-modal="true" tabindex="-1"><header>Choose workstation export folder</header><div class="ba-nav"><button id="ba-remote-up">Up</button><button id="ba-remote-new">New folder</button><code id="ba-remote-path">/</code></div><div id="ba-remote-list" class="ba-list"></div><div id="ba-remote-msg" class="ba-msg"></div><div class="ba-actions"><button id="ba-remote-cancel">Cancel</button><button id="ba-remote-select" class="primary">Select this folder</button></div></div>`
  document.body.appendChild(folderOverlay)

  const renderPanel = (): void => {
    panel.querySelector<HTMLElement>('#ba-destination-row')!.style.display = state.remote ? 'block' : 'none'
    if (!state.remote) state.destination = 'local'
    panel.querySelector<HTMLSelectElement>('#ba-destination')!.value = state.destination
    const button = panel.querySelector<HTMLButtonElement>('#ba-folder-button')!
    const path = panel.querySelector<HTMLElement>('#ba-folder-path')!
    if (state.remote && state.destination === 'workstation') {
      button.textContent = 'Choose workstation export folder'
      path.textContent = state.remoteSelected
        ? (`/${state.remotePath}`.replace(/\/$/, '') || '/')
        : 'No workstation folder selected'
    } else {
      button.textContent = 'Choose local export folder'
      path.textContent = state.localSelected
        ? state.localPath
        : 'Browser downloads if no folder is selected'
    }
  }

  async function refreshConfig(): Promise<void> {
    try {
      config = await loadRuntimeConfig()
      state.remote = isRemoteRuntime(config)
    } catch {
      config = null
      state.remote = false
    }
    state.configLoaded = true
    renderPanel()
  }

  async function saveLocal(blob: Blob, filename: string): Promise<void> {
    if (!state.localSelected) {
      directDownload(blob, filename)
      exportSetStatus(`Downloaded locally: ${filename}`)
      return
    }
    let result = await saveLocalExportBlob(filename, blob, false)
    if (result.exists) {
      if (!window.confirm(`${filename} already exists in the selected folder. Replace it?`)) throw new Error('Save cancelled.')
      result = await saveLocalExportBlob(filename, blob, true)
    }
    exportSetStatus(`Saved locally: ${result.path || filename}`)
  }

  async function saveRemote(blob: Blob, filename: string): Promise<void> {
    if (!state.remoteSelected) throw new Error('Choose a workstation export folder before exporting.')
    const relative = joinServerPath(state.remotePath, filename)
    let result = await saveRemoteBlob(relative, blob, false)
    if (result.exists) {
      if (!window.confirm(`/${relative} already exists. Replace it?`)) throw new Error('Save cancelled.')
      result = await saveRemoteBlob(relative, blob, true)
    }
    exportSetStatus(`Saved to workstation: /${result.path || relative}`)
  }

  window.brainanaAlignSaveBlob = (blob, filename) => {
    state.chain = state.chain
      .then(async () => {
        const safe = cleanName(filename)
        if (!state.configLoaded) await refreshConfig()
        exportSetStatus(`Saving ${safe}…`)
        if (state.remote && state.destination === 'workstation') await saveRemote(blob, safe)
        else await saveLocal(blob, safe)
      })
      .catch(error => {
        exportSetStatus(error instanceof Error ? error.message : String(error), true)
        console.error(error)
      })
    return state.chain
  }

  async function listRemote(path = ''): Promise<void> {
    const data = await listExportDirectories(path)
    state.browsePath = data.path || ''
    folderOverlay.querySelector<HTMLElement>('#ba-remote-path')!.textContent =
      `/${state.browsePath}`.replace(/\/$/, '') || '/'
    const list = folderOverlay.querySelector<HTMLElement>('#ba-remote-list')!
    list.innerHTML = ''
    if (!data.entries.length) list.innerHTML = '<div class="ba-empty">No subfolders</div>'
    for (const entry of data.entries.filter(item => item.directory)) {
      const button = document.createElement('button')
      button.className = 'ba-folder-row'
      button.innerHTML = `<span>📁</span><span>${escapeHtml(entry.name)}</span>`
      button.addEventListener('click', () => {
        void listRemote(entry.path).catch(error => {
          folderOverlay.querySelector<HTMLElement>('#ba-remote-msg')!.textContent = error.message
        })
      })
      list.appendChild(button)
    }
    folderOverlay.querySelector<HTMLButtonElement>('#ba-remote-up')!.disabled = !state.browsePath
  }

  const closeFolder = (): void => { folderOverlay.style.display = 'none' }

  panel.querySelector<HTMLSelectElement>('#ba-destination')!.addEventListener('change', event => {
    state.destination = (event.target as HTMLSelectElement).value as 'local' | 'workstation'
    renderPanel()
  })
  panel.querySelector<HTMLButtonElement>('#ba-folder-button')!.addEventListener('click', async () => {
    try {
      await refreshConfig()
      if (state.remote && state.destination === 'workstation') {
        folderOverlay.style.display = 'flex'
        await listRemote(state.remoteSelected ? state.remotePath : '')
        return
      }
      const selected = await chooseLocalExportFolder()
      if (!selected.selected || !selected.path) return
      state.localSelected = true
      state.localPath = selected.path
      renderPanel()
      exportSetStatus(`Local export folder selected: ${selected.path}`)
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        exportSetStatus(error instanceof Error ? error.message : String(error), true)
      }
    }
  })
  folderOverlay.querySelector('#ba-remote-cancel')!.addEventListener('click', closeFolder)
  folderOverlay.querySelector('#ba-remote-select')!.addEventListener('click', () => {
    state.remotePath = state.browsePath
    state.remoteSelected = true
    closeFolder()
    renderPanel()
  })
  folderOverlay.querySelector('#ba-remote-up')!.addEventListener('click', () => {
    const parts = state.browsePath.split('/').filter(Boolean)
    parts.pop()
    void listRemote(parts.join('/')).catch(error => exportSetStatus(error.message, true))
  })
  folderOverlay.querySelector('#ba-remote-new')!.addEventListener('click', async () => {
    const name = window.prompt('Name for the new workstation folder:')
    if (!name) return
    try {
      await createExportDirectory(joinServerPath(state.browsePath, cleanName(name)))
      await listRemote(state.browsePath)
    } catch (error) {
      folderOverlay.querySelector<HTMLElement>('#ba-remote-msg')!.textContent =
        error instanceof Error ? error.message : String(error)
    }
  })

  void refreshConfig()
}

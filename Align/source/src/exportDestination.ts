import {
  chooseLocalExportFolder,
  createExportDirectory,
  joinServerPath,
  listExportDirectories,
  saveLocalExportBlob,
  saveRemoteBlob,
} from './filesystemClient'
import { isRemoteRuntime, loadRuntimeConfig, type RuntimeConfig } from './runtimeClient'
import { getRemoteEndpoint, onRemoteEndpointChange } from './remoteEndpoint'
import type { ServerEntry } from './filesystemClient'

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

const cleanPath = (value: string): string => value.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/')
const shownPath = (value: string): string => value ? `/${value}` : '/'
const shownDate = (seconds?: number): string => Number.isFinite(seconds)
  ? new Date(Number(seconds) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

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
  let remoteStartingPath = ''
  let remoteEntries: ServerEntry[] = []
  let remoteHistory: string[] = []
  let remoteHistoryIndex = -1
  let remoteShowHidden = false
  let remoteSortAscending = true
  let remoteSortKey: 'name' | 'modified' = 'name'

  const style = document.createElement('style')
  style.dataset.brainanaModule = 'export-destination'
  style.textContent = `
    #ba-export-panel{margin:12px 0;padding:12px;border:1px solid #59606b;border-radius:8px;background:#20252c}#ba-folder-controls{display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap}
    #ba-folder-path{font-size:12px;color:#aeb8c6;overflow-wrap:anywhere}#ba-export-status{min-height:18px;margin-top:8px;font-size:12px}
    .ba-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center}.ba-dialog{width:min(1040px,95vw);height:min(720px,86vh);background:#101e2c;border:1px solid #526a81;border-radius:10px;display:flex;flex-direction:column;overflow:hidden}
    .ba-dialog>.modal-head{flex:0 0 auto;margin:0;padding:14px 16px;border-bottom:1px solid #31475c}.ba-nav{flex:0 0 auto;padding:9px 12px;display:flex;gap:7px;align-items:center}.ba-nav button{min-width:34px}.ba-export-path{display:flex;align-items:center;flex:1;min-width:0;height:36px;padding:0 8px;border:1px solid #405b77;border-radius:7px;background:#0b1722;overflow:auto}.ba-export-crumb{border:0!important;background:transparent!important;padding:4px 5px!important;white-space:nowrap}.ba-export-separator{opacity:.45}.ba-export-path-input{display:none;flex:1;color:#e8eef6;background:transparent;border:0;outline:0;font:inherit}.ba-export-search{width:190px;color:#e8eef6;background:#0b1722;border:1px solid #405b77;border-radius:7px;padding:8px}
    .ba-export-body{display:grid;grid-template-columns:180px minmax(0,1fr);min-height:0;flex:1;overflow:hidden}.ba-export-sidebar{min-height:0;padding:10px 8px;border-right:1px solid #31475c;background:#0d1925;overflow:auto}.ba-export-sidebar h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;opacity:.65;margin:8px}.ba-export-sidebar button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px 10px}.ba-export-main{display:flex;min-width:0;min-height:0;overflow:hidden;flex-direction:column}.ba-list{flex:1 1 auto;min-height:0;overflow:auto}.ba-folder-table{width:100%;border-collapse:collapse;table-layout:fixed}.ba-folder-table th{position:sticky;top:0;background:#142536;text-align:left;padding:8px 10px;border-bottom:1px solid #40566c;cursor:pointer}.ba-folder-table th:first-child{width:65%}.ba-folder-row{border-bottom:1px solid #263a4d;cursor:default}.ba-folder-row:hover{background:#172b3d}.ba-folder-row td{padding:9px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ba-empty{padding:36px;text-align:center;color:#aab4c0}.ba-msg{flex:0 0 auto;padding:0 12px;min-height:20px;color:#ff9696}.ba-export-footer{display:flex;flex:0 0 auto;align-items:center;gap:10px;min-height:56px;padding:9px 12px;border-top:1px solid #31475c;background:#101e2c}.ba-export-footer .ba-actions{margin-left:auto;display:flex;gap:8px}.ba-export-hidden{display:flex;align-items:center;gap:5px;font-size:13px}
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
  folderOverlay.innerHTML = `<div class="ba-dialog" role="dialog" aria-modal="true" tabindex="-1"><div class="modal-head"><h2>Choose workstation export folder</h2><button id="ba-remote-close" aria-label="Close">×</button></div><div class="ba-nav"><button id="ba-export-back" title="Back" disabled>‹</button><button id="ba-export-forward" title="Forward" disabled>›</button><button id="ba-remote-up" title="Enclosing folder" disabled>↑</button><button id="ba-export-home" title="Starting directory">⌂</button><button id="ba-remote-new">New folder</button><div id="ba-export-path" class="ba-export-path" title="Double-click or press Command-L to enter a path"><input id="ba-export-path-input" class="ba-export-path-input" aria-label="Remote export path"></div><input id="ba-export-search" class="ba-export-search" type="search" placeholder="Search folders"></div><div class="ba-export-body"><aside class="ba-export-sidebar"><h3>Locations</h3><button data-export-location="start">⌂ Starting directory</button><button data-export-location="root">💻 Remote filesystem</button><button data-export-location="recent">🕘 Last export folder</button></aside><div class="ba-export-main"><div id="ba-remote-list" class="ba-list"><table class="ba-folder-table"><thead><tr><th data-export-sort="name">Name</th><th data-export-sort="modified">Date Modified</th></tr></thead><tbody></tbody></table><div id="ba-export-empty" class="ba-empty hidden"></div></div><div id="ba-remote-msg" class="ba-msg"></div><footer class="ba-export-footer"><label class="ba-export-hidden"><input id="ba-export-show-hidden" type="checkbox"> Show hidden folders</label><span id="ba-export-summary"></span><div class="ba-actions"><button id="ba-remote-cancel">Cancel</button><button id="ba-remote-select" class="primary">Select this folder</button></div></footer></div></div></div>`
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
      state.remote = isRemoteRuntime(config) || Boolean(getRemoteEndpoint())
    } catch {
      config = null
      state.remote = Boolean(getRemoteEndpoint())
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

  const exportSearch = folderOverlay.querySelector<HTMLInputElement>('#ba-export-search')!
  const exportPath = folderOverlay.querySelector<HTMLDivElement>('#ba-export-path')!
  const exportPathInput = folderOverlay.querySelector<HTMLInputElement>('#ba-export-path-input')!
  const exportFolderBody = folderOverlay.querySelector<HTMLTableSectionElement>('tbody')!
  const exportEmpty = folderOverlay.querySelector<HTMLDivElement>('#ba-export-empty')!
  const exportError = (error: unknown): void => {
    folderOverlay.querySelector<HTMLElement>('#ba-remote-msg')!.textContent = error instanceof Error ? error.message : String(error)
  }
  const updateExportNavigation = (): void => {
    folderOverlay.querySelector<HTMLButtonElement>('#ba-export-back')!.disabled = remoteHistoryIndex <= 0
    folderOverlay.querySelector<HTMLButtonElement>('#ba-export-forward')!.disabled = remoteHistoryIndex < 0 || remoteHistoryIndex >= remoteHistory.length - 1
    folderOverlay.querySelector<HTMLButtonElement>('#ba-remote-up')!.disabled = !state.browsePath
  }
  const renderExportPath = (): void => {
    exportPath.querySelectorAll(':scope > :not(input)').forEach(node => node.remove())
    const parts = state.browsePath.split('/').filter(Boolean)
    const add = (label: string, path: string): void => {
      if (exportPath.children.length > 1) { const separator = document.createElement('span'); separator.className = 'ba-export-separator'; separator.textContent = '›'; exportPath.insertBefore(separator, exportPathInput) }
      const crumb = document.createElement('button'); crumb.className = 'ba-export-crumb'; crumb.textContent = label; crumb.title = shownPath(path)
      crumb.addEventListener('click', () => { void listRemote(path).catch(exportError) }); exportPath.insertBefore(crumb, exportPathInput)
    }
    add('Remote', ''); parts.forEach((part, index) => add(part, parts.slice(0, index + 1).join('/')))
  }
  const renderExportFolders = (): void => {
    const term = exportSearch.value.trim().toLocaleLowerCase()
    const visible = remoteEntries
      .filter(entry => !term || entry.name.toLocaleLowerCase().includes(term))
      .sort((a, b) => {
        const comparison = remoteSortKey === 'name'
          ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
          : (a.modified ?? -1) - (b.modified ?? -1) || a.name.localeCompare(b.name)
        return remoteSortAscending ? comparison : -comparison
      })
    exportFolderBody.replaceChildren()
    for (const entry of visible) {
      const row = document.createElement('tr'); row.className = 'ba-folder-row'; row.tabIndex = 0
      const name = document.createElement('td'); name.textContent = `📁  ${entry.name}`
      const modified = document.createElement('td'); modified.textContent = shownDate(entry.modified); row.append(name, modified)
      const open = (): void => { void listRemote(entry.path).catch(exportError) }
      row.addEventListener('dblclick', open); row.addEventListener('click', open); row.addEventListener('keydown', event => { if (event.key === 'Enter') open() })
      exportFolderBody.appendChild(row)
    }
    exportEmpty.classList.toggle('hidden', visible.length > 0)
    exportEmpty.textContent = term ? 'No matching folders.' : 'No subfolders in this location.'
    folderOverlay.querySelector('#ba-export-summary')!.textContent = `${visible.length} folder${visible.length === 1 ? '' : 's'}`
  }
  async function listRemote(path = '', addHistory = true): Promise<void> {
    const data = await listExportDirectories(cleanPath(path), remoteShowHidden)
    state.browsePath = data.path || ''; remoteEntries = data.entries.filter(item => item.directory)
    if (addHistory && remoteHistory[remoteHistoryIndex] !== state.browsePath) { remoteHistory = remoteHistory.slice(0, remoteHistoryIndex + 1); remoteHistory.push(state.browsePath); remoteHistoryIndex = remoteHistory.length - 1 }
    try { localStorage.setItem('brainana.remote.lastExportPath', state.browsePath) } catch {}
    folderOverlay.querySelector<HTMLElement>('#ba-remote-msg')!.textContent = ''
    renderExportPath(); updateExportNavigation(); renderExportFolders()
  }
  const enterExportPath = (): void => { exportPathInput.value = shownPath(state.browsePath); exportPathInput.style.display = 'block'; exportPath.querySelectorAll('button,span').forEach(element => (element as HTMLElement).style.display = 'none'); exportPathInput.focus(); exportPathInput.select() }
  const leaveExportPath = (): void => { exportPathInput.style.display = 'none'; exportPath.querySelectorAll('button,span').forEach(element => (element as HTMLElement).style.display = '') }

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
        await listRemote(state.remoteSelected ? state.remotePath : state.browsePath)
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
  folderOverlay.querySelector('#ba-remote-close')!.addEventListener('click', closeFolder)
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
  folderOverlay.querySelector('#ba-export-back')!.addEventListener('click', () => { if (remoteHistoryIndex > 0) { remoteHistoryIndex -= 1; void listRemote(remoteHistory[remoteHistoryIndex], false).catch(exportError) } })
  folderOverlay.querySelector('#ba-export-forward')!.addEventListener('click', () => { if (remoteHistoryIndex < remoteHistory.length - 1) { remoteHistoryIndex += 1; void listRemote(remoteHistory[remoteHistoryIndex], false).catch(exportError) } })
  folderOverlay.querySelector('#ba-export-home')!.addEventListener('click', () => { void listRemote(remoteStartingPath).catch(exportError) })
  folderOverlay.querySelector<HTMLInputElement>('#ba-export-show-hidden')!.addEventListener('change', event => { remoteShowHidden = (event.currentTarget as HTMLInputElement).checked; void listRemote(state.browsePath, false).catch(exportError) })
  folderOverlay.querySelectorAll<HTMLElement>('[data-export-location]').forEach(button => button.addEventListener('click', () => { let target = button.dataset.exportLocation === 'root' ? '' : remoteStartingPath; if (button.dataset.exportLocation === 'recent') { try { target = localStorage.getItem('brainana.remote.lastExportPath') ?? state.browsePath } catch { target = state.browsePath } } void listRemote(target).catch(exportError) }))
  folderOverlay.querySelectorAll<HTMLElement>('[data-export-sort]').forEach(header => header.addEventListener('click', () => {
    const key = header.dataset.exportSort as 'name' | 'modified'
    if (remoteSortKey === key) remoteSortAscending = !remoteSortAscending
    else { remoteSortKey = key; remoteSortAscending = true }
    renderExportFolders()
  }))
  exportSearch.addEventListener('input', renderExportFolders)
  exportPath.addEventListener('dblclick', enterExportPath)
  exportPathInput.addEventListener('blur', leaveExportPath)
  exportPathInput.addEventListener('keydown', event => { if (event.key === 'Escape') leaveExportPath(); if (event.key === 'Enter') { const target = exportPathInput.value; leaveExportPath(); void listRemote(target).catch(exportError) } })
  folderOverlay.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); enterExportPath() } })
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

  onRemoteEndpointChange(endpoint => {
    state.remote = Boolean(endpoint) || Boolean(config && isRemoteRuntime(config))
    if (endpoint?.initialPath) {
      remoteStartingPath = cleanPath(endpoint.initialPath)
      if (!state.remoteSelected) state.browsePath = remoteStartingPath
    }
    if (!state.remote) {
      state.destination = 'local'
      state.remoteSelected = false
    }
    renderPanel()
  })

  void refreshConfig()
}

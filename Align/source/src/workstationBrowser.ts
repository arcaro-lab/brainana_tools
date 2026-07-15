import { listVolumeEntries, type ServerEntry } from './filesystemClient'
import { RemoteVolumeLoader } from './remoteVolumeLoader'

export type Modality = 'mri' | 'ct'
export type LoadFiles = (modality: Modality, files: File[]) => Promise<void>
export type Status = (message: string, error?: boolean) => void

export type WorkstationBrowser = {
  installButtons(): void
  openBrowser(modality: Modality, initialPath?: string): Promise<void>
  dispose(): void
}

type SortKey = 'name' | 'size' | 'modified'
const cleanPath = (value: string): string => value.trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/')
const displayPath = (value: string): string => value ? `/${value}` : '/'
const formatSize = (size?: number): string => {
  if (!Number.isFinite(size)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = Number(size); let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value < 10 && unit ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
const formatDate = (seconds?: number): string => Number.isFinite(seconds)
  ? new Date(Number(seconds) * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  : '—'

export function createWorkstationBrowser(loadFiles: LoadFiles, setStatus: Status): WorkstationBrowser {
  let browserModality: Modality = 'mri'
  let browserPath = ''
  let startingPath = ''
  let entries: ServerEntry[] = []
  let history: string[] = []
  let historyIndex = -1
  let sortKey: SortKey = 'name'
  let sortAscending = true
  let showHidden = false
  const loader = new RemoteVolumeLoader()

  const style = document.createElement('style')
  style.dataset.brainanaModule = 'workstation-browser'
  style.textContent = `
    .server-load{white-space:nowrap}.finder-card{width:min(1080px,96vw);height:min(760px,88vh);display:flex;flex-direction:column;padding:0;overflow:hidden}
    .finder-card .modal-head{padding:14px 16px;border-bottom:1px solid #31475c}.finder-toolbar{display:flex;align-items:center;gap:7px;padding:9px 12px;border-bottom:1px solid #31475c;background:#101e2c}
    .finder-toolbar button{min-width:34px;padding:7px}.finder-toolbar button:disabled{opacity:.38}.finder-path{display:flex;align-items:center;min-width:0;flex:1;height:36px;padding:0 8px;border:1px solid #405b77;border-radius:7px;background:#0b1722;overflow:auto}
    .finder-crumb{border:0!important;background:transparent!important;padding:4px 5px!important;white-space:nowrap}.finder-separator{opacity:.45}.finder-path-input{display:none;flex:1;color:#e8eef6;background:#0b1722;border:0;outline:0;font:inherit}
    .finder-search{width:190px;color:#e8eef6;background:#0b1722;border:1px solid #405b77;border-radius:7px;padding:8px}.finder-body{display:grid;grid-template-columns:180px 1fr;min-height:0;flex:1}
    .finder-sidebar{padding:10px 8px;border-right:1px solid #31475c;background:#0d1925}.finder-sidebar h3{font-size:12px;letter-spacing:.06em;text-transform:uppercase;opacity:.65;margin:8px}
    .finder-sidebar button{display:block;width:100%;text-align:left;border:0;background:transparent;padding:8px 10px}.finder-sidebar button:hover{background:#1b3349}.finder-content{min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column}
    .finder-list{flex:1;min-height:260px;overflow:auto}.finder-table{width:100%;border-collapse:collapse;table-layout:fixed}.finder-table th{position:sticky;top:0;z-index:1;text-align:left;background:#142536;border-bottom:1px solid #40566c;padding:8px 10px;font-weight:600;cursor:pointer}
    .finder-table th:first-child{width:52%}.finder-table th:nth-child(2){width:18%}.finder-table th:nth-child(3){width:30%}.finder-row{border-bottom:1px solid #263a4d}.finder-row:hover{background:#172b3d}.finder-row.selected{background:#17476a}
    .finder-row td{padding:8px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.finder-name{display:flex;align-items:center;gap:9px}.finder-name input{margin:0}.finder-folder{cursor:default}.finder-empty{padding:36px;text-align:center;opacity:.7}
    .finder-footer{display:flex;align-items:center;gap:12px;padding:9px 12px;border-top:1px solid #31475c}.finder-summary{flex:1;opacity:.72}.finder-actions{display:flex;gap:8px}.finder-hidden{display:flex;align-items:center;gap:5px;font-size:13px}
  `
  document.head.appendChild(style)

  const imageGroup = document.querySelector('.workflow-group.image-loads')
  const buttons = new Map<Modality, HTMLButtonElement>()
  for (const modality of ['mri', 'ct'] as Modality[]) {
    const button = document.createElement('button')
    button.id = `${modality}-server`; button.className = 'server-load hidden'; button.textContent = `Browse ${modality.toUpperCase()}`
    imageGroup?.appendChild(button); buttons.set(modality, button)
  }

  const browser = document.createElement('div')
  browser.id = 'server-browser-modal'; browser.className = 'modal hidden'; browser.setAttribute('role', 'dialog'); browser.setAttribute('aria-modal', 'true')
  browser.innerHTML = `<div class="modal-card finder-card"><div class="modal-head"><h2 id="server-browser-title">Remote files</h2><button id="server-browser-close" aria-label="Close">×</button></div><div class="finder-toolbar"><button id="finder-back" title="Back" disabled>‹</button><button id="finder-forward" title="Forward" disabled>›</button><button id="finder-up" title="Enclosing folder" disabled>↑</button><button id="finder-home" title="Starting directory">⌂</button><div id="finder-path" class="finder-path" title="Double-click or press Command-L to enter a path"><input id="finder-path-input" class="finder-path-input" aria-label="Remote path"></div><input id="finder-search" class="finder-search" type="search" placeholder="Search this folder"></div><div class="finder-body"><aside class="finder-sidebar"><h3>Locations</h3><button data-location="start">⌂ Starting directory</button><button data-location="root">💻 Remote filesystem</button><h3>Current session</h3><button data-location="recent">🕘 Last visited folder</button></aside><div class="finder-content"><div id="server-browser-list" class="finder-list"><table class="finder-table"><thead><tr><th data-sort="name">Name</th><th data-sort="size">Size</th><th data-sort="modified">Date Modified</th></tr></thead><tbody></tbody></table><div id="finder-empty" class="finder-empty hidden"></div></div><footer class="finder-footer"><label class="finder-hidden"><input id="finder-show-hidden" type="checkbox"> Show hidden files</label><span id="finder-summary" class="finder-summary"></span><div class="finder-actions"><button id="server-browser-cancel">Cancel</button><button id="server-browser-load" class="primary" disabled>Load selected</button></div></footer></div></div></div>`
  document.body.appendChild(browser)

  const tbody = browser.querySelector<HTMLTableSectionElement>('tbody')!
  const empty = browser.querySelector<HTMLDivElement>('#finder-empty')!
  const loadButton = browser.querySelector<HTMLButtonElement>('#server-browser-load')!
  const cancelButton = browser.querySelector<HTMLButtonElement>('#server-browser-cancel')!
  const search = browser.querySelector<HTMLInputElement>('#finder-search')!
  const pathBox = browser.querySelector<HTMLDivElement>('#finder-path')!
  const pathInput = browser.querySelector<HTMLInputElement>('#finder-path-input')!
  const selected = new Set<string>()

  const updateNavigation = (): void => {
    browser.querySelector<HTMLButtonElement>('#finder-back')!.disabled = historyIndex <= 0
    browser.querySelector<HTMLButtonElement>('#finder-forward')!.disabled = historyIndex < 0 || historyIndex >= history.length - 1
    browser.querySelector<HTMLButtonElement>('#finder-up')!.disabled = browserPath === ''
  }
  const renderBreadcrumbs = (): void => {
    pathBox.querySelectorAll(':scope > :not(input)').forEach(node => node.remove())
    const parts = browserPath.split('/').filter(Boolean)
    const add = (label: string, path: string): void => {
      if (pathBox.children.length > 1) { const separator = document.createElement('span'); separator.className = 'finder-separator'; separator.textContent = '›'; pathBox.insertBefore(separator, pathInput) }
      const crumb = document.createElement('button'); crumb.className = 'finder-crumb'; crumb.textContent = label; crumb.title = displayPath(path)
      crumb.addEventListener('click', () => { void navigate(path).catch(reportError) }); pathBox.insertBefore(crumb, pathInput)
    }
    add('Remote', '')
    parts.forEach((part, index) => add(part, parts.slice(0, index + 1).join('/')))
  }
  const sortedEntries = (): ServerEntry[] => {
    const filter = search.value.trim().toLocaleLowerCase()
    const visible = filter ? entries.filter(entry => entry.name.toLocaleLowerCase().includes(filter)) : [...entries]
    const direction = sortAscending ? 1 : -1
    return visible.sort((a, b) => {
      if (a.directory !== b.directory) return Number(b.directory) - Number(a.directory)
      if (sortKey === 'name') return direction * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      return direction * ((a[sortKey] ?? -1) - (b[sortKey] ?? -1)) || a.name.localeCompare(b.name)
    })
  }
  const renderEntries = (): void => {
    tbody.replaceChildren(); const visible = sortedEntries()
    for (const entry of visible) {
      const row = document.createElement('tr'); row.className = `finder-row ${entry.directory ? 'finder-folder' : 'finder-file'}`; row.tabIndex = 0
      if (selected.has(entry.path)) row.classList.add('selected')
      const nameCell = document.createElement('td'); const nameWrap = document.createElement('div'); nameWrap.className = 'finder-name'
      if (!entry.directory) { const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(entry.path); checkbox.tabIndex = -1; nameWrap.appendChild(checkbox) }
      const icon = document.createElement('span'); icon.textContent = entry.directory ? '📁' : '📄'; const label = document.createElement('span'); label.textContent = entry.name; nameWrap.append(icon, label); nameCell.appendChild(nameWrap)
      const size = document.createElement('td'); size.textContent = entry.directory ? '—' : formatSize(entry.size)
      const modified = document.createElement('td'); modified.textContent = formatDate(entry.modified); row.append(nameCell, size, modified)
      const activate = (): void => { if (entry.directory) void navigate(entry.path).catch(reportError); else { selected.has(entry.path) ? selected.delete(entry.path) : selected.add(entry.path); renderEntries() } }
      row.addEventListener('click', activate); row.addEventListener('dblclick', () => { if (entry.directory) void navigate(entry.path).catch(reportError) })
      row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate() } })
      tbody.appendChild(row)
    }
    empty.classList.toggle('hidden', visible.length > 0); empty.textContent = search.value ? 'No matching files or folders.' : 'No supported volumes or folders in this location.'
    loadButton.disabled = selected.size === 0
    browser.querySelector('#finder-summary')!.textContent = `${visible.length} item${visible.length === 1 ? '' : 's'}${selected.size ? `, ${selected.size} selected` : ''}`
  }
  const reportError = (error: unknown): void => setStatus(error instanceof Error ? error.message : String(error), true)
  async function navigate(path: string, addHistory = true): Promise<void> {
    const requested = cleanPath(path); const data = await listVolumeEntries(requested, showHidden)
    browserPath = data.path || ''; entries = data.entries; selected.clear()
    if (addHistory && history[historyIndex] !== browserPath) { history = history.slice(0, historyIndex + 1); history.push(browserPath); historyIndex = history.length - 1 }
    try { localStorage.setItem('brainana.remote.lastPath', browserPath) } catch {}
    renderBreadcrumbs(); updateNavigation(); renderEntries()
  }
  const enterPath = (): void => { pathInput.value = displayPath(browserPath); pathInput.style.display = 'block'; pathBox.querySelectorAll('button,span').forEach(element => (element as HTMLElement).style.display = 'none'); pathInput.focus(); pathInput.select() }
  const leavePath = (): void => { pathInput.style.display = 'none'; pathBox.querySelectorAll('button,span').forEach(element => (element as HTMLElement).style.display = '') }
  const closeBrowser = (): void => { loader.cancel(); browser.classList.add('hidden') }

  async function openBrowser(modality: Modality, initialPath?: string): Promise<void> {
    browserModality = modality
    if (initialPath !== undefined) { startingPath = cleanPath(initialPath); browserPath = startingPath; history = []; historyIndex = -1 }
    browser.querySelector<HTMLElement>('#server-browser-title')!.textContent = `Choose remote ${modality.toUpperCase()} files`
    browser.classList.remove('hidden'); search.value = ''; await navigate(browserPath)
  }
  async function loadSelection(): Promise<void> {
    const paths = [...selected]; if (!paths.length) return
    loadButton.disabled = true; cancelButton.textContent = 'Cancel loading'
    try {
      const result = await loader.load(browserModality, paths, loadFiles, message => setStatus(message))
      result === 'cancelled' ? setStatus('Workstation file loading cancelled.') : browser.classList.add('hidden')
    } finally { cancelButton.textContent = 'Cancel'; loadButton.disabled = selected.size === 0 }
  }

  browser.querySelector('#server-browser-close')!.addEventListener('click', closeBrowser); cancelButton.addEventListener('click', closeBrowser)
  loadButton.addEventListener('click', () => { void loadSelection().catch(reportError) }); search.addEventListener('input', renderEntries)
  browser.querySelector('#finder-back')!.addEventListener('click', () => { if (historyIndex > 0) { historyIndex -= 1; void navigate(history[historyIndex], false).catch(reportError) } })
  browser.querySelector('#finder-forward')!.addEventListener('click', () => { if (historyIndex < history.length - 1) { historyIndex += 1; void navigate(history[historyIndex], false).catch(reportError) } })
  browser.querySelector('#finder-up')!.addEventListener('click', () => { void navigate(browserPath.split('/').slice(0, -1).join('/')).catch(reportError) })
  browser.querySelector('#finder-home')!.addEventListener('click', () => { void navigate(startingPath).catch(reportError) })
  browser.querySelector<HTMLInputElement>('#finder-show-hidden')!.addEventListener('change', event => { showHidden = (event.currentTarget as HTMLInputElement).checked; void navigate(browserPath, false).catch(reportError) })
  browser.querySelectorAll<HTMLElement>('[data-location]').forEach(button => button.addEventListener('click', () => { const location = button.dataset.location; let target = location === 'root' ? '' : startingPath; if (location === 'recent') { try { target = localStorage.getItem('brainana.remote.lastPath') ?? browserPath } catch { target = browserPath } } void navigate(target).catch(reportError) }))
  browser.querySelectorAll<HTMLElement>('[data-sort]').forEach(header => header.addEventListener('click', () => { const next = header.dataset.sort as SortKey; if (sortKey === next) sortAscending = !sortAscending; else { sortKey = next; sortAscending = true } renderEntries() }))
  pathBox.addEventListener('dblclick', enterPath); pathInput.addEventListener('blur', leavePath); pathInput.addEventListener('keydown', event => { if (event.key === 'Escape') leavePath(); if (event.key === 'Enter') { const target = pathInput.value; leavePath(); void navigate(target).catch(reportError) } })
  browser.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); enterPath() } })
  browser.addEventListener('click', event => { if (event.target === browser) closeBrowser() })

  return {
    installButtons(): void { for (const [modality, button] of buttons) { button.classList.remove('hidden'); button.textContent = `Workstation ${modality.toUpperCase()}`; button.addEventListener('click', () => { void openBrowser(modality).catch(reportError) }) } },
    openBrowser,
    dispose(): void { loader.cancel(); browser.remove(); style.remove(); for (const button of buttons.values()) button.remove() },
  }
}

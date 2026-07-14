import { listVolumeEntries } from './filesystemClient'
import { RemoteVolumeLoader } from './remoteVolumeLoader'

export type Modality = 'mri' | 'ct'
export type LoadFiles = (modality: Modality, files: File[]) => Promise<void>
export type Status = (message: string, error?: boolean) => void

export type WorkstationBrowser = {
  installButtons(): void
  dispose(): void
}

export function createWorkstationBrowser(loadFiles: LoadFiles, setStatus: Status): WorkstationBrowser {
  let browserModality: Modality = 'mri'
  let browserPath = ''
  const loader = new RemoteVolumeLoader()

  const style = document.createElement('style')
  style.dataset.brainanaModule = 'workstation-browser'
  style.textContent = `
    .server-load{white-space:nowrap}.server-browser-list{min-height:220px;max-height:55vh;overflow:auto;border:1px solid #46505d;border-radius:6px}
    .server-entry{border-bottom:1px solid #39424d}.server-entry label,.server-directory-button{display:flex;width:100%;gap:10px;align-items:center;padding:10px 12px;text-align:left;background:transparent;border:0}
    .browser-card{width:min(720px,92vw)}.browser-location,.browser-actions{display:flex;align-items:center;gap:8px;padding:10px 0}.browser-location code{overflow-wrap:anywhere}.browser-actions{justify-content:flex-end}
  `
  document.head.appendChild(style)

  const imageGroup = document.querySelector('.workflow-group.image-loads')
  const buttons = new Map<Modality, HTMLButtonElement>()
  for (const modality of ['mri', 'ct'] as Modality[]) {
    const button = document.createElement('button')
    button.id = `${modality}-server`
    button.className = 'server-load hidden'
    button.textContent = `Browse ${modality.toUpperCase()}`
    imageGroup?.appendChild(button)
    buttons.set(modality, button)
  }

  const browser = document.createElement('div')
  browser.id = 'server-browser-modal'
  browser.className = 'modal hidden'
  browser.setAttribute('role', 'dialog')
  browser.setAttribute('aria-modal', 'true')
  browser.innerHTML = `<div class="modal-card browser-card"><div class="modal-head"><h2 id="server-browser-title">Files</h2><button id="server-browser-close" aria-label="Close">×</button></div><div class="browser-location"><button id="server-browser-up" disabled>↑</button><code id="server-browser-path">/</code></div><div id="server-browser-list" class="server-browser-list"></div><div class="browser-actions"><button id="server-browser-cancel">Cancel</button><button id="server-browser-load" class="primary" disabled>Load selected</button></div></div>`
  document.body.appendChild(browser)

  const listElement = browser.querySelector<HTMLDivElement>('#server-browser-list')!
  const loadButton = browser.querySelector<HTMLButtonElement>('#server-browser-load')!
  const cancelButton = browser.querySelector<HTMLButtonElement>('#server-browser-cancel')!
  const selectedPaths = (): string[] => Array.from(
    listElement.querySelectorAll<HTMLInputElement>('input:checked'),
  ).map(input => input.value)

  const closeBrowser = (): void => {
    loader.cancel()
    browser.classList.add('hidden')
  }

  async function listPath(path = ''): Promise<void> {
    const data = await listVolumeEntries(path)
    browserPath = data.path || ''
    browser.querySelector<HTMLElement>('#server-browser-path')!.textContent =
      `/${browserPath}`.replace(/\/$/, '') || '/'
    listElement.innerHTML = ''
    if (!data.entries.length) {
      listElement.innerHTML = '<div class="empty">No supported volumes or folders in this location.</div>'
    }
    for (const entry of data.entries) {
      const row = document.createElement('div')
      row.className = `server-entry ${entry.directory ? 'directory' : 'file'}`
      if (entry.directory) {
        const button = document.createElement('button')
        button.className = 'server-directory-button'
        button.textContent = `📁 ${entry.name}`
        button.addEventListener('click', () => {
          void listPath(entry.path).catch(error => setStatus(error.message, true))
        })
        row.appendChild(button)
      } else {
        const label = document.createElement('label')
        const input = document.createElement('input')
        const span = document.createElement('span')
        input.type = 'checkbox'
        input.value = entry.path
        span.textContent = entry.name
        input.addEventListener('change', () => {
          loadButton.disabled = selectedPaths().length === 0
        })
        label.append(input, span)
        row.appendChild(label)
      }
      listElement.appendChild(row)
    }
    const up = browser.querySelector<HTMLButtonElement>('#server-browser-up')!
    up.disabled = data.parent === null
    up.dataset.parent = data.parent ?? ''
    loadButton.disabled = true
  }

  async function openBrowser(modality: Modality): Promise<void> {
    browserModality = modality
    browser.querySelector<HTMLElement>('#server-browser-title')!.textContent =
      `Workstation ${modality.toUpperCase()} files`
    browser.classList.remove('hidden')
    await listPath(browserPath)
  }

  async function loadSelection(): Promise<void> {
    const paths = selectedPaths()
    if (!paths.length) return
    loadButton.disabled = true
    cancelButton.textContent = 'Cancel loading'
    try {
      const result = await loader.load(browserModality, paths, loadFiles, message => setStatus(message))
      if (result === 'cancelled') {
        setStatus('Workstation file loading cancelled.')
      } else {
        browser.classList.add('hidden')
      }
    } finally {
      cancelButton.textContent = 'Cancel'
      loadButton.disabled = false
    }
  }

  browser.querySelector('#server-browser-close')!.addEventListener('click', closeBrowser)
  cancelButton.addEventListener('click', closeBrowser)
  browser.querySelector<HTMLButtonElement>('#server-browser-up')!.addEventListener('click', event => {
    void listPath((event.currentTarget as HTMLButtonElement).dataset.parent ?? '')
      .catch(error => setStatus(error.message, true))
  })
  loadButton.addEventListener('click', () => {
    void loadSelection().catch(error => setStatus(error.message, true))
  })
  browser.addEventListener('click', event => {
    if (event.target === browser) closeBrowser()
  })

  return {
    installButtons(): void {
      for (const [modality, button] of buttons) {
        button.classList.remove('hidden')
        button.textContent = `Workstation ${modality.toUpperCase()}`
        button.addEventListener('click', () => {
          void openBrowser(modality).catch(error => setStatus(error.message, true))
        })
      }
    },
    dispose(): void {
      loader.cancel()
      browser.remove()
      style.remove()
      for (const button of buttons.values()) button.remove()
    },
  }
}

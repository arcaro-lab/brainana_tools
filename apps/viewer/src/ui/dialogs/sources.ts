// Sources dialog: add a local folder or a remote SSH/SFTP workstation, list and remove
// sources. Multi-source is held server-side; this just drives /api/sources.
import type { RuntimeClient } from '@brainana/core-client/runtimeClient.ts'
import type { SourceManager, SourceSummary } from '@brainana/core-client/sourceManager.ts'
import type { BrowseListing, FilesystemClient } from '@brainana/core-client/filesystemClient.ts'
import { loadRecent, rememberLocal, rememberRemote } from '@brainana/core-client/sessionPersistence.ts'
import { h, field, errorText } from '@brainana/ui/dom.ts'

interface Deps {
  client: RuntimeClient
  sources: SourceManager
  files: FilesystemClient
}

// Folder glyph reused by the Browse button and by each folder row in the picker (no shared icon set).
const FOLDER_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'

// `onDone` fires when the user clicks the next-step "Done — choose a monkey" button (after at
// least one dataset exists): the dialog closes and the caller can steer focus to the monkey picker.
export function mountSourcesDialog(deps: Deps, onChanged: () => void, onDone?: () => void): void {
  const { sources } = deps
  const recents = loadRecent()

  const overlay = h('div', { class: 'overlay' })
  const close = (): void => overlay.remove()
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  // The header dismiss button doubles as the next step: a plain "Close" while there are no
  // datasets, then a primary "Done — choose a monkey" once one exists (which also steers focus to
  // the monkey picker via onDone). Declared before renderList so the subscription can restyle it.
  let hasSources = false
  const closeBtn = h('button', { type: 'button', class: 'ghost' }, ['close'])
  closeBtn.addEventListener('click', () => {
    unsub()
    close()
    if (hasSources) onDone?.()
  })

  const list = h('div', { class: 'source-list' })
  const renderList = (items: SourceSummary[]): void => {
    list.innerHTML = ''
    if (items.length === 0) list.append(h('p', { class: 'muted' }, ['No datasets yet.']))
    for (const s of items) {
      const remove = h('button', { type: 'button', class: 'ghost' }, ['remove'])
      remove.addEventListener('click', () => sources.remove(s.id).then(onChanged).catch(() => {}))
      list.append(h('div', { class: 'source-row' }, [h('span', { class: `badge ${s.type}` }, [s.type]), h('strong', {}, [s.label]), h('span', { class: 'spacer' }), remove]))
    }
    hasSources = items.length > 0
    closeBtn.className = hasSources ? 'primary' : 'ghost'
    closeBtn.textContent = hasSources ? 'done — choose a monkey' : 'close'
  }
  const unsub = sources.subscribe(renderList)

  // local form
  const localPath = h('input', { type: 'text', placeholder: '/path/to/preprocessed', class: 'grow' }) as HTMLInputElement
  const localRecent = recents.find((r) => r.type === 'local')
  if (localRecent) localPath.value = localRecent.path
  // Folder-icon button that opens the server-side directory picker; the chosen path is written
  // straight back into the input. Inline SVG since the viewer has no shared icon set.
  const browseBtn = h('button', {
    type: 'button',
    class: 'icon-btn',
    title: 'Browse folders',
    ariaLabel: 'Browse folders',
    innerHTML: FOLDER_SVG,
  })
  browseBtn.addEventListener('click', () => {
    openFolderPicker(deps, localPath.value.trim(), (chosen) => {
      localPath.value = chosen
    })
  })
  const localField = field('folder', h('div', { class: 'row' }, [localPath, browseBtn]))
  const localBtn = h('button', { type: 'button', class: 'primary' }, ['add local dataset'])
  const localMsg = h('span', { class: 'msg' })
  localBtn.addEventListener('click', async () => {
    if (!localPath.value.trim()) return
    localBtn.disabled = true
    localMsg.textContent = ''
    try {
      const spec = { type: 'local' as const, path: localPath.value.trim() }
      await sources.add(spec)
      rememberLocal(spec)
      localMsg.textContent = '✓ Added'
      localMsg.className = 'msg ok'
      onChanged()
    } catch (err) {
      localMsg.textContent = errorText(err)
      localMsg.className = 'msg error'
    } finally {
      localBtn.disabled = false
    }
  })

  // remote form
  const rHost = h('input', { type: 'text', placeholder: 'host' }) as HTMLInputElement
  const rUser = h('input', { type: 'text', placeholder: 'user' }) as HTMLInputElement
  const rPass = h('input', { type: 'password', placeholder: 'password' }) as HTMLInputElement
  const rRoot = h('input', { type: 'text', placeholder: '/remote/preprocessed', class: 'grow' }) as HTMLInputElement
  const remoteRecent = recents.find((r) => r.type === 'remote')
  if (remoteRecent) {
    rHost.value = remoteRecent.host
    rUser.value = remoteRecent.username
    rRoot.value = remoteRecent.remoteRoot
  }
  const remoteBtn = h('button', { type: 'button', class: 'primary' }, ['add remote dataset'])
  const remoteMsg = h('span', { class: 'msg' })
  remoteBtn.addEventListener('click', async () => {
    if (!rHost.value.trim() || !rUser.value.trim() || !rRoot.value.trim()) return
    remoteBtn.disabled = true
    remoteMsg.textContent = ''
    try {
      const spec = { type: 'remote' as const, connection: { host: rHost.value.trim(), username: rUser.value.trim(), password: rPass.value || undefined }, remoteRoot: rRoot.value.trim(), cacheRoot: '' }
      await sources.add(spec)
      rememberRemote(spec)
      rPass.value = ''
      remoteMsg.textContent = '✓ Added'
      remoteMsg.className = 'msg ok'
      onChanged()
    } catch (err) {
      remoteMsg.textContent = errorText(err)
      remoteMsg.className = 'msg error'
    } finally {
      remoteBtn.disabled = false
    }
  })

  const dialog = h('div', { class: 'dialog' }, [
    h('div', { class: 'dialog-head' }, [h('h2', {}, ['datasets']), h('span', { class: 'spacer' }), closeBtn]),
    list,
    h('div', { class: 'source-forms' }, [
      h('div', { class: 'source-form' }, [h('h3', {}, ['local folder']), localField, h('div', { class: 'row' }, [localBtn, localMsg])]),
      h('div', { class: 'source-form' }, [
        h('h3', {}, ['remote (SSH/SFTP)']),
        h('div', { class: 'row' }, [field('host', rHost), field('user', rUser), field('password', rPass)]),
        field('remote path', rRoot),
        h('div', { class: 'row' }, [remoteBtn, remoteMsg]),
      ]),
    ]),
  ])
  overlay.append(dialog)
  document.body.append(overlay)
}

// A second overlay layered over the Sources dialog: navigate server directories and pick one.
// Seeds from `startPath` when it is a valid directory; otherwise the server falls back to the
// home directory. `onPick` receives the absolute path of the chosen folder.
function openFolderPicker(deps: Deps, startPath: string, onPick: (absPath: string) => void): void {
  const { files } = deps
  const overlay = h('div', { class: 'overlay' })
  const close = (): void => overlay.remove()
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  let current = ''
  const crumb = h('nav', { class: 'fs-crumb', ariaLabel: 'Current path' })
  const listEl = h('div', { class: 'fs-list' })
  const msg = h('span', { class: 'msg' })
  const useBtn = h('button', { type: 'button', class: 'primary' }, ['use this folder'])
  useBtn.addEventListener('click', () => {
    if (current) onPick(current)
    close()
  })

  // Render the absolute path as clickable ancestor segments (standard file-chooser breadcrumb).
  // Each segment except the last navigates to that ancestor; the last marks the current folder.
  const renderCrumb = (absPath: string): void => {
    crumb.innerHTML = ''
    const segs: Array<{ label: string; path: string }> = [{ label: '/', path: '/' }]
    let acc = ''
    for (const part of absPath.split('/').filter(Boolean)) {
      acc += `/${part}`
      segs.push({ label: part, path: acc })
    }
    segs.forEach((seg, i) => {
      if (i > 0) crumb.append(h('span', { class: 'fs-sep' }, ['›']))
      const isCurrent = i === segs.length - 1
      const btn = h('button', { type: 'button', class: `fs-seg${isCurrent ? ' current' : ''}` }, [seg.label])
      if (!isCurrent) btn.addEventListener('click', () => void load(seg.path))
      crumb.append(btn)
    })
  }

  const load = async (abs: string): Promise<void> => {
    msg.textContent = ''
    msg.className = 'msg'
    listEl.classList.add('loading')
    let listing: BrowseListing
    try {
      listing = await files.browseFs(abs)
    } catch (err) {
      // On a bad seed path, retry once at the server default (home) so the picker still opens.
      if (abs) return void load('')
      msg.textContent = errorText(err)
      msg.className = 'msg error'
      listEl.classList.remove('loading')
      return
    }
    current = listing.path
    renderCrumb(listing.path)
    useBtn.disabled = false
    listEl.innerHTML = ''
    if (listing.entries.length === 0) {
      listEl.append(h('p', { class: 'muted' }, ['No sub-folders here.']))
    }
    for (const entry of listing.entries) {
      const row = h('button', { type: 'button', class: 'fs-entry' }, [
        h('span', { class: 'fs-ico', innerHTML: FOLDER_SVG }),
        h('span', { class: 'fs-name' }, [entry.name]),
      ])
      row.addEventListener('click', () => void load(entry.path))
      listEl.append(row)
    }
    listEl.classList.remove('loading')
  }

  const closeBtn = h('button', { type: 'button', class: 'ghost' }, ['cancel'])
  closeBtn.addEventListener('click', close)

  const dialog = h('div', { class: 'dialog fs-picker' }, [
    h('div', { class: 'dialog-head' }, [h('h2', {}, ['choose folder']), h('span', { class: 'spacer' }), closeBtn]),
    crumb,
    listEl,
    h('div', { class: 'row' }, [useBtn, msg]),
  ])
  overlay.append(dialog)
  document.body.append(overlay)
  void load(startPath)
}

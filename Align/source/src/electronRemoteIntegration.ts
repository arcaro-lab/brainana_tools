import { desktopApi, type RemoteProfile } from './desktopApi'
import { setRemoteEndpoint } from './remoteEndpoint'
import type { Modality, Status, WorkstationBrowser } from './workstationBrowser'

export function installElectronRemoteIntegration(browser: WorkstationBrowser, setStatus: Status): boolean {
  const api = desktopApi()
  if (!api) return false

  const style = document.createElement('style')
  style.textContent = `
    .load-source-button{height:38px;min-width:34px;padding:0 8px;margin-left:-4px}
    .remote-status{height:38px;white-space:nowrap}.remote-status.connected{border-color:#2fbf88;color:#9ff0ce}
    .load-source-menu{position:fixed;z-index:120;min-width:220px;padding:5px;background:#142536;border:1px solid #46617c;border-radius:7px;box-shadow:0 12px 35px #0009}
    .load-source-menu button{display:block;width:100%;text-align:left;border:0;background:transparent}
    .profile-card{width:min(560px,92vw)}.profile-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profile-fields label:last-child{grid-column:1/-1}
    .profile-fields input{width:100%;color:#e8eef6;background:#0d1925;border:1px solid #405b77;border-radius:5px;padding:8px}
    .profile-actions{display:flex;gap:8px;margin-top:12px}.profile-actions button{flex:1}
  `
  document.head.appendChild(style)

  const imageGroup = document.querySelector<HTMLElement>('.workflow-group.image-loads')!
  const statusButton = document.createElement('button')
  statusButton.className = 'remote-status'
  statusButton.textContent = 'Remote: Not connected'
  imageGroup.appendChild(statusButton)

  const menu = document.createElement('div')
  menu.className = 'load-source-menu hidden'
  document.body.appendChild(menu)
  let pendingModality: Modality = 'mri'
  let remoteSupported = true
  let activeProfile: RemoteProfile | null = null
  let activeInitialPath = ''

  const modal = document.createElement('div')
  modal.className = 'modal hidden'
  modal.innerHTML = `<div class="modal-card profile-card"><div class="modal-head"><h2>Remote workstation</h2><button data-close aria-label="Close">×</button></div><label>Saved profile<select id="remote-profile"></select></label><div class="profile-fields"><label>Profile name<input id="remote-name"></label><label>Username<input id="remote-user"></label><label>Host or SSH alias<input id="remote-host"></label><label>Starting directory<input id="remote-root" placeholder="/data/project"></label></div><p class="hint">The starting directory is not an access boundary; you can navigate upward to any location permitted by your SSH account. Passwords, key passphrases, and Duo responses are never stored.</p><div class="profile-actions"><button id="remote-new">New</button><button id="remote-delete">Delete</button><button id="remote-cancel">Cancel</button><button id="remote-connect" class="primary">Connect and browse</button></div></div>`
  document.body.appendChild(modal)
  const profileSelect = modal.querySelector<HTMLSelectElement>('#remote-profile')!
  const name = modal.querySelector<HTMLInputElement>('#remote-name')!
  const user = modal.querySelector<HTMLInputElement>('#remote-user')!
  const host = modal.querySelector<HTMLInputElement>('#remote-host')!
  const root = modal.querySelector<HTMLInputElement>('#remote-root')!
  let profiles: RemoteProfile[] = []
  let editingId = ''
  let connecting = false

  const fill = (profile?: RemoteProfile): void => {
    editingId = profile?.id ?? crypto.randomUUID()
    name.value = profile?.name ?? ''
    user.value = profile?.user ?? ''
    host.value = profile?.host ?? ''
    root.value = profile?.root ?? ''
  }
  const refreshProfiles = async (): Promise<void> => {
    profiles = await api.listProfiles()
    profileSelect.replaceChildren(...profiles.map(profile => new Option(profile.name, profile.id)))
    const selected = profiles.find(profile => profile.id === editingId) ?? profiles[0]
    if (selected) { profileSelect.value = selected.id; fill(selected) }
    else fill()
  }
  const closeModal = (): void => modal.classList.add('hidden')
  const showProfiles = async (modality: Modality): Promise<void> => {
    pendingModality = modality
    await refreshProfiles()
    modal.classList.remove('hidden')
  }
  const updateStatus = (): void => {
    statusButton.textContent = activeProfile ? `Remote: ${activeProfile.name} ●` : 'Remote: Not connected'
    statusButton.classList.toggle('connected', Boolean(activeProfile))
  }

  profileSelect.addEventListener('change', () => fill(profiles.find(profile => profile.id === profileSelect.value)))
  modal.querySelector('#remote-new')!.addEventListener('click', () => { profileSelect.value = ''; fill() })
  modal.querySelector('#remote-delete')!.addEventListener('click', () => {
    if (!editingId || !profiles.some(profile => profile.id === editingId)) return
    void api.deleteProfile(editingId).then(refreshProfiles).catch(error => setStatus(error.message, true))
  })
  modal.querySelector('#remote-connect')!.addEventListener('click', () => {
    void (async () => {
      connecting = true
      modal.querySelector<HTMLButtonElement>('#remote-cancel')!.textContent = 'Cancel authentication'
      const profile = await api.saveProfile({ id: editingId, name: name.value, user: user.value, host: host.value, root: root.value })
      setStatus(`Complete SSH authentication for ${profile.name} in Terminal…`)
      const connection = await api.connectRemote(profile.id)
      if (!connection.baseUrl || !connection.sessionToken) throw new Error('Remote connection did not provide a secure file endpoint.')
      setRemoteEndpoint({ baseUrl: connection.baseUrl, sessionToken: connection.sessionToken, initialPath: connection.initialPath ?? profile.root })
      activeProfile = profile
      activeInitialPath = connection.initialPath ?? profile.root
      updateStatus()
      closeModal()
      setStatus(`Connected to ${profile.name}.`)
      await browser.openBrowser(pendingModality, activeInitialPath)
    })().catch(error => setStatus(error instanceof Error ? error.message : String(error), true)).finally(() => {
      connecting = false
      modal.querySelector<HTMLButtonElement>('#remote-cancel')!.textContent = 'Cancel'
    })
  })
  modal.querySelector('[data-close]')!.addEventListener('click', closeModal)
  modal.querySelector('#remote-cancel')!.addEventListener('click', () => {
    if (connecting) void api.cancelRemoteConnect().then(() => setStatus('SSH authentication cancelled.'))
    closeModal()
  })

  for (const modality of ['mri', 'ct'] as Modality[]) {
    const localLabel = document.querySelector<HTMLElement>(`label.load:has(#${modality}-file)`)
    if (!localLabel) continue
    localLabel.title = `Load ${modality.toUpperCase()} from this Mac`
    const trigger = document.createElement('button')
    trigger.className = 'load-source-button'
    trigger.textContent = '▾'
    trigger.title = `Choose local or remote ${modality.toUpperCase()}`
    localLabel.after(trigger)
    trigger.addEventListener('click', event => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
      menu.style.left = `${rect.left}px`; menu.style.top = `${rect.bottom + 4}px`
      menu.replaceChildren()
      const local = document.createElement('button'); local.textContent = 'From this Mac…'
      local.addEventListener('click', () => { menu.classList.add('hidden'); document.querySelector<HTMLInputElement>(`#${modality}-file`)?.click() })
      const remote = document.createElement('button'); remote.textContent = 'From remote workstation…'
      remote.disabled = !remoteSupported
      remote.textContent = remoteSupported ? 'From remote workstation…' : 'Remote workstation unavailable on Windows'
      remote.addEventListener('click', () => { if (!remoteSupported) return; menu.classList.add('hidden'); activeProfile ? void browser.openBrowser(modality) : void showProfiles(modality) })
      menu.append(local, remote); menu.classList.toggle('hidden')
    })
  }
  statusButton.addEventListener('click', () => {
    if (!activeProfile) void showProfiles('mri')
    else if (window.confirm(`Disconnect from ${activeProfile.name}?`)) void api.disconnectRemote().then(() => { activeProfile = null; activeInitialPath = ''; setRemoteEndpoint(null); updateStatus(); setStatus('Remote workstation disconnected.') })
  })
  void api.remoteStatus().then(status => {
    remoteSupported = status.supported !== false
    statusButton.disabled = !remoteSupported
    if (!remoteSupported) statusButton.textContent = 'Remote: unavailable on Windows'
    if (status.connected && status.profile) {
      activeProfile = status.profile
      activeInitialPath = status.initialPath ?? status.profile.root
    }
    if (remoteSupported) updateStatus()
  })
  return true
}

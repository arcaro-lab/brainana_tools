const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('brainanaDesktop', {
  listProfiles: () => ipcRenderer.invoke('brainana:profiles:list'),
  saveProfile: profile => ipcRenderer.invoke('brainana:profiles:save', profile),
  deleteProfile: id => ipcRenderer.invoke('brainana:profiles:delete', id),
  connectRemote: id => ipcRenderer.invoke('brainana:remote:connect', id),
  cancelRemoteConnect: () => ipcRenderer.invoke('brainana:remote:cancel-connect'),
  disconnectRemote: () => ipcRenderer.invoke('brainana:remote:disconnect'),
  remoteStatus: () => ipcRenderer.invoke('brainana:remote:status'),
})

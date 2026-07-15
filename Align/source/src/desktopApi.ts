export type RemoteProfile = { id: string; name: string; host: string; user: string; root: string }
export type RemoteConnection = { connected: boolean; supported?: boolean; profile?: RemoteProfile; baseUrl?: string; sessionToken?: string; initialPath?: string }
export type DesktopApi = {
  listProfiles(): Promise<RemoteProfile[]>
  saveProfile(profile: Partial<RemoteProfile>): Promise<RemoteProfile>
  deleteProfile(id: string): Promise<boolean>
  connectRemote(id: string): Promise<RemoteConnection>
  cancelRemoteConnect(): Promise<boolean>
  disconnectRemote(): Promise<RemoteConnection>
  remoteStatus(): Promise<RemoteConnection>
}

declare global { interface Window { brainanaDesktop?: DesktopApi } }

export function desktopApi(): DesktopApi | null { return window.brainanaDesktop ?? null }

// Per-OS path helpers shared by the launcher and the CLI server entry.
// Kept side-effect-free so either entry point can import it without booting the other.
import os from 'node:os'
import path from 'node:path'

// Per-OS cache directory: %LOCALAPPDATA% (win) / ~/Library/Caches (mac) / $XDG_CACHE_HOME
// or ~/.cache (linux), under an app-specific subdirectory.
export function cacheDir(app = 'BrainanaViewer') {
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), app)
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', app)
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), app)
}

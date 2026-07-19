// Per-OS path helpers shared by the launcher and the CLI server entry.
// Kept side-effect-free so either entry point can import it without booting the other.
import os from 'node:os'
import path from 'node:path'

// Per-OS cache directory: %LOCALAPPDATA% (win) / ~/Library/Caches (mac) / $XDG_CACHE_HOME
// or ~/.cache (linux), under an app-specific subdirectory. The platform/env/homedir are
// injectable so each OS branch is unit-testable on any host; defaults preserve real behavior.
export function cacheDir(app = 'BrainanaViewer', { platform = process.platform, env = process.env, homedir = os.homedir() } = {}) {
  if (platform === 'win32') return path.join(env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local'), app)
  if (platform === 'darwin') return path.join(homedir, 'Library', 'Caches', app)
  return path.join(env.XDG_CACHE_HOME || path.join(homedir, '.cache'), app)
}

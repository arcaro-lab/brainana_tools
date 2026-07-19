// Unit tests for core-server/paths.mjs cacheDir. cacheDir branches on process.platform; we
// inject platform/env/homedir so ALL THREE OS branches are verified on any host (not just the
// current runner's). Expected values use path.join so separators match the host — what we're
// asserting is the branch logic (which env var / which segments), not the separator style.
import assert from 'node:assert/strict'
import path from 'node:path'
import { cacheDir } from '@brainana/core-server/paths.mjs'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

const HOME = path.join('/home', 'user')

// --- win32 ---
assert.equal(
  cacheDir('App', { platform: 'win32', env: { LOCALAPPDATA: path.join('D:', 'AppData', 'Local') }, homedir: HOME }),
  path.join('D:', 'AppData', 'Local', 'App'),
  'win32 uses %LOCALAPPDATA%',
)
assert.equal(
  cacheDir('App', { platform: 'win32', env: {}, homedir: HOME }),
  path.join(HOME, 'AppData', 'Local', 'App'),
  'win32 falls back to ~/AppData/Local when LOCALAPPDATA is unset',
)
ok('cacheDir win32 branch: LOCALAPPDATA override and homedir fallback')

// --- darwin ---
assert.equal(
  cacheDir('App', { platform: 'darwin', env: {}, homedir: HOME }),
  path.join(HOME, 'Library', 'Caches', 'App'),
  'darwin uses ~/Library/Caches',
)
ok('cacheDir darwin branch: ~/Library/Caches')

// --- linux / other ---
assert.equal(
  cacheDir('App', { platform: 'linux', env: { XDG_CACHE_HOME: path.join('/x', 'cache') }, homedir: HOME }),
  path.join('/x', 'cache', 'App'),
  'linux uses $XDG_CACHE_HOME',
)
assert.equal(
  cacheDir('App', { platform: 'linux', env: {}, homedir: HOME }),
  path.join(HOME, '.cache', 'App'),
  'linux falls back to ~/.cache',
)
ok('cacheDir linux branch: XDG_CACHE_HOME override and ~/.cache fallback')

// The default app name and current-platform defaults still work (no options passed).
assert.ok(cacheDir().endsWith(path.join('', 'BrainanaViewer')) || cacheDir().includes('BrainanaViewer'), 'default app name applied')
ok('cacheDir with no options uses the real platform and default app name')

console.log(`paths_test: ${passed} checks passed`)

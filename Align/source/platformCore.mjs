import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const PLATFORM_IDS = Object.freeze({
  darwin: 'macos',
  linux: 'linux',
  win32: 'windows',
})

export function normalizedPlatform(platform = process.platform) {
  return PLATFORM_IDS[platform] || platform
}

export function applicationPaths({
  appName = 'Brainana Align',
  appSlug = 'brainana-align',
  version = 'dev',
  platform = process.platform,
  env = process.env,
  home = os.homedir(),
} = {}) {
  if (platform === 'darwin') {
    const supportRoot = path.join(home, 'Library', 'Application Support', appName)
    return {
      platform: 'macos',
      configRoot: supportRoot,
      dataRoot: supportRoot,
      cacheRoot: path.join(home, 'Library', 'Caches', appName, version),
      logRoot: path.join(supportRoot, 'logs'),
      tempRoot: path.join(home, 'Library', 'Caches', appName, version, 'tmp'),
    }
  }
  if (platform === 'win32') {
    const roaming = env.APPDATA || path.join(home, 'AppData', 'Roaming')
    const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    return {
      platform: 'windows',
      configRoot: path.join(roaming, appName),
      dataRoot: path.join(roaming, appName),
      cacheRoot: path.join(local, appName, 'Cache', version),
      logRoot: path.join(local, appName, 'Logs'),
      tempRoot: path.join(local, appName, 'Cache', version, 'tmp'),
    }
  }
  const configBase = env.XDG_CONFIG_HOME || path.join(home, '.config')
  const dataBase = env.XDG_DATA_HOME || path.join(home, '.local', 'share')
  const cacheBase = env.XDG_CACHE_HOME || path.join(home, '.cache')
  const stateBase = env.XDG_STATE_HOME || path.join(home, '.local', 'state')
  return {
    platform: 'linux',
    configRoot: path.join(configBase, appSlug),
    dataRoot: path.join(dataBase, appSlug),
    cacheRoot: path.join(cacheBase, appSlug, version),
    logRoot: path.join(stateBase, appSlug, 'logs'),
    tempRoot: path.join(cacheBase, appSlug, version, 'tmp'),
  }
}

function isExecutable(filename, platform = process.platform) {
  try {
    const stat = fs.statSync(filename)
    if (!stat.isFile()) return false
    if (platform === 'win32') return true
    fs.accessSync(filename, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

export function executableCandidates(name, { platform = process.platform, env = process.env } = {}) {
  const pathValue = env.PATH || ''
  const delimiter = platform === 'win32' ? ';' : ':'
  const extensions = platform === 'win32'
    ? (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : ['']
  const names = platform === 'win32' && !path.extname(name)
    ? extensions.map(ext => `${name}${ext.toLowerCase()}`).concat(extensions.map(ext => `${name}${ext.toUpperCase()}`))
    : [name]
  const candidates = []
  for (const directory of pathValue.split(delimiter).filter(Boolean)) {
    for (const item of names) candidates.push(path.join(directory, item))
  }
  return candidates
}

export function resolveExecutable(name, {
  platform = process.platform,
  env = process.env,
  preferred = [],
  required = false,
} = {}) {
  const candidates = [...preferred, ...executableCandidates(name, { platform, env })]
  const seen = new Set()
  for (const candidate of candidates) {
    const key = platform === 'win32' ? candidate.toLowerCase() : candidate
    if (seen.has(key)) continue
    seen.add(key)
    if (isExecutable(candidate, platform)) return candidate
  }
  if (required) throw Object.assign(new Error(`Required executable not found: ${name}`), { code: 'ENOENT' })
  return ''
}

export function browserLaunchSpec(url, { platform = process.platform } = {}) {
  if (platform === 'darwin') return { command: '/usr/bin/open', args: [url], detached: true }
  if (platform === 'win32') return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '', url], detached: true }
  return { command: 'xdg-open', args: [url], detached: true }
}

export function runtimeRelativePath({ platform = process.platform, arch = process.arch } = {}) {
  if (platform === 'darwin') {
    if (arch === 'arm64') return path.join('darwin-arm64', 'node')
    if (arch === 'x64') return path.join('darwin-x64', 'node')
  }
  if (platform === 'linux') {
    if (arch === 'arm64') return path.join('linux-arm64', 'node')
    if (arch === 'x64') return path.join('linux-x64', 'node')
  }
  if (platform === 'win32') {
    if (arch === 'arm64') return path.join('win32-arm64', 'node.exe')
    if (arch === 'x64') return path.join('win32-x64', 'node.exe')
  }
  throw new Error(`Unsupported platform or architecture: ${platform}/${arch}`)
}

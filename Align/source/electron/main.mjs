import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
let mainWindow = null
let serverProcess = null
let temporaryDirectory = null
let remoteProcess = null
let remoteTemporaryDirectory = null
let remoteConnection = null
let localOrigin = ''
let remoteAuthAttempt = null
let quitting = false

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function runtimeDirectory() {
  const packagedRuntime = path.join(process.resourcesPath, 'runtime')
  if (fs.existsSync(path.join(packagedRuntime, 'server.mjs'))) return packagedRuntime
  return path.resolve(here, '..')
}

async function waitForHandshake(filename, child, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`The local server stopped with exit code ${child.exitCode}.`)
    try {
      const payload = JSON.parse(await fs.promises.readFile(filename, 'utf8'))
      if (Number.isInteger(payload.port) && payload.port > 0 && /^[0-9a-f]{64,}$/i.test(payload.sessionToken)) return payload
    } catch (error) {
      if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    }
    await sleep(50)
  }
  throw new Error('The local server did not publish a valid launch handshake within 30 seconds.')
}

async function startLocalServer() {
  temporaryDirectory = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'brainana-electron-'))
  const handshake = path.join(temporaryDirectory, 'handshake.json')
  const errorFile = path.join(temporaryDirectory, 'server-error.txt')
  const logFile = path.join(app.getPath('logs'), `electron-server-${Date.now()}.log`)
  await fs.promises.mkdir(path.dirname(logFile), { recursive: true })
  const output = fs.openSync(logFile, 'a', 0o600)
  const runtime = runtimeDirectory()
  const args = [
    path.join(runtime, 'server.mjs'), '--mode', 'local', '--root', os.homedir(),
    '--label', 'This Mac', '--host', '127.0.0.1', '--port', '0',
    '--handshake-file', handshake, '--error-file', errorFile,
    '--cache', app.getPath('cache'),
  ]
  serverProcess = spawn(process.execPath, args, {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', output, output],
    windowsHide: true,
  })
  serverProcess.once('exit', () => { fs.close(output, () => {}) })
  try {
    return await waitForHandshake(handshake, serverProcess)
  } catch (error) {
    const serverMessage = await fs.promises.readFile(errorFile, 'utf8').catch(() => '')
    throw new Error([error.message, serverMessage.trim(), `Server log: ${logFile}`].filter(Boolean).join('\n'))
  }
}

function createWindow(handshake) {
  localOrigin = `http://127.0.0.1:${handshake.port}`
  mainWindow = new BrowserWindow({
    width: 1580,
    height: 1020,
    minWidth: 1100,
    minHeight: 720,
    title: 'Brainana Align Desktop',
    backgroundColor: '#08111b',
    show: false,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = `http://127.0.0.1:${handshake.port}/`
    if (!url.startsWith(allowed)) event.preventDefault()
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => { mainWindow = null })
  void mainWindow.loadURL(`http://127.0.0.1:${handshake.port}/#session=${handshake.sessionToken}`)
}

const profileFile = () => path.join(app.getPath('userData'), 'remote-profiles.json')
const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`
function findExecutable(names, preferred = []) {
  for (const candidate of [...preferred, ...names.flatMap(name => (process.env.PATH || '').split(path.delimiter).map(directory => path.join(directory, name)))]) {
    try { fs.accessSync(candidate, fs.constants.X_OK); return candidate } catch {}
  }
  return ''
}

function systemSshExecutable() {
  if (process.platform === 'win32') return findExecutable(['ssh.exe', 'ssh'])
  return findExecutable(['ssh'], process.platform === 'darwin' ? ['/usr/bin/ssh'] : ['/usr/bin/ssh', '/bin/ssh'])
}

function openAuthenticationTerminal(helper) {
  if (process.platform === 'darwin') {
    const result = spawnSync('/usr/bin/open', ['-a', 'Terminal', helper], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr.trim() || 'Unable to open Terminal for SSH authentication.')
    return
  }
  if (process.platform === 'linux') {
    const terminals = [
      { names: ['x-terminal-emulator'], args: executable => ['-e', helper] },
      { names: ['gnome-terminal'], args: executable => ['--', helper] },
      { names: ['konsole'], args: executable => ['-e', helper] },
      { names: ['xterm'], args: executable => ['-e', helper] },
    ]
    for (const terminal of terminals) {
      const executable = findExecutable(terminal.names)
      if (!executable) continue
      const child = spawn(executable, terminal.args(executable), { detached: true, stdio: 'ignore' })
      child.unref()
      return
    }
    throw new Error('No supported terminal emulator was found. Install x-terminal-emulator, GNOME Terminal, Konsole, or xterm.')
  }
  throw new Error('Interactive remote workstation authentication is not yet supported on Windows.')
}
const validProfile = value => {
  if (!value || typeof value !== 'object') throw new Error('Connection profile is invalid.')
  const profile = {
    id: String(value.id || crypto.randomUUID()),
    name: String(value.name || '').trim(),
    host: String(value.host || '').trim(),
    user: String(value.user || '').trim(),
    root: String(value.root || '').trim(),
  }
  if (!profile.name || !profile.host || !profile.user || !profile.root) throw new Error('Name, host, username, and starting directory are required.')
  if (!profile.root.startsWith('/')) throw new Error('Starting directory must be an absolute path.')
  if (/[\r\n\0]/.test(Object.values(profile).join(''))) throw new Error('Connection profile contains invalid characters.')
  return profile
}
async function readProfiles() {
  try {
    const payload = JSON.parse(await fs.promises.readFile(profileFile(), 'utf8'))
    return Array.isArray(payload.profiles) ? payload.profiles.map(validProfile) : []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}
async function writeProfiles(profiles) {
  await fs.promises.mkdir(path.dirname(profileFile()), { recursive: true })
  const temporary = `${profileFile()}.tmp-${process.pid}`
  await fs.promises.writeFile(temporary, JSON.stringify({ schemaVersion: 1, profiles }, null, 2), { mode: 0o600 })
  await fs.promises.rename(temporary, profileFile())
}

async function authenticateRemote(profile) {
  if (process.platform === 'win32') throw new Error('Remote workstation access is not yet supported in the Windows build. Local MRI and CT loading remain available.')
  const sshExecutable = systemSshExecutable()
  if (!sshExecutable) throw new Error('The system SSH client could not be found.')
  const authDirectory = await fs.promises.mkdtemp(path.join(app.getPath('cache'), 'ssh-auth-'))
  const socketDirectory = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'ba-ssh-'))
  const socket = path.join(socketDirectory, 'control')
  const helper = path.join(authDirectory, process.platform === 'darwin' ? 'authenticate.command' : 'authenticate.sh')
  const started = path.join(authDirectory, 'started')
  const status = path.join(authDirectory, 'status')
  const terminalTtyFile = path.join(authDirectory, 'terminal.tty')
  const terminalCloseLog = path.join(authDirectory, 'terminal-close.log')
  const terminalCloseScript = path.join(here, 'close-auth-terminal.applescript')
  const sshPidFile = path.join(authDirectory, 'ssh.pid')
  const target = `${profile.user}@${profile.host}`
  const helperText = `#!/bin/bash\numask 077\ntty > ${shellQuote(terminalTtyFile)} 2>/dev/null || true\ntouch ${shellQuote(started)}\n${shellQuote(sshExecutable)} -M -S ${shellQuote(socket)} -o ControlPersist=600 -o ExitOnForwardFailure=yes -NT ${shellQuote(target)} &\nSSH_PID=$!\nprintf '%s\\n' "$SSH_PID" > ${shellQuote(sshPidFile)}\nwait "$SSH_PID"\nSSH_STATUS=$?\nprintf '%s\\n' "$SSH_STATUS" > ${shellQuote(status)}\nexit "$SSH_STATUS"\n`
  await fs.promises.writeFile(helper, helperText, { mode: 0o700 })
  openAuthenticationTerminal(helper)
  const attempt = { canceled: false, sshPidFile, socket, target, socketDirectory, sshExecutable }
  remoteAuthAttempt = attempt
  try {
    const deadline = Date.now() + 5 * 60_000
    while (Date.now() < deadline) {
      if (attempt.canceled) throw new Error('SSH authentication was cancelled.')
      const check = spawnSync(sshExecutable, ['-S', socket, '-O', 'check', target], { stdio: 'ignore' })
      if (check.status === 0) {
        if (process.platform === 'darwin') await closeAuthenticationTerminalWhenFinished(status, terminalTtyFile, terminalCloseScript, terminalCloseLog)
        return { target, socket, authDirectory, socketDirectory, sshExecutable }
      }
      try {
        const exitCode = Number((await fs.promises.readFile(status, 'utf8')).trim())
        if (Number.isInteger(exitCode) && exitCode !== 0) throw new Error(`SSH authentication stopped with exit code ${exitCode}. Diagnostics: ${authDirectory}`)
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error
      }
      await sleep(250)
    }
    throw new Error(`SSH authentication did not complete within five minutes. Diagnostics: ${authDirectory}`)
  } catch (error) {
    await fs.promises.rm(socketDirectory, { recursive: true, force: true }).catch(() => {})
    throw error
  } finally {
    if (remoteAuthAttempt === attempt) remoteAuthAttempt = null
  }
}

async function closeAuthenticationTerminalWhenFinished(statusFile, ttyFile, scriptFile, logFile) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const exitCode = Number((await fs.promises.readFile(statusFile, 'utf8')).trim())
      if (!Number.isInteger(exitCode) || exitCode !== 0) return
      const terminalTty = (await fs.promises.readFile(ttyFile, 'utf8')).trim()
      if (!terminalTty.startsWith('/dev/tty')) return
      const result = spawnSync('/usr/bin/osascript', [scriptFile, terminalTty], { encoding: 'utf8' })
      await fs.promises.writeFile(logFile, `exit=${result.status}\nstdout=${result.stdout ?? ''}\nstderr=${result.stderr ?? ''}`, { mode: 0o600 })
      return
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        await fs.promises.writeFile(logFile, String(error), { mode: 0o600 }).catch(() => {})
        return
      }
    }
    await sleep(100)
  }
  await fs.promises.writeFile(logFile, 'Authentication succeeded, but the Terminal command did not finish within four seconds.', { mode: 0o600 }).catch(() => {})
}

async function cancelRemoteAuthentication() {
  const attempt = remoteAuthAttempt
  if (!attempt) return false
  attempt.canceled = true
  try {
    const pid = Number((await fs.promises.readFile(attempt.sshPidFile, 'utf8')).trim())
    if (Number.isInteger(pid) && pid > 1) process.kill(pid, 'SIGTERM')
  } catch {}
  spawnSync(attempt.sshExecutable, ['-S', attempt.socket, '-O', 'exit', attempt.target], { stdio: 'ignore' })
  return true
}

async function startRemoteServer(profile, connection) {
  remoteTemporaryDirectory = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'brainana-remote-'))
  const handshake = path.join(remoteTemporaryDirectory, 'handshake.json')
  const errorFile = path.join(remoteTemporaryDirectory, 'server-error.txt')
  const logFile = path.join(app.getPath('logs'), `electron-remote-${Date.now()}.log`)
  const output = fs.openSync(logFile, 'a', 0o600)
  const runtime = runtimeDirectory()
  const args = [
    // Electron profiles use root only as the initial browser location. The SFTP
    // server is rooted at / so the SSH account's own permissions are authoritative.
    path.join(runtime, 'server.mjs'), '--mode', 'remote', '--root', '/',
    '--label', profile.name, '--ssh-target', connection.target, '--control-socket', connection.socket,
    '--ssh-executable', connection.sshExecutable,
    '--host', '127.0.0.1', '--port', '0', '--handshake-file', handshake,
    '--error-file', errorFile, '--cache', app.getPath('cache'),
    '--allowed-origin', localOrigin,
  ]
  remoteProcess = spawn(process.execPath, args, {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', output, output], windowsHide: true,
  })
  remoteProcess.once('exit', () => { fs.close(output, () => {}) })
  try {
    const result = await waitForHandshake(handshake, remoteProcess)
    return { ...result, baseUrl: `http://127.0.0.1:${result.port}`, logFile }
  } catch (error) {
    const serverMessage = await fs.promises.readFile(errorFile, 'utf8').catch(() => '')
    throw new Error([error.message, serverMessage.trim(), `Remote server log: ${logFile}`].filter(Boolean).join('\n'))
  }
}

async function stopRemote() {
  const child = remoteProcess
  remoteProcess = null
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), sleep(2_000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  if (remoteConnection) {
    spawnSync(remoteConnection.sshExecutable, ['-S', remoteConnection.socket, '-O', 'exit', remoteConnection.target], { stdio: 'ignore' })
    await fs.promises.rm(remoteConnection.socketDirectory, { recursive: true, force: true }).catch(() => {})
  }
  remoteConnection = null
  if (remoteTemporaryDirectory) await fs.promises.rm(remoteTemporaryDirectory, { recursive: true, force: true }).catch(() => {})
  remoteTemporaryDirectory = null
}

function installRemoteHandlers() {
  ipcMain.handle('brainana:profiles:list', () => readProfiles())
  ipcMain.handle('brainana:profiles:save', async (_event, candidate) => {
    const profile = validProfile(candidate)
    const profiles = await readProfiles()
    const index = profiles.findIndex(item => item.id === profile.id)
    if (index >= 0) profiles[index] = profile
    else profiles.push(profile)
    await writeProfiles(profiles)
    return profile
  })
  ipcMain.handle('brainana:profiles:delete', async (_event, id) => {
    await writeProfiles((await readProfiles()).filter(profile => profile.id !== String(id)))
    return true
  })
  ipcMain.handle('brainana:remote:status', () => remoteConnection ? {
    supported: true,
    connected: true,
    profile: remoteConnection.profile,
    initialPath: remoteConnection.profile.root,
  } : { connected: false, supported: process.platform !== 'win32' })
  ipcMain.handle('brainana:remote:cancel-connect', () => cancelRemoteAuthentication())
  ipcMain.handle('brainana:remote:disconnect', async () => { await stopRemote(); return { connected: false } })
  ipcMain.handle('brainana:remote:connect', async (_event, id) => {
    const profile = (await readProfiles()).find(item => item.id === String(id))
    if (!profile) throw new Error('The selected connection profile no longer exists.')
    await stopRemote()
    const connection = await authenticateRemote(profile)
    try {
      const endpoint = await startRemoteServer(profile, connection)
      remoteConnection = { ...connection, profile }
      return { connected: true, profile, baseUrl: endpoint.baseUrl, sessionToken: endpoint.sessionToken, initialPath: profile.root }
    } catch (error) {
      remoteConnection = connection
      await stopRemote()
      throw error
    }
  })
}

async function stopServer() {
  await cancelRemoteAuthentication()
  await stopRemote()
  const child = serverProcess
  serverProcess = null
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      sleep(2_000).then(() => { if (child.exitCode === null) child.kill('SIGKILL') }),
    ])
  }
  if (temporaryDirectory) await fs.promises.rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {})
  temporaryDirectory = null
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) app.quit()
else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
  app.on('before-quit', event => {
    if (quitting || !serverProcess) return
    event.preventDefault()
    quitting = true
    void stopServer().finally(() => app.quit())
  })
  app.on('window-all-closed', () => app.quit())
  app.whenReady().then(async () => {
    try {
      installRemoteHandlers()
      createWindow(await startLocalServer())
    } catch (error) {
      dialog.showErrorBox('Brainana Align could not start', error instanceof Error ? error.message : String(error))
      await stopServer()
      app.quit()
    }
  })
}

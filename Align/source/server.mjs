#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { VERSION, BUILD_ID, SOURCE_BASE, BEHAVIOR_REFERENCE } from './version.mjs'
import { applicationPaths, resolveExecutable } from './platformCore.mjs'
import { SftpClient, withSftp, isDirectory as sftpIsDirectory } from './sftpClient.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const arg = (name, fallback = '') => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const numberArg = (name, fallback) => {
  const value = Number(arg(name, String(fallback)))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const host = arg('--host', '127.0.0.1')
const requestedPort = Number(arg('--port', '0'))
const portFile = arg('--port-file', '')
const handshakeFile = arg('--handshake-file', '')
const errorFile = arg('--error-file', '')
const mode = arg('--mode', 'local')
const suppliedSessionToken = arg('--session-token', process.env.BRAINANA_SESSION_TOKEN || '')
const sessionToken = suppliedSessionToken || crypto.randomBytes(32).toString('hex')
const maxJsonBytes = numberArg('--max-json-bytes', 1024 * 1024)
const maxUploadBytes = numberArg('--max-upload-bytes', 16 * 1024 * 1024 * 1024)
const bodyIdleTimeoutMs = numberArg('--body-idle-timeout-ms', 60_000)
const requestTimeoutMs = numberArg('--request-timeout-ms', 30 * 60_000)
const minimumFreeBytes = numberArg('--minimum-free-bytes', 256 * 1024 * 1024)
let actualPort = requestedPort

if (!/^[0-9a-f]{64,}$/i.test(sessionToken)) {
  throw new Error('Unable to establish a strong per-launch session token')
}

const rootRaw = arg('--root', process.env.HOME || process.cwd())
const root = mode === 'local' ? path.resolve(rootRaw) : path.posix.normalize(rootRaw)
const label = arg('--label', mode === 'remote' ? 'Remote workstation' : 'This Mac')
const sshTarget = arg('--ssh-target', '')
const controlSocket = arg('--control-socket', '')
const dist = path.join(here, 'dist')
const platformPaths = applicationPaths({ version: VERSION })
const cacheRoot = arg('--cache', platformPaths.cacheRoot)
let localExportRoot = arg('--local-export-root', '')
if (localExportRoot) localExportRoot = path.resolve(localExportRoot)
const sshExecutable = arg('--ssh-executable', resolveExecutable('ssh', {
  preferred: process.platform === 'darwin' ? ['/usr/bin/ssh'] : [],
}))
const allowed = ['.nii', '.nii.gz', '.hdr', '.img', '.img.gz', '.head', '.brik', '.brik.gz', '.mgh', '.mgz', '.nrrd', '.nhdr', '.mif', '.mha', '.mhd', '.raw', '.v', '.v16', '.vmr', '.npy', '.npz', '.fib', '.src']
const isAllowed = name => allowed.some(extension => String(name).toLowerCase().endsWith(extension))

const cleanRel = rel => {
  const clean = String(rel || '').replace(/^\/+/, '').split('/').filter(part => part && part !== '.').join('/')
  if (clean.split('/').includes('..')) throw new Error('Path is outside the configured data root')
  return clean
}
const safeLocal = rel => {
  const clean = cleanRel(rel)
  const resolved = path.resolve(root, clean)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('Path is outside the configured data root')
  return { clean, resolved }
}
const safeRemote = rel => {
  const clean = cleanRel(rel)
  const resolved = path.posix.normalize(path.posix.join(root, clean))
  if (resolved !== root && !resolved.startsWith(root.replace(/\/$/, '') + '/')) throw new Error('Path is outside the configured data root')
  return { clean, resolved }
}
const sftpOptions = { sshExecutable, sshTarget, controlSocket, timeoutMs: requestTimeoutMs }
const sshConnected = () => mode !== 'remote' || Boolean(sshExecutable) && spawnSync(sshExecutable, [
  ...(controlSocket ? ['-S', controlSocket] : []), '-O', 'check', sshTarget,
], { stdio: 'ignore' }).status === 0

const json = (res, status, object) => {
  const body = JSON.stringify(object)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}
const text = (res, status, message) => {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(message)
}

function timingSafeTokenMatch(candidate) {
  if (typeof candidate !== 'string') return false
  const expected = Buffer.from(sessionToken)
  const supplied = Buffer.from(candidate)
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied)
}
function validateApiRequest(req, res) {
  const expectedHost = `${host}:${actualPort}`
  if (req.headers.host !== expectedHost) {
    text(res, 400, 'Invalid localhost host header')
    return false
  }
  const origin = req.headers.origin
  if (origin && origin !== `http://${expectedHost}`) {
    text(res, 403, 'Cross-origin request rejected')
    return false
  }
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
    text(res, 403, 'Cross-site request rejected')
    return false
  }
  if (!timingSafeTokenMatch(req.headers['x-brainana-session'])) {
    text(res, 401, 'Invalid or missing Brainana session token')
    return false
  }
  return true
}
function requireMethod(req, res, allowedMethods) {
  if (allowedMethods.includes(req.method || 'GET')) return true
  res.writeHead(405, { allow: allowedMethods.join(', '), 'content-type': 'text/plain; charset=utf-8' })
  res.end('Method not allowed')
  return false
}

function declaredLength(req) {
  const raw = req.headers['content-length']
  if (!raw) return null
  const length = Number(raw)
  if (!Number.isSafeInteger(length) || length < 0) throw Object.assign(new Error('Invalid Content-Length'), { statusCode: 400 })
  return length
}
async function ensureFreeSpace(directory, requiredBytes = 0) {
  if (typeof fs.promises.statfs !== 'function') return
  const info = await fs.promises.statfs(directory)
  const available = Number(info.bavail) * Number(info.bsize)
  const required = Math.max(0, Number(requiredBytes) || 0) + minimumFreeBytes
  if (Number.isFinite(available) && available < required) {
    throw Object.assign(new Error(`Insufficient free space: ${available} bytes available, ${required} bytes required`), { statusCode: 507, code: 'ENOSPC' })
  }
}
async function verifyFileSize(filename, expectedBytes) {
  const stat = await fs.promises.stat(filename)
  if (!stat.isFile() || stat.size !== expectedBytes) {
    throw Object.assign(new Error(`Written file verification failed: expected ${expectedBytes} bytes, found ${stat.size}`), { statusCode: 500, code: 'EIO' })
  }
  return stat.size
}
async function atomicReplaceLocal(temporary, destination, overwrite) {
  if (!overwrite) {
    await fs.promises.link(temporary, destination)
    await fs.promises.rm(temporary, { force: true })
    return
  }
  try {
    await fs.promises.rename(temporary, destination)
    return
  } catch (error) {
    if (!['EEXIST', 'EPERM', 'EACCES'].includes(error?.code)) throw error
  }
  const backup = `${destination}.brainana-backup-${process.pid}-${Date.now()}`
  let backedUp = false
  try {
    try {
      await fs.promises.rename(destination, backup)
      backedUp = true
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    await fs.promises.rename(temporary, destination)
    if (backedUp) await fs.promises.rm(backup, { force: true })
  } catch (error) {
    if (backedUp) {
      await fs.promises.rm(destination, { force: true }).catch(() => {})
      await fs.promises.rename(backup, destination).catch(() => {})
    }
    throw error
  } finally {
    await fs.promises.rm(backup, { force: true }).catch(() => {})
  }
}

function validateDeclaredLength(req, maximum) {
  const length = declaredLength(req)
  if (length === null) return
  if (length > maximum) throw Object.assign(new Error(`Request body exceeds the ${maximum}-byte limit`), { statusCode: 413 })
}
async function readBody(req, maximum) {
  validateDeclaredLength(req, maximum)
  const chunks = []
  let size = 0
  req.setTimeout(bodyIdleTimeoutMs, () => req.destroy(Object.assign(new Error('Request body timed out'), { statusCode: 408 })))
  for await (const chunk of req) {
    size += chunk.length
    if (size > maximum) throw Object.assign(new Error(`Request body exceeds the ${maximum}-byte limit`), { statusCode: 413 })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
async function readJson(req) {
  const type = String(req.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase()
  if (type !== 'application/json') throw Object.assign(new Error('Expected application/json'), { statusCode: 415 })
  const body = await readBody(req, maxJsonBytes)
  try {
    return JSON.parse(body.toString() || '{}')
  } catch {
    throw Object.assign(new Error('Invalid JSON request body'), { statusCode: 400 })
  }
}
async function streamRequestToFile(req, filename, maximum) {
  validateDeclaredLength(req, maximum)
  let size = 0
  req.setTimeout(bodyIdleTimeoutMs, () => req.destroy(Object.assign(new Error('Upload timed out'), { statusCode: 408 })))
  const writer = fs.createWriteStream(filename, { flags: 'wx' })
  try {
    await new Promise((resolve, reject) => {
      const fail = error => reject(error)
      req.on('aborted', () => fail(Object.assign(new Error('Upload was aborted'), { statusCode: 499 })))
      req.on('error', fail)
      writer.on('error', fail)
      writer.on('finish', resolve)
      req.on('data', chunk => {
        size += chunk.length
        if (size > maximum) req.destroy(Object.assign(new Error(`Upload exceeds the ${maximum}-byte limit`), { statusCode: 413 }))
      })
      req.pipe(writer)
    })
    return size
  } catch (error) {
    writer.destroy()
    await fs.promises.rm(filename, { force: true }).catch(() => {})
    throw error
  }
}

async function list(rel, dirsOnly = false) {
  if (mode === 'local') {
    const { clean, resolved } = safeLocal(rel)
    const stat = await fs.promises.stat(resolved)
    if (!stat.isDirectory()) throw new Error('Not a directory')
    const dirents = await fs.promises.readdir(resolved, { withFileTypes: true })
    const entries = []
    for (const entry of dirents) {
      if (entry.name.startsWith('.') || (!entry.isDirectory() && (dirsOnly || !isAllowed(entry.name)))) continue
      let size
      if (entry.isFile()) size = (await fs.promises.stat(path.join(resolved, entry.name))).size
      entries.push({ name: entry.name, path: path.posix.join(clean, entry.name), directory: entry.isDirectory(), size })
    }
    entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    return { path: clean, parent: clean ? (path.posix.dirname(clean) === '.' ? '' : path.posix.dirname(clean)) : null, entries: dirsOnly ? entries.filter(entry => entry.directory) : entries }
  }
  const { clean, resolved } = safeRemote(rel)
  const entries = await withSftp(sftpOptions, async sftp => {
    const directoryAttrs = await sftp.stat(resolved)
    if (!sftpIsDirectory(directoryAttrs)) throw new Error('Not a directory')
    const result = []
    for (const item of await sftp.list(resolved)) {
      const name = item.name
      if (!name || name === '.' || name === '..' || name.startsWith('.')) continue
      const directory = sftpIsDirectory(item.attrs) || item.longname.startsWith('d')
      if (!directory && (dirsOnly || !isAllowed(name))) continue
      result.push({ name, path: path.posix.join(clean, name), directory, size: directory ? undefined : item.attrs.size })
    }
    return result
  })
  entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  return { path: clean, parent: clean ? (path.posix.dirname(clean) === '.' ? '' : path.posix.dirname(clean)) : null, entries: dirsOnly ? entries.filter(entry => entry.directory) : entries }
}

async function receiveTemp(req) {
  await fs.promises.mkdir(cacheRoot, { recursive: true })
  await ensureFreeSpace(cacheRoot, declaredLength(req) || 0)
  const filename = path.join(cacheRoot, `upload-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const size = await streamRequestToFile(req, filename, maxUploadBytes)
  await verifyFileSize(filename, size)
  return { filename, size }
}
async function save(req, rel, overwrite) {
  if (mode === 'local') {
    const { clean, resolved } = safeLocal(rel)
    await fs.promises.mkdir(path.dirname(resolved), { recursive: true })
    if (!overwrite && fs.existsSync(resolved)) {
      const error = new Error('File already exists')
      error.code = 'EEXIST'
      throw error
    }
    const temporary = resolved + `.brainana-part-${process.pid}-${Date.now()}`
    try {
      await ensureFreeSpace(path.dirname(resolved), declaredLength(req) || 0)
      const size = await streamRequestToFile(req, temporary, maxUploadBytes)
      await verifyFileSize(temporary, size)
      await atomicReplaceLocal(temporary, resolved, overwrite)
      await verifyFileSize(resolved, size)
      return { path: clean, size }
    } finally {
      await fs.promises.rm(temporary, { force: true }).catch(() => {})
    }
  }
  const { clean, resolved } = safeRemote(rel)
  const { filename: local, size } = await receiveTemp(req)
  const remoteTemporary = resolved + `.brainana-part-${process.pid}-${Date.now()}`
  const remoteBackup = resolved + `.brainana-backup-${process.pid}-${Date.now()}`
  try {
    await withSftp(sftpOptions, async sftp => {
      if (!overwrite && await sftp.exists(resolved)) {
        const error = new Error('File already exists')
        error.code = 'EEXIST'
        throw error
      }
      await sftp.mkdirp(path.posix.dirname(resolved))
      const uploaded = await sftp.uploadFile(local, remoteTemporary, { exclusive: true })
      if (uploaded !== size) throw new Error(`Remote upload verification failed: expected ${size} bytes, wrote ${uploaded}`)
      const attrs = await sftp.stat(remoteTemporary)
      if (attrs.size !== size) throw new Error(`Remote upload verification failed: expected ${size} bytes, found ${attrs.size}`)
      if (!overwrite) {
        await sftp.rename(remoteTemporary, resolved)
        return
      }
      const hadDestination = await sftp.exists(resolved)
      let backedUp = false
      try {
        if (hadDestination) { await sftp.rename(resolved, remoteBackup); backedUp = true }
        await sftp.rename(remoteTemporary, resolved)
        if (backedUp) await sftp.remove(remoteBackup)
      } catch (error) {
        if (backedUp) {
          if (await sftp.exists(resolved)) await sftp.remove(resolved).catch(() => {})
          await sftp.rename(remoteBackup, resolved).catch(() => {})
        }
        throw error
      } finally {
        if (await sftp.exists(remoteBackup)) await sftp.remove(remoteBackup).catch(() => {})
      }
    })
    return { path: clean, size }
  } finally {
    await fs.promises.rm(local, { force: true }).catch(() => {})
    await withSftp(sftpOptions, async sftp => { if (await sftp.exists(remoteTemporary)) await sftp.remove(remoteTemporary) }).catch(() => {})
  }
}

function cleanExportFilename(value) {
  const filename = path.basename(String(value || '').trim())
  if (!filename || filename === '.' || filename === '..' || filename.includes('\0')) {
    throw Object.assign(new Error('Invalid export filename'), { statusCode: 400 })
  }
  return filename.replace(/[\\/:*?"<>|]/g, '_')
}
function chooseMacFolder() {
  if (process.platform !== 'darwin') {
    throw Object.assign(new Error('Native local folder selection is currently available only in the macOS app. Browser download remains available.'), { statusCode: 501 })
  }
  const script = 'POSIX path of (choose folder with prompt "Choose a folder for Brainana Align exports")'
  const result = spawnSync('/usr/bin/osascript', ['-e', script], { encoding: 'utf8', timeout: 5 * 60_000 })
  if (result.status !== 0) {
    const detail = String(result.stderr || '').trim()
    if (detail.includes('User canceled') || detail.includes('-128')) return null
    throw new Error(detail || 'Unable to open the macOS folder chooser')
  }
  const selected = String(result.stdout || '').trim()
  if (!selected) return null
  return path.resolve(selected)
}
async function saveLocalExport(req, filename, overwrite) {
  if (!localExportRoot) throw Object.assign(new Error('Choose a local export folder before exporting.'), { statusCode: 409, code: 'ENOEXPORTROOT' })
  const safeName = cleanExportFilename(filename)
  const destination = path.join(localExportRoot, safeName)
  if (path.dirname(destination) !== localExportRoot) throw Object.assign(new Error('Invalid export destination'), { statusCode: 400 })
  await fs.promises.mkdir(localExportRoot, { recursive: true })
  if (!overwrite && fs.existsSync(destination)) {
    const error = new Error('File already exists')
    error.code = 'EEXIST'
    throw error
  }
  const temporary = destination + `.brainana-part-${process.pid}-${Date.now()}`
  try {
    await ensureFreeSpace(localExportRoot, declaredLength(req) || 0)
    const size = await streamRequestToFile(req, temporary, maxUploadBytes)
    await verifyFileSize(temporary, size)
    await atomicReplaceLocal(temporary, destination, overwrite)
    await verifyFileSize(destination, size)
    return { path: destination, size }
  } finally {
    await fs.promises.rm(temporary, { force: true }).catch(() => {})
  }
}

const mime = filename => filename.endsWith('.html') ? 'text/html; charset=utf-8'
  : filename.endsWith('.js') ? 'text/javascript; charset=utf-8'
    : filename.endsWith('.css') ? 'text/css; charset=utf-8'
      : 'application/octet-stream'

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}`)
    if (url.pathname.startsWith('/api/')) {
      if (!validateApiRequest(req, res)) return
      if (url.pathname === '/api/health') {
        if (!requireMethod(req, res, ['GET'])) return
        const connected = sshConnected()
        return json(res, connected ? 200 : 503, { ok: connected, app: 'Brainana Align', version: VERSION, buildId: BUILD_ID, mode, connection: mode === 'remote' ? (connected ? 'ssh-connected' : 'ssh-disconnected') : 'local' })
      }
      if (url.pathname === '/api/version') {
        if (!requireMethod(req, res, ['GET'])) return
        return json(res, 200, { version: VERSION, buildId: BUILD_ID, sourceBase: SOURCE_BASE, behaviorReference: BEHAVIOR_REFERENCE })
      }
      if (url.pathname === '/api/runtime') {
        if (!requireMethod(req, res, ['GET'])) return
        return json(res, 200, { mode, label, root, port: actualPort, host, version: VERSION, buildId: BUILD_ID, sshTarget: mode === 'remote' ? sshTarget : undefined, controlSocket: mode === 'remote' ? controlSocket : undefined, cacheRoot })
      }
      if (url.pathname === '/api/config') {
        if (!requireMethod(req, res, ['GET'])) return
        return json(res, 200, { enabled: true, mode, label, rootName: path.posix.basename(root) || root, remote: mode === 'remote' })
      }
      if (url.pathname === '/api/list') {
        if (!requireMethod(req, res, ['GET'])) return
        return json(res, 200, await list(url.searchParams.get('path') || '', false))
      }
      if (url.pathname === '/api/local-export-folder') {
        if (!requireMethod(req, res, ['GET'])) return
        return json(res, 200, {
          selected: Boolean(localExportRoot),
          path: localExportRoot || undefined,
          name: localExportRoot ? path.basename(localExportRoot) : undefined,
        })
      }
      if (url.pathname === '/api/local-export-folder/select') {
        if (!requireMethod(req, res, ['POST'])) return
        const selected = chooseMacFolder()
        if (!selected) return json(res, 200, { selected: false })
        const stat = await fs.promises.stat(selected)
        if (!stat.isDirectory()) throw Object.assign(new Error('The selected export location is not a folder'), { statusCode: 400 })
        await fs.promises.access(selected, fs.constants.W_OK)
        localExportRoot = selected
        return json(res, 200, { selected: true, path: localExportRoot, name: path.basename(localExportRoot) })
      }
      if (url.pathname === '/api/local-export-file') {
        if (!requireMethod(req, res, ['POST'])) return
        try {
          return json(res, 200, await saveLocalExport(req, url.searchParams.get('filename') || '', url.searchParams.get('overwrite') === '1'))
        } catch (error) {
          if (error.code === 'EEXIST') return json(res, 409, { error: 'File already exists' })
          throw error
        }
      }
      if (url.pathname === '/api/save-list') {
        if (!requireMethod(req, res, ['GET'])) return
        return json(res, 200, await list(url.searchParams.get('path') || '', true))
      }
      if (url.pathname === '/api/save-mkdir') {
        if (!requireMethod(req, res, ['POST'])) return
        const body = await readJson(req)
        if (mode === 'local') {
          const { clean, resolved } = safeLocal(body.path || '')
          await fs.promises.mkdir(resolved, { recursive: false })
          return json(res, 200, { path: clean })
        }
        const { clean, resolved } = safeRemote(body.path || '')
        await withSftp(sftpOptions, sftp => sftp.mkdir(resolved))
        return json(res, 200, { path: clean })
      }
      if (url.pathname === '/api/save-file') {
        if (!requireMethod(req, res, ['POST'])) return
        try {
          return json(res, 200, await save(req, url.searchParams.get('path') || '', url.searchParams.get('overwrite') === '1'))
        } catch (error) {
          if (error.code === 'EEXIST') return json(res, 409, { error: 'File already exists' })
          throw error
        }
      }
      if (url.pathname === '/api/file') {
        if (!requireMethod(req, res, ['GET'])) return
        const rel = url.searchParams.get('path') || ''
        if (!isAllowed(rel)) return text(res, 415, 'Unsupported file type')
        if (mode === 'local') {
          const { resolved } = safeLocal(rel)
          const stat = await fs.promises.stat(resolved)
          if (!stat.isFile()) return text(res, 400, 'Not a file')
          res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': stat.size,
            'content-disposition': `attachment; filename="${path.basename(resolved).replaceAll('"', '')}"`,
            'x-content-type-options': 'nosniff',
          })
          return fs.createReadStream(resolved).pipe(res)
        }
        const { resolved } = safeRemote(rel)
        const sftp = await new SftpClient(sftpOptions).init()
        const attrs = await sftp.stat(resolved)
        if (sftpIsDirectory(attrs)) { await sftp.end(); return text(res, 400, 'Not a file') }
        const size = attrs.size
        res.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': size,
          'content-disposition': `attachment; filename="${path.posix.basename(resolved).replaceAll('"', '')}"`,
          'x-content-type-options': 'nosniff',
        })
        let stopped = false
        const stop = () => { stopped = true; sftp.end().catch(() => {}) }
        req.on('aborted', stop)
        res.on('close', () => { if (!res.writableEnded) stop() })
        try {
          for await (const chunk of sftp.readFile(resolved)) {
            if (stopped) break
            if (!res.write(chunk)) await new Promise(resolve => res.once('drain', resolve))
          }
          if (!stopped) res.end()
        } finally {
          await sftp.end()
        }
        return
      }
      return text(res, 404, 'API endpoint not found')
    }

    if (!requireMethod(req, res, ['GET', 'HEAD'])) return
    let relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    let filename = path.resolve(dist, '.' + relative)
    if (filename !== dist && !filename.startsWith(dist + path.sep)) return text(res, 403, 'Forbidden')
    try {
      if ((await fs.promises.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html')
    } catch {
      filename = path.join(dist, 'index.html')
    }
    const stat = await fs.promises.stat(filename)
    const headers = {
      'content-type': mime(filename),
      'content-length': stat.size,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cross-origin-opener-policy': 'same-origin',
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    }
    res.writeHead(200, headers)
    if (req.method === 'HEAD') return res.end()
    fs.createReadStream(filename).pipe(res)
  } catch (error) {
    console.error(error)
    const status = Number(error.statusCode) || (error.code === 'ENOENT' ? 404 : 500)
    if (!res.headersSent) json(res, status, { error: error.message || 'Server error' })
    else res.destroy()
  }
})

server.requestTimeout = requestTimeoutMs
server.headersTimeout = 15_000
server.keepAliveTimeout = 5_000
server.maxHeadersCount = 100
server.on('clientError', (error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
})
server.on('error', async error => {
  const message = `${error.code || 'SERVER_ERROR'}: ${error.message}`
  console.error(message)
  if (errorFile) {
    try {
      await fs.promises.mkdir(path.dirname(errorFile), { recursive: true })
      await fs.promises.writeFile(errorFile, message + '\n', { mode: 0o600 })
    } catch {}
  }
  process.exitCode = 1
})
server.listen(requestedPort, host, async () => {
  actualPort = server.address().port
  try {
    if (handshakeFile) {
      await fs.promises.mkdir(path.dirname(handshakeFile), { recursive: true })
      const temporary = `${handshakeFile}.tmp-${process.pid}`
      const payload = JSON.stringify({
        schemaVersion: 1,
        port: actualPort,
        sessionToken,
        pid: process.pid,
        version: VERSION,
        buildId: BUILD_ID,
      }) + '\n'
      await fs.promises.writeFile(temporary, payload, { mode: 0o600 })
      await fs.promises.rename(temporary, handshakeFile)
    }
    if (portFile) {
      await fs.promises.mkdir(path.dirname(portFile), { recursive: true })
      const temporary = `${portFile}.tmp-${process.pid}`
      await fs.promises.writeFile(temporary, `${actualPort}\n`, { mode: 0o600 })
      await fs.promises.rename(temporary, portFile)
    }
    console.log(`Brainana Align ${VERSION} (${BUILD_ID}) ${mode} at http://${host}:${actualPort}`)
  } catch (error) {
    const message = `HANDSHAKE_ERROR: ${error.message}`
    console.error(message)
    if (errorFile) {
      try {
        await fs.promises.mkdir(path.dirname(errorFile), { recursive: true })
        await fs.promises.writeFile(errorFile, message + '\n', { mode: 0o600 })
      } catch {}
    }
    server.close(() => process.exit(1))
  }
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))

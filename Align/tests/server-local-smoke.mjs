import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-smoke-'))
const handshake = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-port-'))
const portFile = path.join(handshake, 'port')
const token = randomBytes(32).toString('hex')
fs.writeFileSync(path.join(root, 'x.nii'), Buffer.from([1, 2, 3]))
const testDir = path.dirname(new URL(import.meta.url).pathname)
const serverPath = path.resolve(testDir, '../source/server.mjs')
const child = spawn(process.execPath, [serverPath, '--port', '0', '--port-file', portFile, '--root', root, '--session-token', token], { stdio: ['ignore', 'pipe', 'pipe'] })
let stderr = ''
child.stderr.on('data', data => { stderr += data })
const headers = { 'x-brainana-session': token }
try {
  let port = 0
  for (let index = 0; index < 200; index += 1) {
    if (fs.existsSync(portFile)) { port = Number(fs.readFileSync(portFile, 'utf8').trim()); break }
    if (child.exitCode !== null) throw new Error(`server exited early: ${stderr}`)
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  if (!port) throw new Error(`server did not publish port: ${stderr}`)
  const health = await fetch(`http://127.0.0.1:${port}/api/health`, { headers }).then(response => response.json())
  if (!health.ok) throw new Error('health')
  const listing = await fetch(`http://127.0.0.1:${port}/api/list`, { headers }).then(response => response.json())
  if (listing.entries[0].name !== 'x.nii') throw new Error('list')
  console.log('local smoke ok')
} finally {
  child.kill('SIGTERM')
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(handshake, { recursive: true, force: true })
}

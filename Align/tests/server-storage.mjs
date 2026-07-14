import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-storage-root-'))
const handshake = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-storage-port-'))
const portFile = path.join(handshake, 'port')
const token = randomBytes(32).toString('hex')
const serverPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../source/server.mjs')
const child = spawn(process.execPath, [serverPath, '--port', '0', '--port-file', portFile, '--root', root, '--session-token', token, '--minimum-free-bytes', '1'], { stdio: ['ignore', 'pipe', 'pipe'] })
let stderr = ''
child.stderr.on('data', data => { stderr += data })
try {
  let port = 0
  for (let index = 0; index < 300; index += 1) {
    if (fs.existsSync(portFile)) { port = Number(fs.readFileSync(portFile, 'utf8').trim()); break }
    if (child.exitCode !== null) throw new Error(`server exited early: ${stderr}`)
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.ok(port)
  const base = `http://127.0.0.1:${port}`
  const headers = { 'x-brainana-session': token, 'content-type': 'application/octet-stream' }
  const first = Buffer.from('first-version')
  const second = Buffer.from('second-version-is-longer')
  let response = await fetch(`${base}/api/save-file?path=result.nii`, { method: 'POST', headers, body: first })
  assert.equal(response.status, 200)
  assert.deepEqual(fs.readFileSync(path.join(root, 'result.nii')), first)
  response = await fetch(`${base}/api/save-file?path=result.nii`, { method: 'POST', headers, body: second })
  assert.equal(response.status, 409)
  assert.deepEqual(fs.readFileSync(path.join(root, 'result.nii')), first)
  response = await fetch(`${base}/api/save-file?path=result.nii&overwrite=1`, { method: 'POST', headers, body: second })
  assert.equal(response.status, 200)
  assert.deepEqual(fs.readFileSync(path.join(root, 'result.nii')), second)
  const leftovers = fs.readdirSync(root).filter(name => name.includes('.brainana-part-') || name.includes('.brainana-backup-'))
  assert.deepEqual(leftovers, [])
  console.log('server storage checks passed')
} finally {
  child.kill('SIGTERM')
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(handshake, { recursive: true, force: true })
}

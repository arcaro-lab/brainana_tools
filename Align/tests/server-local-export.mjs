import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-export-data-'))
const exportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-export-output-'))
const handshake = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-export-port-'))
const portFile = path.join(handshake, 'port')
const token = randomBytes(32).toString('hex')
const serverPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../source/server.mjs')
const child = spawn(process.execPath, [
  serverPath,
  '--port', '0',
  '--port-file', portFile,
  '--root', dataRoot,
  '--local-export-root', exportRoot,
  '--session-token', token,
  '--minimum-free-bytes', '1',
], { stdio: ['ignore', 'pipe', 'pipe'] })
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
  const auth = { 'x-brainana-session': token }
  let response = await fetch(`${base}/api/local-export-folder`, { headers: auth })
  assert.equal(response.status, 200)
  const selected = await response.json()
  assert.equal(selected.selected, true)
  assert.equal(selected.path, exportRoot)

  const first = Buffer.from('export-version-one')
  const second = Buffer.from('export-version-two-longer')
  const uploadHeaders = { ...auth, 'content-type': 'application/octet-stream' }
  response = await fetch(`${base}/api/local-export-file?filename=alignment.json`, { method: 'POST', headers: uploadHeaders, body: first })
  assert.equal(response.status, 200)
  assert.deepEqual(fs.readFileSync(path.join(exportRoot, 'alignment.json')), first)

  response = await fetch(`${base}/api/local-export-file?filename=alignment.json`, { method: 'POST', headers: uploadHeaders, body: second })
  assert.equal(response.status, 409)
  assert.deepEqual(fs.readFileSync(path.join(exportRoot, 'alignment.json')), first)

  response = await fetch(`${base}/api/local-export-file?filename=alignment.json&overwrite=1`, { method: 'POST', headers: uploadHeaders, body: second })
  assert.equal(response.status, 200)
  assert.deepEqual(fs.readFileSync(path.join(exportRoot, 'alignment.json')), second)

  response = await fetch(`${base}/api/local-export-file?filename=..%2Fevil.txt`, { method: 'POST', headers: uploadHeaders, body: first })
  assert.equal(response.status, 200)
  assert.ok(fs.existsSync(path.join(exportRoot, 'evil.txt')))
  assert.equal(fs.existsSync(path.join(path.dirname(exportRoot), 'evil.txt')), false)

  const leftovers = fs.readdirSync(exportRoot).filter(name => name.includes('.brainana-part-') || name.includes('.brainana-backup-'))
  assert.deepEqual(leftovers, [])
  console.log('server local export checks passed')
} finally {
  child.kill('SIGTERM')
  fs.rmSync(dataRoot, { recursive: true, force: true })
  fs.rmSync(exportRoot, { recursive: true, force: true })
  fs.rmSync(handshake, { recursive: true, force: true })
}

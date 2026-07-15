import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'brainana-cors-'))
const handshake = path.join(temporary, 'handshake.json')
const origin = 'http://127.0.0.1:45678'
const child = spawn(process.execPath, [path.join(root, 'source', 'server.mjs'), '--mode', 'local', '--root', temporary, '--port', '0', '--handshake-file', handshake, '--allowed-origin', origin], { stdio: 'ignore' })
try {
  let payload
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try { payload = JSON.parse(fs.readFileSync(handshake, 'utf8')); break } catch {}
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.ok(payload?.port && payload?.sessionToken)
  const base = `http://127.0.0.1:${payload.port}`
  const preflight = await fetch(`${base}/api/list`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-brainana-session' } })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
  const response = await fetch(`${base}/api/config`, { headers: { origin, 'x-brainana-session': payload.sessionToken } })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), origin)
  console.log('remote endpoint CORS and token checks passed')
} finally {
  child.kill('SIGTERM')
  fs.rmSync(temporary, { recursive: true, force: true })
}

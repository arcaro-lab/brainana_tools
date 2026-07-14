import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'source', 'src')
for (const file of ['appTypes.ts','optimizationWindows.ts','viewInteraction.ts','coordinateProjection.ts','crosshairController.ts','landmarkRenderer.ts','sessionPersistence.ts','exportArtifacts.ts','runtimeClient.ts','filesystemClient.ts','remoteVolumeLoader.ts','workstationBrowser.ts','exportDestination.ts','optimizationWindowInteraction.ts']) {
  assert.ok(fs.existsSync(path.join(src,file)), `missing modular source file ${file}`)
}
const main = fs.readFileSync(path.join(src,'main.ts'),'utf8')
for (const module of ['optimizationWindows','viewInteraction','coordinateProjection','crosshairController','landmarkRenderer','sessionPersistence','exportArtifacts','optimizationWindowInteraction']) {
  assert.match(main, new RegExp(`from './${module}'`), `main.ts must use ${module}`)
}
assert.doesNotMatch(main, /function withinOptimizationWindows/)
assert.doesNotMatch(main, /function installWheelZoomAndSlice/)
assert.doesNotMatch(main, /function markerDepthDistance/)
assert.doesNotMatch(main, /document\.createElementNS\([^\n]+review-marker/)
assert.doesNotMatch(main, /type SessionPayload/)
assert.doesNotMatch(main, /function geometryDifference/)
assert.doesNotMatch(main, /function matrixText/)
assert.doesNotMatch(main, /frac2canvasPos\(nv\.mm2frac\(point\)\)/)
const lines = main.split('\n').length
assert.ok(lines < 1050, `main.ts remains too large after refactor: ${lines} lines`)
console.log(`source architecture checks passed (${lines} lines in main.ts)`)

const runtimeIntegration = fs.readFileSync(path.join(src,'runtimeIntegration.ts'),'utf8')
assert.ok(runtimeIntegration.includes('installExportDestination'), 'runtimeIntegration must compose export destination module')
assert.ok(runtimeIntegration.includes('createWorkstationBrowser'), 'runtimeIntegration must compose workstation browser module')
for (const forbidden of ['server-browser-modal','ba-export-panel','/api/save-file','/api/file?path=']) {
  assert.ok(!runtimeIntegration.includes(forbidden), `runtimeIntegration should not contain implementation detail ${forbidden}`)
}
console.log('runtime integration architecture checks passed')

const server = fs.readFileSync(path.join(root,'source','server.mjs'),'utf8')
assert.match(server, /from '\.\/sftpClient\.mjs'/)
for (const forbidden of ['stat -c %s','find ${','/usr/bin/scp',' cat ${']) assert.ok(!server.includes(forbidden), `server must not use remote shell transport: ${forbidden}`)
console.log('structured SFTP architecture checks passed')

const launcherSource = fs.readFileSync(path.resolve(root, 'packaging/brainana-align-launcher'), 'utf8')
if (launcherSource.includes("randomBytes(32)") || launcherSource.includes('SESSION_TOKEN="$("$NODE"')) {
  throw new Error('Launcher must not start a second Node process to generate the session token')
}
if (!launcherSource.includes('--handshake-file "$HANDSHAKE_FILE"')) {
  throw new Error('Launcher must use the server-owned atomic handshake file')
}
const serverSource = fs.readFileSync(path.resolve(root, 'source/server.mjs'), 'utf8')
if (!serverSource.includes("crypto.randomBytes(32).toString('hex')") || !serverSource.includes('sessionToken,')) {
  throw new Error('Server must generate and publish the per-launch session token')
}

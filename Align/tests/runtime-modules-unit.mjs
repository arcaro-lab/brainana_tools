import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'source', 'src')
const read = name => fs.readFileSync(path.join(src, name), 'utf8')

const runtime = read('runtimeClient.ts')
const filesystem = read('filesystemClient.ts')
const loader = read('remoteVolumeLoader.ts')
const browser = read('workstationBrowser.ts')
const destination = read('exportDestination.ts')
const integration = read('runtimeIntegration.ts')

assert.match(runtime, /loadRuntimeConfig/)
assert.match(runtime, /isRemoteRuntime/)
assert.match(filesystem, /listVolumeEntries/)
assert.match(filesystem, /readVolumeFile/)
assert.match(filesystem, /saveRemoteBlob/)
assert.match(loader, /AbortController/)
assert.match(loader, /controller\.signal\.aborted/)
assert.match(browser, /createWorkstationBrowser/)
assert.match(browser, /RemoteVolumeLoader/)
assert.match(destination, /installExportDestination/)
assert.match(destination, /chooseLocalExportFolder/)
assert.match(destination, /saveLocalExportBlob/)
assert.doesNotMatch(destination, /showDirectoryPicker/)
assert.match(destination, /saveRemoteBlob/)
assert.match(integration, /installExportDestination/)
assert.match(integration, /createWorkstationBrowser/)
assert.doesNotMatch(integration, /innerHTML/)
assert.doesNotMatch(integration, /fetch\(/)
assert.ok(filesystem.length < 4000, 'filesystem client should remain focused')
assert.ok(runtime.length < 2000, 'runtime client should remain focused')
console.log('runtime module unit checks passed')

import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { applicationPaths, browserLaunchSpec, executableCandidates, resolveExecutable, runtimeRelativePath } from '../source/platformCore.mjs'

const home = path.join(path.sep, 'Users', 'tester')
const mac = applicationPaths({ platform: 'darwin', home, version: '1.2.3', env: {} })
assert.equal(mac.cacheRoot, path.join(home, 'Library', 'Caches', 'Brainana Align', '1.2.3'))
assert.equal(mac.logRoot, path.join(home, 'Library', 'Application Support', 'Brainana Align', 'logs'))

const linux = applicationPaths({ platform: 'linux', home: '/home/tester', version: '1.2.3', env: {} })
assert.equal(linux.configRoot, '/home/tester/.config/brainana-align')
assert.equal(linux.cacheRoot, '/home/tester/.cache/brainana-align/1.2.3')
assert.equal(linux.logRoot, '/home/tester/.local/state/brainana-align/logs')
const linuxXdg = applicationPaths({ platform: 'linux', home: '/h', version: 'v', env: { XDG_CONFIG_HOME: '/cfg', XDG_CACHE_HOME: '/cache', XDG_STATE_HOME: '/state', XDG_DATA_HOME: '/data' } })
assert.equal(linuxXdg.configRoot, '/cfg/brainana-align')
assert.equal(linuxXdg.cacheRoot, '/cache/brainana-align/v')

const windows = applicationPaths({ platform: 'win32', home: 'C:\\Users\\tester', version: '1.2.3', env: { APPDATA: 'R:\\AppData', LOCALAPPDATA: 'L:\\AppData' } })
assert.match(windows.configRoot, /Brainana Align$/)
assert.match(windows.cacheRoot, /Brainana Align[\\/]Cache[\\/]1\.2\.3$/)

assert.deepEqual(browserLaunchSpec('http://127.0.0.1:1', { platform: 'darwin' }).args, ['http://127.0.0.1:1'])
assert.equal(browserLaunchSpec('u', { platform: 'linux' }).command, 'xdg-open')
assert.equal(browserLaunchSpec('u', { platform: 'win32' }).command, 'cmd.exe')
assert.equal(runtimeRelativePath({ platform: 'darwin', arch: 'arm64' }), path.join('darwin-arm64', 'node'))
assert.equal(runtimeRelativePath({ platform: 'linux', arch: 'x64' }), path.join('linux-x64', 'node'))
assert.equal(runtimeRelativePath({ platform: 'win32', arch: 'x64' }), path.join('win32-x64', 'node.exe'))

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brainana-platform-'))
const executable = path.join(temp, process.platform === 'win32' ? 'demo.exe' : 'demo')
fs.writeFileSync(executable, '')
if (process.platform !== 'win32') fs.chmodSync(executable, 0o755)
const delimiter = process.platform === 'win32' ? ';' : ':'
const candidates = executableCandidates('demo', { platform: process.platform, env: { PATH: temp, PATHEXT: '.EXE' } })
assert(candidates.length >= 1)
const found = resolveExecutable(process.platform === 'win32' ? 'demo' : 'demo', { platform: process.platform, env: { PATH: temp, PATHEXT: '.EXE' } })
assert(found)
fs.rmSync(temp, { recursive: true, force: true })

console.log('Platform core tests passed')

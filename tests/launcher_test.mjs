// Unit tests for core-launcher/launch.mjs browserCommand: the per-OS "open a URL in the
// default browser" dispatch. Platform is injectable so all three branches are verified on any
// host — this is exactly the kind of process.platform switch that ships broken to an OS the
// developer never ran on.
import assert from 'node:assert/strict'
import { browserCommand } from '@brainana/core-launcher/launch.mjs'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

const url = 'http://127.0.0.1:5173/'

assert.deepEqual(browserCommand(url, 'darwin'), ['open', [url]], 'macOS uses open')
assert.deepEqual(browserCommand(url, 'win32'), ['cmd', ['/c', 'start', '', url]], 'Windows uses cmd /c start (empty title arg)')
assert.deepEqual(browserCommand(url, 'linux'), ['xdg-open', [url]], 'Linux uses xdg-open')
assert.deepEqual(browserCommand(url, 'freebsd'), ['xdg-open', [url]], 'unknown platform falls back to xdg-open')
ok('browserCommand dispatches to the correct opener per platform')

// The Windows form must keep the empty "" title argument: `start "title" url`. Without it,
// start treats the URL as the window title and opens nothing.
const [, winArgs] = browserCommand(url, 'win32')
assert.equal(winArgs[2], '', 'Windows start keeps the empty title placeholder')
ok('Windows start command preserves the empty title placeholder')

console.log(`launcher_test: ${passed} checks passed`)

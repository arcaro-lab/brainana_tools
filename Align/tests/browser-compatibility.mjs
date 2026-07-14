import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'source', 'src', 'browserCapabilities.ts'), 'utf8')
const interaction = fs.readFileSync(path.join(root, 'source', 'src', 'viewInteraction.ts'), 'utf8')
const main = fs.readFileSync(path.join(root, 'source', 'src', 'main.ts'), 'utf8')
const exportDestination = fs.readFileSync(path.join(root, 'source', 'src', 'exportDestination.ts'), 'utf8')
assert.match(source, /getContext\('webgl2'/)
assert.match(source, /normalizeWheelDelta/)
assert.match(source, /deltaMode === 1/)
assert.match(source, /deltaMode === 2/)
assert.match(interaction, /normalizeWheelDelta\(event/)
assert.match(main, /installBrowserCompatibilityBanner/)
assert.match(main, /if \(browserReady\)/)
assert.match(exportDestination, /Browser downloads if no folder is selected/)
assert.match(exportDestination, /chooseLocalExportFolder/)
assert.doesNotMatch(exportDestination, /showDirectoryPicker/)
console.log('browser compatibility module checks passed')

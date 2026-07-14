import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const require = createRequire(path.join(root, 'source', 'package.json'))
const ts = require('typescript')
const source = path.join(root, 'source', 'src', 'optimizationWindows.ts')
let code = fs.readFileSync(source, 'utf8')
code = code.replace(/^import type .*$/gm, '')
const output = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  fileName: source,
}).outputText
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brainana-window-test-'))
const modulePath = path.join(temp, 'optimizationWindows.mjs')
fs.writeFileSync(modulePath, output)
const mod = await import(pathToFileURL(modulePath).href)

const empty = { mri: {}, ct: {} }
assert.equal(mod.countOptimizationWindows(empty, 'mri'), 0)
assert.equal(mod.optimizationConstraint(empty, 'mri'), null)
assert.equal(mod.withinOptimizationWindows([99, 99, 99], null), true)

const sagittalOnly = {
  sagittal: { min: [0, 10, 20], max: [0, 30, 40] },
}
assert.equal(mod.withinOptimizationWindows([500, 20, 30], sagittalOnly), true, 'undefined depth axis must remain unrestricted')
assert.equal(mod.withinOptimizationWindows([500, 9, 30], sagittalOnly), false)
assert.equal(mod.withinOptimizationWindows([500, 20, 41], sagittalOnly), false)

const axialOnly = {
  axial: { min: [5, 6, 0], max: [15, 16, 0] },
}
assert.equal(mod.withinOptimizationWindows([10, 12, -1000], axialOnly), true, 'undefined axial depth must remain unrestricted')
assert.equal(mod.withinOptimizationWindows([4, 12, 0], axialOnly), false)

const combined = { ...sagittalOnly, ...axialOnly }
assert.equal(mod.withinOptimizationWindows([10, 12, 30], combined), true)
assert.equal(mod.withinOptimizationWindows([10, 50, 30], combined), false)

// A missing view is always unrestricted. These cover every single missing plane.
const coronalOnly = { coronal: { min: [5, 0, 20], max: [15, 0, 40] } }
assert.equal(mod.withinOptimizationWindows([10, -999, 30], coronalOnly), true)
assert.equal(mod.withinOptimizationWindows([20, -999, 30], coronalOnly), false)
assert.equal(mod.withinOptimizationWindows([10, 12, 30], { ...sagittalOnly, ...coronalOnly }), true, 'missing axial plane must not constrain z')
assert.equal(mod.withinOptimizationWindows([10, 12, -500], { ...sagittalOnly, ...coronalOnly }), false, 'defined sagittal z range still applies')
assert.equal(mod.withinOptimizationWindows([10, 12, 30], { ...coronalOnly, ...axialOnly }), true, 'missing sagittal plane must not add a constraint')
assert.equal(mod.withinOptimizationWindows([10, 12, 30], { ...sagittalOnly, ...axialOnly }), true, 'missing coronal plane must not add a constraint')

// Degenerate, non-finite, or malformed windows must be ignored rather than
// becoming invisible zero-volume constraints.
const degenerateAxial = { axial: { min: [10, 10, 0], max: [10, 20, 0] } }
assert.equal(mod.sanitizeWindowConstraint(degenerateAxial), null)
assert.equal(mod.withinOptimizationWindows([999, 999, 999], degenerateAxial), true)
const nonFinite = { axial: { min: [0, 0, 0], max: [Number.NaN, 10, 0] } }
assert.equal(mod.sanitizeWindowConstraint(nonFinite), null)

const created = mod.createWindowBounds([20, 30, 40], [5, 10, 999], 'axial')
assert.deepEqual(created.min, [5, 10, 40])
assert.deepEqual(created.max, [20, 30, 40])
assert.equal(mod.isUsableWindowBounds(created, 'axial', 1), true)

const dirty = { mri: { ...sagittalOnly, ...degenerateAxial }, ct: {} }
const clean = mod.sanitizeOptimizationWindows(dirty)
assert.deepEqual(Object.keys(clean.mri), ['sagittal'])
assert.equal(mod.countOptimizationWindows(dirty, 'mri'), 1)

console.log('optimization-window unit tests passed')

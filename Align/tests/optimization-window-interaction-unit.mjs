import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const require = createRequire(path.join(root, 'source', 'package.json'))
const ts = require('typescript')
const source = path.join(root, 'source', 'src', 'optimizationWindowInteraction.ts')
let code = fs.readFileSync(source, 'utf8')
code = code.replace(/^import type .*$/gm, '')
code = code.replace(/^import \{[^\n]+\} from '\.\/optimizationWindows'$/m, `
const planeAxes = { sagittal:[1,2,0], coronal:[0,2,1], axial:[0,1,2] }
const createWindowBounds = (start,end,plane) => {
  const [a,b,depth]=planeAxes[plane]; const min=[...start], max=[...start]
  min[a]=Math.min(start[a],end[a]); max[a]=Math.max(start[a],end[a])
  min[b]=Math.min(start[b],end[b]); max[b]=Math.max(start[b],end[b])
  min[depth]=max[depth]=start[depth]; return {min,max}
}
const isUsableWindowBounds = (bounds,plane,minimumSpan) => {
  const [a,b]=planeAxes[plane]
  return bounds.max[a]-bounds.min[a]>=minimumSpan && bounds.max[b]-bounds.min[b]>=minimumSpan
}`)
const output = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  fileName: source,
}).outputText
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'brainana-window-interaction-test-'))
const modulePath = path.join(temp, 'optimizationWindowInteraction.mjs')
fs.writeFileSync(modulePath, output)
const mod = await import(pathToFileURL(modulePath).href)

// Regression: pointerup/pointercancel may lack an image coordinate. The last
// valid coordinate must commit the visible drag rather than discard it.
const axial = mod.windowBoundsForCompletedDrag([10,20,30], [40,60,30], null, 'axial', [1,1,1])
assert.deepEqual(axial, { min:[10,20,30], max:[40,60,30] })

const sagittal = mod.windowBoundsForCompletedDrag([5,10,20], [5,30,50], null, 'sagittal', [1,1,1])
assert.deepEqual(sagittal, { min:[5,10,20], max:[5,30,50] })

// A current pointer coordinate takes precedence when it is valid.
const current = mod.windowBoundsForCompletedDrag([10,20,30], [40,60,30], [50,70,30], 'axial', [1,1,1])
assert.deepEqual(current, { min:[10,20,30], max:[50,70,30] })

// Tiny drags are rejected and therefore cannot become invisible constraints.
assert.equal(mod.windowBoundsForCompletedDrag([10,20,30], [10.5,20.5,30], null, 'axial', [1,1,1]), null)

console.log('optimization-window interaction tests passed')

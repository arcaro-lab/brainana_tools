import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = name => fs.readFileSync(path.join(root,'source','src',name),'utf8')
const projection = read('coordinateProjection.ts')
const crosshair = read('crosshairController.ts')
const renderer = read('landmarkRenderer.ts')
assert.match(projection, /sagittal' \? 0 : plane === 'coronal' \? 1 : 2/)
assert.match(projection, /frac\[axis\] = Number\(view\.nv\.scene\.crosshairPos\[axis\]\)/)
assert.match(projection, /frac2canvasPos\(view\.nv\.mm2frac\(point\)\)/)
assert.match(crosshair, /if \(sourcePlane && view\.plane === sourcePlane\) continue/)
assert.match(crosshair, /view\.nv\.scene\.crosshairPos = view\.nv\.mm2frac\(mm\)/)
assert.match(renderer, /imagePointToCanvas\(view, point\)/)
assert.match(renderer, /depthDistance\(currentMm, plane, point\)/)
assert.match(renderer, /onMarkerPointerDown/)
console.log('coordinate, crosshair, and landmark module checks passed')

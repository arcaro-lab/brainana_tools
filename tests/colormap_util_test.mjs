// Unit tests for the pure colormap registry + gradient helpers (viewer/src/data/colormap.ts).
// Run via Node's native TypeScript support (Node >= 22.18 strips types on import).
import assert from 'node:assert/strict'
import {
  COLORMAP_REGISTRY,
  BRAINANA_COLORMAPS,
  BUILTIN_COLORMAPS,
  colormapInfo,
  gradientFromStops,
  gradientFromRgba,
} from '../viewer/src/data/colormap.ts'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

// --- registry composition + lookup ---
assert.equal(COLORMAP_REGISTRY.length, BRAINANA_COLORMAPS.length + BUILTIN_COLORMAPS.length, 'registry = brainana + builtin')
assert.equal(COLORMAP_REGISTRY[0].group, 'Brainana', 'brainana maps listed first')
assert.ok(COLORMAP_REGISTRY.every((c) => c.key && c.label && c.group), 'every entry has key/label/group')
assert.equal(new Set(COLORMAP_REGISTRY.map((c) => c.key)).size, COLORMAP_REGISTRY.length, 'keys are unique')
ok('COLORMAP_REGISTRY composes brainana + builtin maps with unique keys')

assert.equal(colormapInfo('viridis')?.label, 'Viridis', 'lookup by key')
assert.equal(colormapInfo('nope'), undefined, 'unknown key -> undefined')
assert.equal(colormapInfo('brainana_polar_angle')?.cyclic, true, 'polar angle flagged cyclic')
ok('colormapInfo resolves keys and flags cyclic maps')

// --- gradientFromStops ---
{
  const g = gradientFromStops([[255, 0, 0], [0, 0, 255]])
  assert.ok(g.startsWith('linear-gradient(90deg,'), 'is a linear-gradient')
  assert.ok(g.includes('rgb(255,0,0) 0%'), 'first stop at 0%')
  assert.ok(g.includes('rgb(0,0,255) 100%'), 'last stop at 100%')
  ok('gradientFromStops spaces stops evenly from 0% to 100%')
}
{
  const single = gradientFromStops([[10, 20, 30]])
  assert.ok(single.includes('rgb(10,20,30)'), 'single stop repeated')
  assert.equal(gradientFromStops([]), 'linear-gradient(90deg, #000, #000)', 'empty -> neutral')
  ok('gradientFromStops handles single-stop and empty inputs')
}

// --- gradientFromRgba samples a flat RGBA LUT ---
{
  // 2 entries: red then blue (alpha ignored)
  const rgba = [255, 0, 0, 255, 0, 0, 255, 255]
  const g = gradientFromRgba(rgba, 2)
  assert.ok(g.includes('rgb(255,0,0) 0%') && g.includes('rgb(0,0,255) 100%'), 'endpoints sampled')
  assert.equal(gradientFromRgba([], 8), 'linear-gradient(90deg, #000, #000)', 'empty LUT -> neutral')
  ok('gradientFromRgba samples endpoints from a flat RGBA LUT')
}

console.log(`colormap_util_test: ${passed} checks passed`)

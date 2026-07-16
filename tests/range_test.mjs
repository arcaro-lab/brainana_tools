// Unit tests for the shared range/clip math (viewer/src/data/range.ts).
// Run via Node's native TypeScript support (Node >= 22.18 strips types on import).
import assert from 'node:assert/strict'
import { percentileRange, applyValueClip, clampRange } from '../apps/viewer/src/data/range.ts'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

// --- percentileRange: basic percentiles over 1..100 ---
const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1)
{
  const r = percentileRange(oneToHundred, 2.5, 97.5)
  // index = round(p/100 * (n-1)); n=100 → lo=round(2.475)=2 → value 3; hi=round(96.525)=97 → value 98
  assert.equal(r.min, 3, 'lo percentile value')
  assert.equal(r.max, 98, 'hi percentile value')
  ok('percentileRange returns the requested percentile sample values')
}

// --- symmetric mirrors the larger magnitude around zero ---
{
  const r = percentileRange([-2, -1, 0, 1, 5], 0, 100, { symmetric: true })
  assert.deepEqual(r, { min: -5, max: 5 }, 'symmetric around zero uses max magnitude')
  ok('percentileRange symmetric option mirrors the larger magnitude')
}

// --- positiveOnly ignores non-positive samples (e.g. thickness) ---
{
  const r = percentileRange([-3, -1, 0, 2, 4], 0, 100, { positiveOnly: true })
  assert.deepEqual(r, { min: 2, max: 4 }, 'only positive samples considered')
  ok('percentileRange positiveOnly ignores <= 0 samples')
}

// --- non-finite ignored; empty -> {0,0} ---
{
  assert.deepEqual(percentileRange([NaN, Infinity, -Infinity], 0, 100), { min: 0, max: 0 }, 'all non-finite -> {0,0}')
  assert.deepEqual(percentileRange([], 0, 100), { min: 0, max: 0 }, 'empty -> {0,0}')
  ok('percentileRange ignores non-finite and handles empty input')
}

// --- applyValueClip: NaN outside [lo,hi], both bounds ---
{
  const out = applyValueClip([0, 1, 2, 3, 4, 5], 1, 4)
  assert.ok(Number.isNaN(out[0]) && Number.isNaN(out[5]), 'below lo / above hi masked')
  assert.deepEqual([out[1], out[2], out[3], out[4]], [1, 2, 3, 4], 'in-window values kept')
  assert.ok(out instanceof Float32Array, 'returns Float32Array')
  ok('applyValueClip masks samples outside the inclusive window to NaN')
}

// --- applyValueClip: null bounds are unbounded on that side ---
{
  const lowOnly = applyValueClip([0, 1, 2, 3], 2, null)
  assert.ok(Number.isNaN(lowOnly[0]) && Number.isNaN(lowOnly[1]), 'below lo masked when hi null')
  assert.deepEqual([lowOnly[2], lowOnly[3]], [2, 3], 'no upper bound')
  const hiOnly = applyValueClip([0, 1, 2, 3], null, 1)
  assert.deepEqual([hiOnly[0], hiOnly[1]], [0, 1], 'no lower bound')
  assert.ok(Number.isNaN(hiOnly[2]) && Number.isNaN(hiOnly[3]), 'above hi masked when lo null')
  ok('applyValueClip treats null bounds as unbounded')
}

// --- applyValueClip: non-finite input always masked ---
{
  const out = applyValueClip([NaN, Infinity, 2], null, null)
  assert.ok(Number.isNaN(out[0]) && Number.isNaN(out[1]), 'non-finite masked even with no bounds')
  assert.equal(out[2], 2, 'finite kept')
  ok('applyValueClip masks non-finite samples')
}

// --- clampRange: clamps to domain and preserves min <= max ---
{
  assert.deepEqual(clampRange({ min: -5, max: 20 }, { min: -1, max: 10 }), { min: -1, max: 10 }, 'clamped to domain')
  assert.deepEqual(clampRange({ min: 8, max: 2 }, { min: 0, max: 10 }), { min: 2, max: 8 }, 'inverted pair reordered')
  ok('clampRange clamps to the domain and orders min <= max')
}

console.log(`range_test: ${passed} checks passed`)

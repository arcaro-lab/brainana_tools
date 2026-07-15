import assert from 'node:assert/strict'
import { clientPointToImageOnCurrentSlice } from '../source/src/coordinateProjection.ts'

const canvas = {
  width: 800,
  height: 600,
  getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 300 }),
}

// Deliberately emulate the recurring NiiVue failure: every direct axial query
// returns the same finite coordinate. The window projection must ignore that
// degenerate answer and derive distinct image coordinates from the rendered plane.
const view = {
  plane: 'axial' as const,
  canvas,
  nv: {
    scene: { crosshairPos: [0.5, 0.5, 0.5] },
    canvasPos2frac: () => [0.5, 0.5, 0.5],
    frac2mm: (fraction: number[]) => fraction.map(value => value * 100),
    mm2frac: (mm: number[]) => mm.map(value => value / 100),
    frac2canvasPos: (fraction: number[]) => [fraction[0] * 800, fraction[1] * 600],
  },
}

const start = clientPointToImageOnCurrentSlice(view as never, 200, 125)
const end = clientPointToImageOnCurrentSlice(view as never, 400, 275)
assert.deepEqual(start?.map(value => Math.round(value)), [25, 25, 50])
assert.deepEqual(end?.map(value => Math.round(value)), [75, 75, 50])
assert.ok(start && end && Math.hypot(end[0] - start[0], end[1] - start[1]) > 60)

console.log('axial optimization-window projection regression test passed')

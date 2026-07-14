import assert from 'node:assert/strict'
import { applyMat4, fitRigid, invertRigid, multiplyMat4, rigidDelta, type Mat4, type Vec3 } from '../source/src/rigid.ts'
import { withinOptimizationWindows, type OptimizationWindows } from '../source/src/optimizationWindows.ts'

const EPS = 1e-8
const source: Vec3[] = [[0,0,0],[10,0,0],[0,12,0],[0,0,8],[4,5,6],[9,3,2]]
const expected = rigidDelta([12,-7,4,8,-5,13], [3,4,2])
const target = source.map(point => applyMat4(expected, point))
const fit = fitRigid(source, target)
assert.ok(fit.rms < 1e-7, `Rigid fit RMS was ${fit.rms}`)
for (let r=0;r<4;r++) for (let c=0;c<4;c++) assert.ok(Math.abs(fit.matrix[r][c]-expected[r][c]) < 1e-6)

const identity = multiplyMat4(fit.matrix, invertRigid(fit.matrix))
assertIdentity(identity, 1e-8)
for (const point of source) {
  const roundTrip = applyMat4(fit.inverse, applyMat4(fit.matrix, point))
  assertVec(roundTrip, point, 1e-7)
}

const windows: OptimizationWindows = {
  mri: {
    sagittal: { min: [0, 2, 3], max: [0, 8, 9] },
    axial: { min: [1, 4, 0], max: [7, 10, 0] },
  },
  ct: {},
}
assert.equal(withinOptimizationWindows([5,6,5], windows.mri), true)
assert.equal(withinOptimizationWindows([9,6,5], windows.mri), false)
assert.equal(withinOptimizationWindows([5,1,5], windows.mri), false)
assert.equal(withinOptimizationWindows([5,6,20], windows.mri), false)
assert.equal(withinOptimizationWindows([100,-100,50], windows.ct), true, 'No defined planes must remain unrestricted')

console.log('scientific regression checks passed')

function assertIdentity(matrix: Mat4, tolerance: number) {
  for (let r=0;r<4;r++) for (let c=0;c<4;c++) {
    const expectedValue = r===c ? 1 : 0
    assert.ok(Math.abs(matrix[r][c]-expectedValue) < tolerance, `identity mismatch [${r},${c}]`)
  }
}
function assertVec(actual: Vec3, expectedValue: Vec3, tolerance: number) {
  for (let i=0;i<3;i++) assert.ok(Math.abs(actual[i]-expectedValue[i]) < tolerance)
}

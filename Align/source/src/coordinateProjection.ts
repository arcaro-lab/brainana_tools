import type { Plane, View } from './appTypes'
import type { Vec3 } from './rigid'

export function planeDepthAxis(plane: Plane): 0 | 1 | 2 {
  return plane === 'sagittal' ? 0 : plane === 'coronal' ? 1 : 2
}

export function isFiniteVec3(value: number[] | undefined | null): value is Vec3 {
  return Boolean(value && value.length >= 3 && value.slice(0, 3).every(Number.isFinite))
}

export function imagePointToCanvas(view: Pick<View, 'nv'>, point: Vec3): [number, number] | null {
  const raw = view.nv.frac2canvasPos(view.nv.mm2frac(point))
  if (!raw || raw.length < 2 || !Number.isFinite(raw[0]) || !Number.isFinite(raw[1])) return null
  return [Number(raw[0]), Number(raw[1])]
}

export function canvasPointToImageOnCurrentSlice(view: Pick<View, 'nv' | 'plane'>, x: number, y: number): Vec3 | null {
  const rawFrac = view.nv.canvasPos2frac([x, y])
  const frac = Array.from(rawFrac, Number)
  if (frac.length < 3 || !frac.slice(0, 3).every(Number.isFinite)) return null
  const axis = planeDepthAxis(view.plane)
  frac[axis] = Number(view.nv.scene.crosshairPos[axis])
  const mm = Array.from(view.nv.frac2mm(frac), Number)
  if (mm.length < 3 || !mm.slice(0, 3).every(Number.isFinite)) return null
  return [mm[0], mm[1], mm[2]]
}

export function coordinateLabel(mm: Vec3): string {
  return `x ${mm[0].toFixed(1)}  y ${mm[1].toFixed(1)}  z ${mm[2].toFixed(1)} mm`
}

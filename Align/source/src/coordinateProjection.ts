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

/**
 * Convert a CSS/client point to image millimetres on the displayed slice.
 *
 * NiiVue's canvasPos2frac can legitimately return an invalid point in letterboxed
 * image regions. Window drawing still needs a stable mapping there, so this first
 * tries NiiVue's conversion and then reconstructs the orthographic screen-to-world
 * mapping from three projected world points. The fallback is shared by MRI and CT
 * and therefore cannot diverge by modality or plane.
 */
export function clientPointToImageOnCurrentSlice(
  view: Pick<View, 'nv' | 'plane' | 'canvas'>,
  clientX: number,
  clientY: number,
): Vec3 | null {
  const rect = view.canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  // Reconstruct the displayed plane first. NiiVue can return a finite but
  // degenerate canvasPos2frac result in an axial panel (both drag endpoints map
  // to the same world point), which previously made a visibly large rectangle
  // fail the minimum-size check. Orthographic projection is the authoritative
  // mapping for window geometry and works identically for MRI and CT.
  const crosshairFrac = Array.from(view.nv.scene.crosshairPos, Number)
  if (crosshairFrac.length >= 3 && crosshairFrac.slice(0, 3).every(Number.isFinite)) {
    const centerRaw = Array.from(view.nv.frac2mm(crosshairFrac), Number)
    if (centerRaw.length >= 3 && centerRaw.slice(0, 3).every(Number.isFinite)) {
      const center: Vec3 = [centerRaw[0], centerRaw[1], centerRaw[2]]
      const [axisA, axisB] = view.plane === 'sagittal' ? [1, 2] : view.plane === 'coronal' ? [0, 2] : [0, 1]

      const projectCss = (point: Vec3): [number, number] | null => {
        const raw = imagePointToCanvas(view, point)
        if (!raw) return null
        return [
          raw[0] * rect.width / Math.max(1, view.canvas.width),
          raw[1] * rect.height / Math.max(1, view.canvas.height),
        ]
      }
      const centerScreen = projectCss(center)
      const alongA = [...center] as Vec3
      const alongB = [...center] as Vec3
      alongA[axisA] += 1
      alongB[axisB] += 1
      const screenA = projectCss(alongA)
      const screenB = projectCss(alongB)
      if (centerScreen && screenA && screenB) {
        const ax = screenA[0] - centerScreen[0]
        const ay = screenA[1] - centerScreen[1]
        const bx = screenB[0] - centerScreen[0]
        const by = screenB[1] - centerScreen[1]
        const determinant = ax * by - ay * bx
        if (Number.isFinite(determinant) && Math.abs(determinant) >= 1e-9) {
          const dx = clientX - rect.left - centerScreen[0]
          const dy = clientY - rect.top - centerScreen[1]
          const deltaA = (dx * by - dy * bx) / determinant
          const deltaB = (ax * dy - ay * dx) / determinant
          if (Number.isFinite(deltaA) && Number.isFinite(deltaB)) {
            const result = [...center] as Vec3
            result[axisA] += deltaA
            result[axisB] += deltaB
            return result
          }
        }
      }
    }
  }

  // Retain NiiVue's direct conversion only as a fallback for unusual future
  // rendering modes where a locally affine slice projection is unavailable.
  const canvasX = (clientX - rect.left) * (view.canvas.width / rect.width)
  const canvasY = (clientY - rect.top) * (view.canvas.height / rect.height)
  return canvasPointToImageOnCurrentSlice(view, canvasX, canvasY)
}

export function coordinateLabel(mm: Vec3): string {
  return `x ${mm[0].toFixed(1)}  y ${mm[1].toFixed(1)}  z ${mm[2].toFixed(1)} mm`
}

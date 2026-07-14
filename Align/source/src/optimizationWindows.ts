import type { Modality, OptimizationWindows, Plane, WindowBounds, WindowConstraint } from './appTypes'
import type { Vec3 } from './rigid'

export const planeAxes: Record<Plane, [number, number, number]> = {
  sagittal: [1, 2, 0],
  coronal: [0, 2, 1],
  axial: [0, 1, 2],
}

const PLANES: Plane[] = ['sagittal', 'coronal', 'axial']

export function isUsableWindowBounds(bounds: WindowBounds | undefined, plane: Plane, minimumSpan = 1e-6): bounds is WindowBounds {
  if (!bounds) return false
  if (!Array.isArray(bounds.min) || !Array.isArray(bounds.max)) return false
  if (bounds.min.length < 3 || bounds.max.length < 3) return false
  if (![...bounds.min, ...bounds.max].every(Number.isFinite)) return false
  const [a, b] = planeAxes[plane]
  return bounds.max[a] - bounds.min[a] >= minimumSpan && bounds.max[b] - bounds.min[b] >= minimumSpan
}

export function sanitizeWindowConstraint(constraint: WindowConstraint | null | undefined, minimumSpan = 1e-6): WindowConstraint | null {
  if (!constraint) return null
  const clean: WindowConstraint = {}
  for (const plane of PLANES) {
    const bounds = constraint[plane]
    if (!isUsableWindowBounds(bounds, plane, minimumSpan)) continue
    clean[plane] = {
      min: [...bounds.min] as Vec3,
      max: [...bounds.max] as Vec3,
    }
  }
  return Object.keys(clean).length ? clean : null
}

export function sanitizeOptimizationWindows(windows: OptimizationWindows, minimumSpan = 1e-6): OptimizationWindows {
  return {
    mri: sanitizeWindowConstraint(windows.mri, minimumSpan) ?? {},
    ct: sanitizeWindowConstraint(windows.ct, minimumSpan) ?? {},
  }
}

export function countOptimizationWindows(windows: OptimizationWindows, modality: Modality): number {
  return Object.keys(sanitizeWindowConstraint(windows[modality]) ?? {}).length
}

export function optimizationConstraint(windows: OptimizationWindows, modality: Modality): WindowConstraint | null {
  return sanitizeWindowConstraint(windows[modality])
}

export function withinOptimizationWindows(point: Vec3, constraint: WindowConstraint | null): boolean {
  const clean = sanitizeWindowConstraint(constraint)
  if (!clean) return true
  for (const [plane, bounds] of Object.entries(clean) as Array<[Plane, WindowBounds]>) {
    const [a, b] = planeAxes[plane]
    if (
      point[a] < bounds.min[a] || point[a] > bounds.max[a] ||
      point[b] < bounds.min[b] || point[b] > bounds.max[b]
    ) return false
  }
  return true
}

export function createWindowBounds(start: Vec3, end: Vec3, plane: Plane): WindowBounds {
  const [a, b, depth] = planeAxes[plane]
  const min = [...start] as Vec3
  const max = [...start] as Vec3
  min[a] = Math.min(start[a], end[a])
  max[a] = Math.max(start[a], end[a])
  min[b] = Math.min(start[b], end[b])
  max[b] = Math.max(start[b], end[b])
  min[depth] = max[depth] = start[depth]
  return { min, max }
}

import type { Niivue, NVImage } from '@niivue/niivue'
import type { RawNifti } from './roiWarp'
import type { Mat4, Vec3 } from './rigid'

export type Modality = 'mri' | 'ct'
export type Plane = 'sagittal' | 'coronal' | 'axial'
export type Landmark = { id: number; mri: Vec3 | null; ct: Vec3 | null; enabled: boolean; residual?: number }
export type Loaded = { name: string; raw: RawNifti; nvImage: NVImage; sourceFiles: string[] }
export type WindowBounds = { min: Vec3; max: Vec3 }
export type OptimizationWindows = Record<Modality, Partial<Record<Plane, WindowBounds>>>
export type View = { nv: Niivue; modality: Modality; plane: Plane; canvas: HTMLCanvasElement; overlay: SVGSVGElement; windowLayer: HTMLDivElement }
export type ReviewView = { nv: Niivue; plane: Plane; canvas: HTMLCanvasElement; overlay: SVGSVGElement }
export type Params6 = [number, number, number, number, number, number]
export type FitState = {
  direction: string
  landmarkMatrix: Mat4
  baseMatrix: Mat4
  matrix: Mat4
  inverse: Mat4
  rms: number
  manual: Params6
  proposal: { matrix: Mat4; scoreBefore: number; scoreAfter: number; params: Params6 } | null
  landmarkSnapshot: Landmark[]
  landmarksChanged: boolean
  fittedAt: string
}
export type WindowConstraint = Partial<Record<Plane, WindowBounds>>

import type { FitState, Landmark, Loaded, Modality, OptimizationWindows } from './appTypes'

export const SESSION_SCHEMA_VERSION = 1

export type ImageSignature = {
  name: string
  sourceFiles: string[]
  dims: [number, number, number]
  pixDims: [number, number, number]
  affine: number[][]
}

export type SessionPayload = {
  application: 'Brainana Align'
  schemaVersion: number
  appVersion: string
  savedAt: string
  images: Record<Modality, ImageSignature | null>
  landmarks: Landmark[]
  selectedId: number | null
  nextId: number
  direction: string
  fit: FitState | null
  optimizationWindows: OptimizationWindows
}

type LegacySessionPayload = Partial<SessionPayload> & {
  application?: string
  version?: string
  saved_at?: string
  images?: Partial<Record<Modality, ImageSignature | null>>
  landmarks?: Landmark[]
  selectedId?: number | null
  nextId?: number
  direction?: string
  fit?: FitState | null
  optimizationWindows?: OptimizationWindows
}

export function imageSignature(item: Loaded | null): ImageSignature | null {
  if (!item) return null
  return {
    name: item.name,
    sourceFiles: [...item.sourceFiles],
    dims: [...item.raw.dims] as [number, number, number],
    pixDims: [...item.raw.pixDims] as [number, number, number],
    affine: item.raw.affine.map(row => [...row]),
  }
}

export function geometryDifference(a: ImageSignature, b: ImageSignature): string[] {
  const issues: string[] = []
  if (a.dims.some((value, index) => value !== b.dims[index])) {
    issues.push(`dimensions ${a.dims.join('×')} vs ${b.dims.join('×')}`)
  }
  if (a.pixDims.some((value, index) => Math.abs(value - b.pixDims[index]) > 1e-3)) {
    issues.push('voxel sizes differ')
  }
  let maxAffine = 0
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      maxAffine = Math.max(maxAffine, Math.abs(a.affine[row][column] - b.affine[row][column]))
    }
  }
  if (maxAffine > 1e-3) issues.push(`affines differ (max |Δ| ${maxAffine.toFixed(4)})`)
  return issues
}

export function createSessionPayload(options: {
  appVersion: string
  loaded: Record<Modality, Loaded | null>
  landmarks: Landmark[]
  selectedId: number | null
  nextId: number
  direction: string
  fit: FitState | null
  optimizationWindows: OptimizationWindows
  now?: Date
}): SessionPayload {
  return {
    application: 'Brainana Align',
    schemaVersion: SESSION_SCHEMA_VERSION,
    appVersion: options.appVersion,
    savedAt: (options.now ?? new Date()).toISOString(),
    images: {
      mri: imageSignature(options.loaded.mri),
      ct: imageSignature(options.loaded.ct),
    },
    landmarks: structuredClone(options.landmarks),
    selectedId: options.selectedId,
    nextId: options.nextId,
    direction: options.direction,
    fit: options.fit ? structuredClone(options.fit) : null,
    optimizationWindows: structuredClone(options.optimizationWindows),
  }
}

export function parseSessionPayload(value: unknown): SessionPayload {
  if (!value || typeof value !== 'object') throw new Error('This is not a valid Brainana Align session file.')
  const payload = value as LegacySessionPayload
  if (payload.application !== 'Brainana Align' || !Array.isArray(payload.landmarks)) {
    throw new Error('This is not a valid Brainana Align session file.')
  }
  const schemaVersion = Number(payload.schemaVersion ?? 0)
  if (schemaVersion > SESSION_SCHEMA_VERSION) {
    throw new Error(`This session uses newer schema version ${schemaVersion}. Update Brainana Align before loading it.`)
  }
  const savedAt = payload.savedAt ?? payload.saved_at ?? new Date(0).toISOString()
  return {
    application: 'Brainana Align',
    schemaVersion: SESSION_SCHEMA_VERSION,
    appVersion: payload.appVersion ?? payload.version ?? 'unknown',
    savedAt,
    images: {
      mri: payload.images?.mri ?? null,
      ct: payload.images?.ct ?? null,
    },
    landmarks: structuredClone(payload.landmarks),
    selectedId: payload.selectedId ?? null,
    nextId: payload.nextId ?? 1,
    direction: payload.direction ?? 'ct-mri',
    fit: payload.fit ? structuredClone(payload.fit) : null,
    optimizationWindows: payload.optimizationWindows
      ? structuredClone(payload.optimizationWindows)
      : { mri: {}, ct: {} },
  }
}

export function sessionGeometryMismatches(
  saved: SessionPayload['images'],
  current: Record<Modality, Loaded | null>,
): string[] {
  const mismatch: string[] = []
  for (const modality of ['mri', 'ct'] as Modality[]) {
    const savedSignature = saved[modality]
    const currentSignature = imageSignature(current[modality])
    if (savedSignature && currentSignature) {
      mismatch.push(...geometryDifference(savedSignature, currentSignature).map(issue => `${modality.toUpperCase()}: ${issue}`))
    }
  }
  return mismatch
}

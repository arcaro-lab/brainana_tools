// Colormap registry + preview helpers, shared by the colormap picker across every value
// overlay. Pure (no NiiVue/DOM): the registry is plain metadata and the gradient helpers turn
// color stops / a sampled LUT into a CSS `linear-gradient()` for swatch previews. The NiiVue
// layer (niivue/colormaps.ts) samples each registered map's LUT and pairs it with this metadata.
import type { RGB } from './colors.ts'

export type ColormapGroup =
  | 'Brainana'
  | 'Perceptually Uniform'
  | 'Sequential'
  | 'Diverging'
  | 'Cyclic'
  | 'Qualitative'
  | 'Anatomical'
  | 'Other'

export interface ColormapInfo {
  /** Name passed to nv.setColormap / mesh-layer colormap. */
  key: string
  /** UI label. */
  label: string
  /** Grouping for the picker's sections. */
  group: ColormapGroup
  /** Cyclic maps (e.g. polar angle) — the picker may badge these. */
  cyclic?: boolean
}

// The brainana custom LUTs (registered on every NiiVue instance by registerColormaps).
export const BRAINANA_COLORMAPS: ColormapInfo[] = [
  { key: 'brainana_eccentricity', label: 'eccentricity', group: 'Brainana' },
  { key: 'brainana_somatotopy', label: 'body position', group: 'Brainana' },
  { key: 'brainana_polar_angle', label: 'polar angle', group: 'Brainana', cyclic: true },
  { key: 'brainana_polar_lr', label: 'polar angle (L/R split)', group: 'Brainana', cyclic: true },
  { key: 'brainana_curvature', label: 'curvature', group: 'Brainana' },
]

// A curated subset of NiiVue's built-in maps offered in the picker (not the full built-in list —
// just the ones that make sense for anatomical bases and statistical/continuous overlays).
export const BUILTIN_COLORMAPS: ColormapInfo[] = [
  { key: 'gray', label: 'gray', group: 'Anatomical' },
  { key: 'viridis', label: 'viridis', group: 'Sequential' },
  { key: 'plasma', label: 'plasma', group: 'Sequential' },
  { key: 'inferno', label: 'inferno', group: 'Sequential' },
  { key: 'magma', label: 'magma', group: 'Sequential' },
  { key: 'turbo', label: 'turbo', group: 'Sequential' },
  { key: 'hot', label: 'hot', group: 'Sequential' },
  { key: 'cool', label: 'cool', group: 'Sequential' },
  { key: 'warm', label: 'warm', group: 'Sequential' },
  { key: 'blue2red', label: 'blue–red', group: 'Diverging' },
]

// Static fallback registry (Brainana first, then a curated built-in subset). The live picker
// prefers buildColormapRegistry(nv.colormaps()) so every map NiiVue offers is available.
export const COLORMAP_REGISTRY: ColormapInfo[] = [...BRAINANA_COLORMAPS, ...BUILTIN_COLORMAPS]

export function colormapInfo(key: string): ColormapInfo | undefined {
  return COLORMAP_REGISTRY.find((c) => c.key === key)
}

// Display order of the groups in the picker.
export const GROUP_ORDER: ColormapGroup[] = [
  'Brainana',
  'Perceptually Uniform',
  'Sequential',
  'Diverging',
  'Cyclic',
  'Qualitative',
  'Anatomical',
  'Other',
]

// Curated group + label for the well-known matplotlib / NiiVue built-ins (keyed lower-case).
// Names not listed here fall back to a lower-cased label in the "Other" group, so the picker
// always lists everything nv.colormaps() reports without needing an exhaustive table.
const CURATED: Record<string, { group: ColormapGroup; label?: string }> = {
  // Perceptually uniform sequential
  viridis: { group: 'Perceptually Uniform' },
  plasma: { group: 'Perceptually Uniform' },
  inferno: { group: 'Perceptually Uniform' },
  magma: { group: 'Perceptually Uniform' },
  cividis: { group: 'Perceptually Uniform' },
  // Sequential
  gray: { group: 'Anatomical', label: 'gray' },
  greys: { group: 'Sequential', label: 'greys' },
  bone: { group: 'Sequential' },
  hot: { group: 'Sequential' },
  cool: { group: 'Sequential' },
  warm: { group: 'Sequential' },
  copper: { group: 'Sequential' },
  winter: { group: 'Sequential' },
  summer: { group: 'Sequential' },
  spring: { group: 'Sequential' },
  autumn: { group: 'Sequential' },
  blues: { group: 'Sequential' },
  greens: { group: 'Sequential' },
  reds: { group: 'Sequential' },
  oranges: { group: 'Sequential' },
  purples: { group: 'Sequential' },
  cubehelix: { group: 'Sequential' },
  turbo: { group: 'Sequential' },
  jet: { group: 'Sequential' },
  // Diverging
  blue2red: { group: 'Diverging', label: 'blue–red' },
  coolwarm: { group: 'Diverging' },
  bwr: { group: 'Diverging', label: 'BWR' },
  seismic: { group: 'Diverging' },
  spectral: { group: 'Diverging' },
  rdbu: { group: 'Diverging', label: 'RdBu' },
  rdylbu: { group: 'Diverging', label: 'RdYlBu' },
  redyellowblue: { group: 'Diverging', label: 'red–yellow–blue' },
  // Cyclic
  hsv: { group: 'Cyclic', label: 'HSV' },
  twilight: { group: 'Cyclic' },
  // Anatomical / neuro
  x_rain: { group: 'Anatomical', label: 'x-rain' },
  surface: { group: 'Anatomical' },
  ct_kights: { group: 'Anatomical' },
}

// Lower-case display label for an arbitrary colormap key ("blue2red" → "blue2red", "rd_bu" → "rd bu").
// Colormap names are shown lowercase like every other UI label (keys are already lowercase).
export function prettifyLabel(key: string): string {
  return key.replace(/[_-]+/g, ' ')
}

// Build the picker registry from the maps NiiVue actually offers: Brainana maps first, then every
// available built-in mapped to its curated group/label (unknowns → lower-cased "Other").
export function buildColormapRegistry(availableKeys: string[]): ColormapInfo[] {
  const brainanaKeys = new Set(BRAINANA_COLORMAPS.map((c) => c.key))
  const builtins: ColormapInfo[] = []
  for (const key of availableKeys) {
    if (brainanaKeys.has(key)) continue
    const curated = CURATED[key.toLowerCase()]
    builtins.push({ key, label: curated?.label ?? prettifyLabel(key), group: curated?.group ?? 'Other' })
  }
  builtins.sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
    return g !== 0 ? g : a.label.localeCompare(b.label)
  })
  return [...BRAINANA_COLORMAPS, ...builtins]
}

/** A CSS `linear-gradient(90deg, …)` from an array of RGB stops (evenly spaced). */
export function gradientFromStops(stops: RGB[]): string {
  if (stops.length === 0) return 'linear-gradient(90deg, #000, #000)'
  if (stops.length === 1) {
    const [r, g, b] = stops[0]
    return `linear-gradient(90deg, rgb(${r},${g},${b}), rgb(${r},${g},${b}))`
  }
  const parts = stops.map((c, i) => `rgb(${c[0]},${c[1]},${c[2]}) ${Math.round((i / (stops.length - 1)) * 100)}%`)
  return `linear-gradient(90deg, ${parts.join(', ')})`
}

/**
 * A CSS gradient sampled from a flat RGBA LUT (length = entries·4, as returned by NiiVue's
 * `colormap()`), taking `samples` evenly-spaced colors. Alpha is ignored for the preview.
 */
export function gradientFromRgba(rgba: ArrayLike<number>, samples = 16): string {
  const entries = Math.floor(rgba.length / 4)
  if (entries < 1) return 'linear-gradient(90deg, #000, #000)'
  // Skip a reserved transparent index-0 (brainana maps) so previews don't start with a black slot.
  const lo = entries > 1 && rgba[3] === 0 ? 1 : 0
  const last = entries - 1
  const stops: RGB[] = []
  const n = Math.min(samples, last - lo + 1)
  for (let s = 0; s < n; s++) {
    const idx = n === 1 ? lo : lo + Math.round((s / (n - 1)) * (last - lo))
    const o = idx * 4
    stops.push([rgba[o], rgba[o + 1], rgba[o + 2]])
  }
  return gradientFromStops(stops)
}

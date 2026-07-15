// Colormap registry + preview helpers, shared by the colormap picker across every value
// overlay. Pure (no NiiVue/DOM): the registry is plain metadata and the gradient helpers turn
// color stops / a sampled LUT into a CSS `linear-gradient()` for swatch previews. The NiiVue
// layer (niivue/colormaps.ts) samples each registered map's LUT and pairs it with this metadata.
import type { RGB } from './colors.ts'

export type ColormapGroup = 'Brainana' | 'Sequential' | 'Diverging' | 'Anatomical'

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
  { key: 'brainana_eccentricity', label: 'Eccentricity', group: 'Brainana' },
  { key: 'brainana_somatotopy', label: 'Somatotopy', group: 'Brainana' },
  { key: 'brainana_polar_angle', label: 'Polar angle', group: 'Brainana', cyclic: true },
  { key: 'brainana_curvature', label: 'Curvature', group: 'Brainana' },
]

// A curated subset of NiiVue's built-in maps offered in the picker (not the full built-in list —
// just the ones that make sense for anatomical bases and statistical/continuous overlays).
export const BUILTIN_COLORMAPS: ColormapInfo[] = [
  { key: 'gray', label: 'Gray', group: 'Anatomical' },
  { key: 'viridis', label: 'Viridis', group: 'Sequential' },
  { key: 'plasma', label: 'Plasma', group: 'Sequential' },
  { key: 'inferno', label: 'Inferno', group: 'Sequential' },
  { key: 'magma', label: 'Magma', group: 'Sequential' },
  { key: 'turbo', label: 'Turbo', group: 'Sequential' },
  { key: 'hot', label: 'Hot', group: 'Sequential' },
  { key: 'cool', label: 'Cool', group: 'Sequential' },
  { key: 'warm', label: 'Warm', group: 'Sequential' },
  { key: 'blue2red', label: 'Blue–Red', group: 'Diverging' },
]

// The full ordered registry the picker renders (Brainana first, then built-ins).
export const COLORMAP_REGISTRY: ColormapInfo[] = [...BRAINANA_COLORMAPS, ...BUILTIN_COLORMAPS]

export function colormapInfo(key: string): ColormapInfo | undefined {
  return COLORMAP_REGISTRY.find((c) => c.key === key)
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
  const stops: RGB[] = []
  const n = Math.min(samples, entries)
  for (let s = 0; s < n; s++) {
    const idx = n === 1 ? 0 : Math.round((s / (n - 1)) * (entries - 1))
    const o = idx * 4
    stops.push([rgba[o], rgba[o + 1], rgba[o + 2]])
  }
  return gradientFromStops(stops)
}

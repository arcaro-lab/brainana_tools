// Custom LUTs registered on both NiiVue instances (v1.2.25 fidelity):
//  - eccentricity 0-10: red → blue ramp
//  - somatotopy: the SAME ramp REVERSED (blue at 0 → red at 100) — the v1.2.22 fix
//  - polar angle: a cyclic hue wheel
//  - curvature: binary light/dark gray (sulci/gyri)
// The color stops are exported so the legends (P5) can be drawn from the same source of truth.
import type { Niivue } from '@niivue/niivue'
import { hslToRgb, type RGB } from '../data/colors.ts'
import { gradientFromRgba } from '../data/colormap.ts'

export interface NiiColormap {
  R: number[]
  G: number[]
  B: number[]
  A: number[]
  I: number[]
}

// Build a NiiVue colormap from color stops: index 0 is transparent, stops spaced 1..255.
export function buildColormap(stops: RGB[]): NiiColormap {
  const R = [0]
  const G = [0]
  const B = [0]
  const A = [0]
  const I = [0]
  const n = stops.length
  for (let k = 0; k < n; k++) {
    const idx = n === 1 ? 255 : 1 + Math.round((k * 254) / (n - 1))
    R.push(stops[k][0])
    G.push(stops[k][1])
    B.push(stops[k][2])
    A.push(255)
    I.push(idx)
  }
  return { R, G, B, A, I }
}

// Eccentricity ramp: red → orange → yellow → green → cyan → blue.
export const ECCENTRICITY_STOPS: RGB[] = [
  [204, 16, 51],
  [233, 86, 20],
  [245, 160, 20],
  [247, 220, 30],
  [150, 210, 40],
  [40, 200, 90],
  [30, 190, 200],
  [20, 90, 230],
  [0, 0, 255],
]

// Somatotopy = eccentricity reversed → blue at 0, red at 100.
export const SOMATOTOPY_STOPS: RGB[] = [...ECCENTRICITY_STOPS].reverse()

// Polar-angle wheel: cyclic hue, starting at green (the smooth rainbow — the default).
export const POLAR_STOPS: RGB[] = Array.from({ length: 17 }, (_, k) => hslToRgb((120 + k * 22.5) % 360, 0.85, 0.5))

// Alternative polar map that SEPARATES the left/right visual hemifields (green at both meridians,
// blue on one side, red on the other) — the previous surface look, kept as a selectable option.
export const POLAR_LR_STOPS: RGB[] = [
  [0, 255, 0],
  [0, 0, 255],
  [0, 255, 0],
  [255, 0, 0],
  [0, 255, 0],
]

// Binary curvature: light gray for concave (sulci), dark gray for convex (gyri).
export const CURVATURE_BINARY: NiiColormap = {
  R: [214, 214, 72, 72],
  G: [214, 214, 72, 72],
  B: [214, 214, 72, 72],
  A: [255, 255, 255, 255],
  I: [0, 127, 128, 255],
}

export const COLORMAPS: Record<string, NiiColormap> = {
  brainana_eccentricity: buildColormap(ECCENTRICITY_STOPS),
  brainana_somatotopy: buildColormap(SOMATOTOPY_STOPS),
  brainana_polar_angle: buildColormap(POLAR_STOPS),
  brainana_polar_lr: buildColormap(POLAR_LR_STOPS),
  brainana_curvature: CURVATURE_BINARY,
}

export function registerColormaps(nv: Niivue): void {
  for (const [name, cmap] of Object.entries(COLORMAPS)) {
    try {
      nv.addColormap(name, cmap)
    } catch {
      // colormap may already be registered
    }
  }
}

// Sample each colormap's flat RGBA LUT once and derive both the CSS gradient preview and the raw
// LUT (kept for the legend wheel/rings + the surface categorical LUT, which need actual colors).
export interface ColormapAssets {
  gradients: Record<string, string>
  luts: Record<string, Uint8ClampedArray>
}
export function buildColormapAssets(nv: Niivue, keys: string[]): ColormapAssets {
  const gradients: Record<string, string> = {}
  const luts: Record<string, Uint8ClampedArray> = {}
  for (const key of keys) {
    try {
      const rgba = (nv as unknown as { colormap: (id: string) => ArrayLike<number> }).colormap(key)
      if (rgba && rgba.length >= 4) {
        luts[key] = rgba instanceof Uint8ClampedArray ? rgba : Uint8ClampedArray.from(rgba as ArrayLike<number>)
        gradients[key] = gradientFromRgba(rgba)
      } else {
        gradients[key] = GRAY_GRADIENT
      }
    } catch {
      gradients[key] = GRAY_GRADIENT
    }
  }
  return { gradients, luts }
}

// All colormap names NiiVue offers (built-ins + any custom maps registered on this instance).
export function availableColormaps(nv: Niivue): string[] {
  try {
    const names = (nv as unknown as { colormaps: () => string[] }).colormaps()
    return Array.isArray(names) ? names : []
  } catch {
    return []
  }
}

const GRAY_GRADIENT = 'linear-gradient(90deg, rgb(20,18,13), rgb(236,230,216))'

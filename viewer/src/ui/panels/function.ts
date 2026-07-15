// Docked "Function" picker (top of the side panel): pick a retinotopy (Polar/Eccentricity) or
// somatotopy (Phase) map, then tune its colormap, display value-clip, F-stat threshold, opacity,
// and surface brightness. A live colorbar reflects the active map + range + clip.
import { functionalModes, type FunctionalKind, type FunctionalMode } from '../../data/functional.ts'
import type { Manifest } from '../../types.ts'
import { h } from '../dom.ts'
import { createColormapPicker, type ColormapPicker } from '../components/colormapPicker.ts'
import { createRangeControl, type RangeControl } from '../components/rangeControl.ts'
import { createColorbar, type ColorbarState } from '../components/colorbar.ts'

export interface FunctionChoice {
  kind: FunctionalKind
  mode: FunctionalMode
}

export interface FunctionPanelCallbacks {
  onSelect: (c: FunctionChoice | null) => void
  onThreshold: (v: number) => void
  onOpacity: (v: number) => void
  onBrightness: (v: number) => void
  onColormap: (key: string) => void
  onClip: (lo: number | null, hi: number | null) => void
}

export interface FunctionPanel {
  element: HTMLElement
  toggle: () => void
  hide: () => void
  setActive: (key: string | null) => void
  setThresholdBounds: (min: number, max: number, value: number) => void
  brightness: () => number
  setColormap: (key: string) => void
  /** Reset the value-clip domain + handles to the full display range of the active map. */
  setClipDomain: (min: number, max: number) => void
  setColorbar: (state: ColorbarState | null) => void
}

export const choiceKey = (c: FunctionChoice): string => `${c.kind}:${c.mode.label}`

const EPS = 1e-6

export function createFunctionPanel(manifest: Manifest, cb: FunctionPanelCallbacks, gradients: Record<string, string>): FunctionPanel {
  const buttons = new Map<string, HTMLButtonElement>()
  const row = h('div', { class: 'chip-row' })

  const noneBtn = h('button', { type: 'button', class: 'chip' }, ['None']) as HTMLButtonElement
  noneBtn.addEventListener('click', () => cb.onSelect(null))
  buttons.set('none', noneBtn)
  row.append(noneBtn)

  const kinds: FunctionalKind[] = []
  if (manifest.function?.retinotopy) kinds.push('retinotopy')
  if (manifest.function?.somatotopy) kinds.push('somatotopy')
  for (const kind of kinds) {
    const map = kind === 'retinotopy' ? manifest.function.retinotopy : manifest.function.somatotopy
    if (!map) continue
    for (const mode of functionalModes(kind, map.frames)) {
      const choice: FunctionChoice = { kind, mode }
      const key = choiceKey(choice)
      const b = h('button', { type: 'button', class: 'chip' }, [mode.label]) as HTMLButtonElement
      b.addEventListener('click', () => cb.onSelect(choice))
      buttons.set(key, b)
      row.append(b)
    }
  }

  const colorbar = createColorbar('Value range')

  const cmap: ColormapPicker = createColormapPicker({
    gradients,
    value: 'brainana_eccentricity',
    onChange: (key) => cb.onColormap(key),
  })

  // Value clip: hide voxels whose displayed value falls outside the window. Bounds at the domain
  // edges mean "unbounded on that side" (null), so the full-range default clips nothing.
  let clipDomain = { min: 0, max: 1 }
  const clip: RangeControl = createRangeControl({
    onChange: ({ min, max }) => {
      const lo = min <= clipDomain.min + EPS ? null : min
      const hi = max >= clipDomain.max - EPS ? null : max
      cb.onClip(lo, hi)
    },
  })

  const thresh = h('input', { type: 'range', min: '0', max: '1', step: '0.1', value: '0', disabled: true }) as HTMLInputElement
  const threshLabel = h('span', { class: 'muted' }, ['—'])
  thresh.addEventListener('input', () => {
    threshLabel.textContent = `F ≥ ${Number(thresh.value).toFixed(2)}`
    cb.onThreshold(Number(thresh.value))
  })

  const opacity = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '0.85' }) as HTMLInputElement
  opacity.addEventListener('input', () => cb.onOpacity(Number(opacity.value)))

  // Function on the 3D surface is always shown for the active map; only the LUT brightness is
  // adjustable (blends toward white).
  const brightness = h('input', { type: 'range', min: '0.5', max: '2', step: '0.05', value: '1.25' }) as HTMLInputElement
  brightness.addEventListener('input', () => cb.onBrightness(Number(brightness.value)))

  const element = h('div', { class: 'side-panel', hidden: true }, [
    h('div', { class: 'side-panel-head' }, ['Function']),
    row,
    colorbar.element,
    h('label', { class: 'field' }, [h('span', {}, ['Colormap']), cmap.element]),
    h('div', { class: 'field' }, [h('span', {}, ['Value clip']), clip.element]),
    h('div', { class: 'field' }, [h('span', {}, ['F-stat threshold ', threshLabel]), thresh]),
    h('label', { class: 'field' }, [h('span', {}, ['Opacity']), opacity]),
    h('label', { class: 'field' }, [h('span', {}, ['Surface brightness']), brightness]),
  ])

  return {
    element,
    toggle: () => (element.hidden = !element.hidden),
    hide: () => (element.hidden = true),
    setActive: (key) => {
      for (const [k, b] of buttons) b.classList.toggle('active', k === (key ?? 'none'))
    },
    setThresholdBounds: (min, max, value) => {
      if (!(max > min)) {
        thresh.disabled = true
        threshLabel.textContent = 'no F-stat'
        return
      }
      thresh.min = String(min)
      thresh.max = String(max)
      thresh.step = String((max - min) / 100 || 0.1)
      thresh.value = String(value)
      thresh.disabled = false
      threshLabel.textContent = `F ≥ ${value.toFixed(2)}`
    },
    brightness: () => Number(brightness.value),
    setColormap: (key) => cmap.setValue(key),
    setClipDomain: (min, max) => {
      clipDomain = { min, max }
      clip.setDomain(min, max)
      clip.setValue(min, max)
    },
    setColorbar: (state) => (state ? colorbar.set(state) : colorbar.hide()),
  }
}

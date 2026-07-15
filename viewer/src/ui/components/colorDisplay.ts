// The unified "Color display" section docked at the bottom of the side panel. It owns the generic
// color controls that used to be nested in each panel — colormap picker, legend (bar/wheel/rings),
// display range (cal clamp), and clip (hide) — and targets whichever overlay is active. The dashboard
// drives it via setTarget() and routes the callbacks to the active overlay's apply path.
import { h } from '../dom.ts'
import { createColormapPicker, type ColormapPicker } from './colormapPicker.ts'
import { createRangeControl, type RangeControl } from './rangeControl.ts'
import { createLegend, type Legend, type LegendShape } from './legend.ts'
import type { ColormapInfo } from '../../data/colormap.ts'

export interface ColorDisplayCallbacks {
  onColormap: (key: string) => void
  onDisplayRange: (min: number, max: number) => void
  onDisplaySymmetric?: (on: boolean) => void
  onDisplayAuto?: () => void
  onClipRange?: (lo: number | null, hi: number | null) => void
  onHideBelowMin?: (on: boolean) => void
  onReset?: () => void
}

export interface ColorDisplayTarget {
  title: string
  colormap: string
  legendShape: LegendShape
  gradient: string
  lut?: ArrayLike<number>
  displayDomain: { min: number; max: number }
  displayRange: { min: number; max: number }
  displaySymmetric?: boolean
  /** Hide the display-range slider (e.g. atlas, where the map spreads across label ids). */
  showDisplayRange?: boolean
  /** Clip UI variant: a full lo/hi range, a single "hide below min" toggle, or none. */
  clip: 'range' | 'toggle' | 'none'
  clipDomain?: { min: number; max: number }
  clipValue?: { lo: number | null; hi: number | null }
  hideBelowMin?: boolean
  unit?: string
}

export interface ColorDisplay {
  element: HTMLElement
  setGradients: (g: Record<string, string>) => void
  setTarget: (t: ColorDisplayTarget | null) => void
}

const EPS = 1e-6

export function createColorDisplay(
  cb: ColorDisplayCallbacks,
  gradients: Record<string, string>,
  infos: ColormapInfo[],
): ColorDisplay {
  // Header doubles as a collapse toggle. Reset (restore the active overlay's defaults) sits inline
  // with the colormap row, not the header — it reads as "reset these colors".
  const head = h('button', { type: 'button', class: 'color-display-head' }, ['Color display'])
  const resetBtn = h('button', { type: 'button', class: 'ghost sm' }, ['Reset']) as HTMLButtonElement
  resetBtn.addEventListener('click', () => cb.onReset?.())

  const picker: ColormapPicker = createColormapPicker({ gradients, infos, onChange: (k) => cb.onColormap(k) })
  const legend: Legend = createLegend('Legend')

  let clipDomain = { min: 0, max: 1 }
  const displayRange: RangeControl = createRangeControl({
    onChange: ({ min, max }) => cb.onDisplayRange(min, max),
    symmetric: cb.onDisplaySymmetric ? false : undefined,
    onSymmetric: cb.onDisplaySymmetric,
  })
  const clipRange: RangeControl = createRangeControl({
    onChange: ({ min, max }) => {
      const lo = min <= clipDomain.min + EPS ? null : min
      const hi = max >= clipDomain.max - EPS ? null : max
      cb.onClipRange?.(lo, hi)
    },
  })
  const hideChip = h('button', { type: 'button', class: 'chip' }, ['Hide below min']) as HTMLButtonElement
  hideChip.addEventListener('click', () => {
    const on = !hideChip.classList.contains('active')
    hideChip.classList.toggle('active', on)
    cb.onHideBelowMin?.(on)
  })
  const clipToggleField = h('div', { class: 'field' }, [h('span', {}, ['Clip']), h('div', { class: 'chip-row' }, [hideChip])])

  const displayField = h('div', { class: 'field' }, [h('span', {}, ['Display']), displayRange.element])
  const clipRangeField = h('div', { class: 'field' }, [h('span', {}, ['Clip']), clipRange.element])

  const body = h('div', { class: 'color-display-body' }, [
    h('div', { class: 'field' }, [
      h('div', { class: 'row' }, [h('span', { class: 'grow' }, ['Colormap']), resetBtn]),
      picker.element,
    ]),
    legend.element,
    displayField,
    clipRangeField,
    clipToggleField,
  ])
  const element = h('div', { class: 'color-display', hidden: true }, [
    h('div', { class: 'color-display-title' }, [head],),
    body,
  ])
  // Clicking the header collapses/expands the body (keeps a short window usable).
  head.addEventListener('click', () => element.classList.toggle('collapsed'))

  return {
    element,
    setGradients: (g) => picker.setGradients(g),
    setTarget: (t) => {
      if (!t) {
        element.hidden = true
        return
      }
      element.hidden = false
      picker.setValue(t.colormap)
      // Legend
      legend.set({
        shape: t.legendShape,
        gradient: t.gradient,
        lut: t.lut,
        min: t.displayRange.min,
        max: t.displayRange.max,
        clipLow: t.clipValue?.lo ?? null,
        clipHigh: t.clipValue?.hi ?? null,
        unit: t.unit,
      })
      // Display range
      displayField.hidden = t.showDisplayRange === false
      displayRange.setDomain(t.displayDomain.min, t.displayDomain.max)
      displayRange.setValue(t.displayRange.min, t.displayRange.max)
      if (t.displaySymmetric !== undefined) displayRange.setSymmetric(t.displaySymmetric)
      // Clip variant
      clipRangeField.hidden = t.clip !== 'range'
      clipToggleField.hidden = t.clip !== 'toggle'
      if (t.clip === 'range' && t.clipDomain) {
        clipDomain = t.clipDomain
        clipRange.setDomain(t.clipDomain.min, t.clipDomain.max)
        clipRange.setValue(t.clipValue?.lo ?? t.clipDomain.min, t.clipValue?.hi ?? t.clipDomain.max)
      }
      if (t.clip === 'toggle') hideChip.classList.toggle('active', !!t.hideBelowMin)
    },
  }
}

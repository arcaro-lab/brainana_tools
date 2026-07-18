// Reusable min/max range control: two crafted sliders with live numeric read-outs, an optional
// "Auto" (percentile) button. Generalized from the morphology panel so morphology, functional,
// and future imported overlays share one range widget. Pure UI (h() helper); the host owns the
// data and computes Auto ranges.
import { h } from '../dom.ts'

export interface RangeValue {
  min: number
  max: number
}

export interface RangeControlOptions {
  label?: string
  onChange: (r: RangeValue) => void
  /** Show an "Auto" button; the host computes + pushes the range back via setValue. */
  onAuto?: () => void
  autoLabel?: string
  /** Format a value for the read-out (defaults to 3 significant decimals, trimmed). */
  format?: (v: number) => string
}

export interface RangeControl {
  /** The min side: label + number read-out + range slider, for placing as a grid item. */
  minSide: HTMLElement
  /** The max side: label + number read-out + range slider, for placing as a grid item. */
  maxSide: HTMLElement
  setDomain: (min: number, max: number, step?: number) => void
  setValue: (min: number, max: number) => void
  value: () => RangeValue
  /** Pin the lower bound: disable the min handle/box so only the upper bound drags (e.g. atlas). */
  setLockMin: (on: boolean) => void
  /** Blank/disable the control (e.g. no active metric). */
  setDisabled: (disabled: boolean) => void
}

const defaultFmt = (v: number): string => {
  const s = Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3)
  return s.replace(/\.?0+$/, '') || '0'
}

export function createRangeControl(opts: RangeControlOptions): RangeControl {
  const fmt = opts.format ?? defaultFmt

  const minInput = h('input', { type: 'range' }) as HTMLInputElement
  const maxInput = h('input', { type: 'range' }) as HTMLInputElement
  // Editable numeric read-outs: the value can be typed as well as dragged (kept in sync with the slider).
  const minVal = h('input', { type: 'number', class: 'range-num' }) as HTMLInputElement
  const maxVal = h('input', { type: 'number', class: 'range-num' }) as HTMLInputElement

  let domainMin = 0
  let domainMax = 1
  let step = 0.001

  const applyBounds = (): void => {
    for (const inp of [minInput, maxInput]) {
      inp.min = String(domainMin)
      inp.max = String(domainMax)
      inp.step = String(step)
    }
  }

  const commit = (source: 'min' | 'max'): void => {
    let lo = Number(minInput.value)
    let hi = Number(maxInput.value)
    if (lo > hi) {
      if (source === 'min') hi = lo
      else lo = hi
      minInput.value = String(lo)
      maxInput.value = String(hi)
    }
    minVal.value = fmt(lo)
    maxVal.value = fmt(hi)
    opts.onChange({ min: lo, max: hi })
  }
  minInput.addEventListener('input', () => commit('min'))
  maxInput.addEventListener('input', () => commit('max'))

  // Typing into a numeric box: clamp to the slider bounds, push into the paired range input, commit.
  const editBox = (box: HTMLInputElement, slider: HTMLInputElement, source: 'min' | 'max'): void => {
    if (box.value.trim() === '' || Number.isNaN(Number(box.value))) {
      box.value = fmt(Number(slider.value))
      return
    }
    const lo = Number(slider.min)
    const hi = Number(slider.max)
    slider.value = String(Math.max(lo, Math.min(hi, Number(box.value))))
    commit(source)
  }
  minVal.addEventListener('change', () => editBox(minVal, minInput, 'min'))
  maxVal.addEventListener('change', () => editBox(maxVal, maxInput, 'max'))

  // Each side is a label element: [cap row: "min/max" + number read-out] stacked over [slider].
  // Exposed as separate DOM nodes so the host can place them as independent grid items.
  const minSide = h('label', { class: 'range-side' }, [
    h('span', { class: 'range-cap' }, ['min ', minVal]),
    minInput,
  ]) as HTMLElement

  const maxSide = h('label', { class: 'range-side' }, [
    h('span', { class: 'range-cap' }, ['max ', maxVal]),
    maxInput,
  ]) as HTMLElement

  return {
    minSide,
    maxSide,
    setDomain: (min, max, st) => {
      domainMin = min
      domainMax = max
      step = st ?? ((max - min) / 500 || 0.001)
      applyBounds()
    },
    setValue: (min, max) => {
      minInput.value = String(min)
      maxInput.value = String(max)
      minVal.value = fmt(min)
      maxVal.value = fmt(max)
    },
    value: () => ({ min: Number(minInput.value), max: Number(maxInput.value) }),
    setLockMin: (on) => {
      minInput.disabled = on
      minVal.disabled = on
      minSide.classList.toggle('range-side-locked', on)
    },
    setDisabled: (disabled) => {
      minInput.disabled = disabled
      maxInput.disabled = disabled
      minSide.classList.toggle('is-disabled', disabled)
      maxSide.classList.toggle('is-disabled', disabled)
    },
  }
}

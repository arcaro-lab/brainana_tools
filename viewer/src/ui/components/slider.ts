// Single labelled slider with an editable numeric box, laid out on one row (label · slider · box).
// Generalized so the panels stop hand-rolling `<input type="range">` + a read-out span; the box is
// a real `<input type="number">` so the value can be typed as well as dragged. The two stay in sync.
import { h } from '../dom.ts'

export interface SliderOptions {
  label: string
  min: number
  max: number
  step: number
  value: number
  onInput: (v: number) => void
  /** Optional formatter for the label suffix (e.g. "F ≥ 1.20"); shown after the label text. */
  suffix?: (v: number) => string
  disabled?: boolean
}

export interface Slider {
  element: HTMLElement
  value: () => number
  setValue: (v: number) => void
  setBounds: (min: number, max: number, step?: number) => void
  setDisabled: (disabled: boolean) => void
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

export function createSlider(opts: SliderOptions): Slider {
  let min = opts.min
  let max = opts.max
  let step = opts.step
  const range = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(opts.value) }) as HTMLInputElement
  const box = h('input', { type: 'number', class: 'slider-num', min: String(min), max: String(max), step: String(step), value: String(opts.value) }) as HTMLInputElement
  const suffixEl = opts.suffix ? h('span', { class: 'muted slider-suffix' }, [opts.suffix(opts.value)]) : null
  const labelEl = h('span', { class: 'slider-label' }, suffixEl ? [`${opts.label} `, suffixEl] : [opts.label])

  const sync = (v: number, source: 'range' | 'box' | 'both'): void => {
    if (source !== 'range') range.value = String(v)
    if (source !== 'box') box.value = String(v)
    if (suffixEl && opts.suffix) suffixEl.textContent = opts.suffix(v)
  }
  range.addEventListener('input', () => {
    const v = Number(range.value)
    sync(v, 'range')
    opts.onInput(v)
  })
  // The box commits on change/blur (not every keystroke); empty/NaN restores the current slider value.
  const commitBox = (): void => {
    if (box.value.trim() === '' || Number.isNaN(Number(box.value))) {
      box.value = range.value
      return
    }
    const v = clamp(Number(box.value), min, max)
    sync(v, 'box')
    box.value = String(v)
    opts.onInput(v)
  }
  box.addEventListener('change', commitBox)

  const element = h('label', { class: 'field slider-field' }, [labelEl, h('div', { class: 'slider-row' }, [range, box])])
  if (opts.disabled) {
    range.disabled = true
    box.disabled = true
  }

  return {
    element,
    value: () => Number(range.value),
    setValue: (v) => {
      const c = clamp(v, min, max)
      sync(c, 'both')
    },
    setBounds: (lo, hi, st) => {
      min = lo
      max = hi
      if (st != null) step = st
      for (const inp of [range, box]) {
        inp.min = String(min)
        inp.max = String(max)
        inp.step = String(step)
      }
    },
    setDisabled: (disabled) => {
      range.disabled = disabled
      box.disabled = disabled
      element.classList.toggle('is-disabled', disabled)
    },
  }
}

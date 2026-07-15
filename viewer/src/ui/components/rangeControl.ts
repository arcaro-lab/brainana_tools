// Reusable min/max range control: two crafted sliders with live numeric read-outs, an optional
// "Auto" (percentile) button and an optional "Symmetric" (mirror around zero) toggle. Generalized
// from the morphology panel so morphology, functional, and future imported overlays share one
// range widget. Pure UI (h() helper); the host owns the data and computes Auto ranges.
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
  /** Show a "Symmetric" toggle initialised to this state; omit to hide it. */
  symmetric?: boolean
  onSymmetric?: (on: boolean) => void
  /** Format a value for the read-out (defaults to 3 significant decimals, trimmed). */
  format?: (v: number) => string
}

export interface RangeControl {
  element: HTMLElement
  setDomain: (min: number, max: number, step?: number) => void
  setValue: (min: number, max: number) => void
  value: () => RangeValue
  setSymmetric: (on: boolean) => void
  /** Blank/disable the control (e.g. no active metric). */
  setDisabled: (disabled: boolean) => void
}

const defaultFmt = (v: number): string => {
  const s = Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3)
  return s.replace(/\.?0+$/, '') || '0'
}

export function createRangeControl(opts: RangeControlOptions): RangeControl {
  const fmt = opts.format ?? defaultFmt
  let symmetric = !!opts.symmetric

  const minInput = h('input', { type: 'range' }) as HTMLInputElement
  const maxInput = h('input', { type: 'range' }) as HTMLInputElement
  const minVal = h('span', { class: 'range-num muted' }, ['—'])
  const maxVal = h('span', { class: 'range-num muted' }, ['—'])

  const commit = (): void => {
    let lo = Number(minInput.value)
    let hi = Number(maxInput.value)
    if (symmetric) {
      const mag = Math.max(Math.abs(lo), Math.abs(hi))
      lo = -mag
      hi = mag
      minInput.value = String(lo)
      maxInput.value = String(hi)
    } else if (lo > hi) {
      lo = hi
      minInput.value = String(lo)
    }
    minVal.textContent = fmt(lo)
    maxVal.textContent = fmt(hi)
    opts.onChange({ min: lo, max: hi })
  }
  minInput.addEventListener('input', commit)
  maxInput.addEventListener('input', commit)

  const actions: Array<Node> = []
  if (opts.onAuto) {
    const autoBtn = h('button', { type: 'button', class: 'chip' }, [opts.autoLabel ?? 'Auto']) as HTMLButtonElement
    autoBtn.addEventListener('click', () => opts.onAuto?.())
    actions.push(autoBtn)
  }
  let symChip: HTMLButtonElement | null = null
  if (opts.onSymmetric || opts.symmetric !== undefined) {
    symChip = h('button', { type: 'button', class: `chip${symmetric ? ' active' : ''}` }, ['Symmetric']) as HTMLButtonElement
    symChip.addEventListener('click', () => {
      symmetric = !symmetric
      symChip!.classList.toggle('active', symmetric)
      opts.onSymmetric?.(symmetric)
      if (symmetric) commit()
    })
    actions.push(symChip)
  }

  const element = h('div', { class: 'range-control field' }, [
    ...(opts.label ? [h('span', {}, [opts.label])] : []),
    h('div', { class: 'range-pair' }, [
      h('label', { class: 'range-side' }, [h('span', { class: 'range-cap' }, ['Min ', minVal]), minInput]),
      h('label', { class: 'range-side' }, [h('span', { class: 'range-cap' }, ['Max ', maxVal]), maxInput]),
    ]),
    ...(actions.length ? [h('div', { class: 'chip-row range-actions' }, actions)] : []),
  ])

  return {
    element,
    setDomain: (min, max, step) => {
      const st = step ?? ((max - min) / 500 || 0.001)
      for (const inp of [minInput, maxInput]) {
        inp.min = String(min)
        inp.max = String(max)
        inp.step = String(st)
      }
    },
    setValue: (min, max) => {
      minInput.value = String(min)
      maxInput.value = String(max)
      minVal.textContent = fmt(min)
      maxVal.textContent = fmt(max)
    },
    value: () => ({ min: Number(minInput.value), max: Number(maxInput.value) }),
    setSymmetric: (on) => {
      symmetric = on
      symChip?.classList.toggle('active', on)
    },
    setDisabled: (disabled) => {
      minInput.disabled = disabled
      maxInput.disabled = disabled
      element.classList.toggle('is-disabled', disabled)
    },
  }
}

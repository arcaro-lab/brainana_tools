// Pure helpers for display-range + value-clip management, shared by every value overlay
// (morphology, functional, and future imported volumes). No NiiVue/DOM here so the numeric
// behaviour is unit-tested. These generalize the previously-inline morphology auto-range
// (dashboard.ts) and mirror functional.ts's F-stat masking for a value-based clip.

export interface RangeValue {
  min: number
  max: number
}

/**
 * Robust display range from the [loPct, hiPct] percentiles of the finite samples.
 * - `symmetric`: mirror the larger magnitude around zero (diverging metrics like curvature).
 * - `positiveOnly`: ignore non-positive samples (e.g. cortical thickness).
 * Returns {0,0} when there is no usable sample.
 */
export function percentileRange(
  values: ArrayLike<number>,
  loPct: number,
  hiPct: number,
  opts: { symmetric?: boolean; positiveOnly?: boolean } = {},
): RangeValue {
  const all: number[] = []
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (Number.isFinite(v) && (!opts.positiveOnly || v > 0)) all.push(v)
  }
  if (all.length === 0) return { min: 0, max: 0 }
  all.sort((a, b) => a - b)
  const at = (p: number): number => all[Math.min(all.length - 1, Math.max(0, Math.round((p / 100) * (all.length - 1))))]
  let min = at(loPct)
  let max = at(hiPct)
  if (opts.symmetric) {
    const m = Math.max(Math.abs(min), Math.abs(max))
    min = -m
    max = m
  }
  return { min, max }
}

/**
 * Masked copy of a value frame: keep a sample only when it is finite and inside the
 * inclusive clip window; everything else becomes NaN (rendered transparent by the overlay
 * shader). A null bound leaves that side unbounded. This is the shared "value threshold clip".
 */
export function applyValueClip(frame: ArrayLike<number>, lo: number | null, hi: number | null): Float32Array {
  const out = new Float32Array(frame.length)
  for (let i = 0; i < frame.length; i++) {
    const v = frame[i]
    const keep = Number.isFinite(v) && (lo === null || v >= lo) && (hi === null || v <= hi)
    out[i] = keep ? v : NaN
  }
  return out
}

/** Clamp a [min,max] pair to a domain and guarantee min <= max (min wins on inversion). */
export function clampRange(value: RangeValue, domain: RangeValue): RangeValue {
  const lo = Math.min(Math.max(value.min, domain.min), domain.max)
  const hi = Math.min(Math.max(value.max, domain.min), domain.max)
  return { min: Math.min(lo, hi), max: Math.max(lo, hi) }
}

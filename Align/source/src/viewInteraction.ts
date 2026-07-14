import type { Niivue } from '@niivue/niivue'
import type { Plane } from './appTypes'
import type { Vec3 } from './rigid'
import { normalizeWheelDelta } from './browserCapabilities'

const wheelSliceAccumulator = new WeakMap<HTMLCanvasElement, number>()
const projectionRefreshFrames = new WeakMap<HTMLCanvasElement, number>()

export type HoveredView = { canvas: HTMLCanvasElement; nv: Niivue; redrawMarkers: () => void }

export function scheduleProjectionRefresh(canvas: HTMLCanvasElement, redraw: () => void): void {
  const previous = projectionRefreshFrames.get(canvas)
  if (previous !== undefined) cancelAnimationFrame(previous)
  let remaining = 3
  const refresh = () => {
    redraw()
    remaining -= 1
    if (remaining > 0) projectionRefreshFrames.set(canvas, requestAnimationFrame(refresh))
    else projectionRefreshFrames.delete(canvas)
  }
  projectionRefreshFrames.set(canvas, requestAnimationFrame(refresh))
}

export function installProjectionRefresh(canvas: HTMLCanvasElement, redraw: () => void): void {
  canvas.addEventListener('wheel', () => scheduleProjectionRefresh(canvas, redraw), { passive: true })
  canvas.addEventListener('pointermove', event => {
    if (event.buttons) scheduleProjectionRefresh(canvas, redraw)
  }, { passive: true })
  canvas.addEventListener('pointerup', () => scheduleProjectionRefresh(canvas, redraw), { passive: true })
}

export function installHoverKeyboardPan(
  canvas: HTMLCanvasElement,
  nv: Niivue,
  redrawMarkers: () => void,
  setHovered: (view: HoveredView | null) => void,
): void {
  const target: HoveredView = { canvas, nv, redrawMarkers }
  canvas.addEventListener('mouseenter', () => setHovered(target))
  canvas.addEventListener('mouseleave', () => setHovered(null))
}

export function panViewInScreenDirection(target: HoveredView, dxCss: number, dyCss: number): void {
  const { canvas, nv } = target
  const rect = canvas.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const center: [number, number] = [canvas.width * 0.5, canvas.height * 0.5]
  const shifted: [number, number] = [center[0] + dxCss * scaleX, center[1] + dyCss * scaleY]
  const startFrac = nv.canvasPos2frac(center)
  const endFrac = nv.canvasPos2frac(shifted)
  if (!startFrac || !endFrac) return
  const startMm = nv.frac2mm(startFrac)
  const endMm = nv.frac2mm(endFrac)
  if (![...startMm, ...endMm].every(Number.isFinite)) return
  const zoom = Number(nv.scene.pan2Dxyzmm[3]) || 1
  nv.scene.pan2Dxyzmm[0] += zoom * (Number(endMm[0]) - Number(startMm[0]))
  nv.scene.pan2Dxyzmm[1] += zoom * (Number(endMm[1]) - Number(startMm[1]))
  nv.scene.pan2Dxyzmm[2] += zoom * (Number(endMm[2]) - Number(startMm[2]))
  nv.drawScene()
  target.redrawMarkers()
}

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function installWheelZoomAndSlice(
  canvas: HTMLCanvasElement,
  nv: Niivue,
  getSliceDims: () => [number, number, number] | null,
  plane: Plane,
  onSliceMm?: (mm: Vec3) => void,
): void {
  canvas.title = 'Wheel or two-finger scroll: zoom. Shift + wheel: change slice. Hover and use arrow keys, or drag empty space, to pan the field of view.'
  canvas.addEventListener('wheel', event => {
    if (!event.shiftKey) return
    event.preventDefault()
    event.stopImmediatePropagation()
    const previous = wheelSliceAccumulator.get(canvas) ?? 0
    const accumulated = previous + normalizeWheelDelta(event, canvas.clientHeight || 800)
    const threshold = 24
    if (Math.abs(accumulated) < threshold) {
      wheelSliceAccumulator.set(canvas, accumulated)
      return
    }
    const steps = Math.max(-4, Math.min(4, Math.trunc(accumulated / threshold)))
    wheelSliceAccumulator.set(canvas, accumulated - steps * threshold)
    const dims = getSliceDims()
    if (!dims) return
    const axis = plane === 'sagittal' ? 0 : plane === 'coronal' ? 1 : 2
    const frac = [...nv.scene.crosshairPos] as number[]
    const denominator = Math.max(1, dims[axis] - 1)
    frac[axis] = Math.max(0, Math.min(1, frac[axis] + steps / denominator))
    const mmRaw = nv.frac2mm(frac)
    const mm: Vec3 = [Number(mmRaw[0]), Number(mmRaw[1]), Number(mmRaw[2])]
    if (onSliceMm) onSliceMm(mm)
    else {
      nv.scene.crosshairPos = frac as any
      nv.drawScene()
      nv.sync()
    }
  }, { capture: true, passive: false })
}

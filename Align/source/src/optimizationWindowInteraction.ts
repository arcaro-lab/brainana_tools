import type { View, WindowBounds } from './appTypes'
import type { Vec3 } from './rigid'
import { createWindowBounds, isUsableWindowBounds, planeAxes } from './optimizationWindows'

export function windowBoundsForCompletedDrag(start: Vec3, lastValid: Vec3, current: Vec3 | null, plane: View['plane'], pixDims: number[]): WindowBounds | null {
  const bounds = createWindowBounds(start, current ?? lastValid, plane)
  const [a, b] = planeAxes[plane]
  const minimumSpan = Math.max(Number(pixDims[a]) || 1, Number(pixDims[b]) || 1) * 1.5
  return isUsableWindowBounds(bounds, plane, minimumSpan) ? bounds : null
}

export type OptimizationWindowInteractionOptions = {
  view: View
  isEnabled: () => boolean
  getPixDims: () => number[] | null
  eventToMm: (event: PointerEvent) => Vec3 | null
  onCommit: (bounds: WindowBounds) => void
  onReject: () => void
}

export function installOptimizationWindowCapture(options: OptimizationWindowInteractionOptions): () => void {
  const { view } = options
  const onPointerDown = (event: PointerEvent) => beginOptimizationWindowDrag(event, options)
  const interactionSurface = view.windowLayer.parentElement ?? view.windowLayer
  // Capture at the view-card boundary. This is independent of canvas/SVG stacking
  // and gives all six MRI/CT views exactly the same input path.
  interactionSurface.addEventListener('pointerdown', onPointerDown, true)
  return () => interactionSurface.removeEventListener('pointerdown', onPointerDown, true)
}

function beginOptimizationWindowDrag(event: PointerEvent, options: OptimizationWindowInteractionOptions) {
  const { view } = options
  if (!options.isEnabled()) return
  const start = options.eventToMm(event)
  if (!start) return
  event.preventDefault()
  event.stopPropagation()

  const preview = document.createElement('div')
  preview.className = 'optimization-window-box preview'
  view.windowLayer.replaceChildren(preview)

  let lastMm = start
  const pointerId = event.pointerId
  const layerRect = view.windowLayer.getBoundingClientRect()
  const sx = event.clientX - layerRect.left
  const sy = event.clientY - layerRect.top
  const controller = new AbortController()
  const listenerOptions = { capture: true, signal: controller.signal } as AddEventListenerOptions

  const update = (currentEvent: PointerEvent) => {
    if (currentEvent.pointerId !== pointerId) return
    currentEvent.preventDefault()
    const ex = currentEvent.clientX - layerRect.left
    const ey = currentEvent.clientY - layerRect.top
    preview.style.left = `${Math.min(sx, ex)}px`
    preview.style.top = `${Math.min(sy, ey)}px`
    preview.style.width = `${Math.abs(ex - sx)}px`
    preview.style.height = `${Math.abs(ey - sy)}px`
    const mm = options.eventToMm(currentEvent)
    if (mm) lastMm = mm
  }

  const complete = (currentEvent: PointerEvent) => {
    if (currentEvent.pointerId !== pointerId) return
    currentEvent.preventDefault()
    controller.abort()
    const bounds = windowBoundsForCompletedDrag(
      start,
      lastMm,
      options.eventToMm(currentEvent),
      view.plane,
      options.getPixDims() ?? [1, 1, 1],
    )
    if (!bounds) {
      options.onReject()
      return
    }
    options.onCommit(bounds)
  }

  // Document-level listeners avoid browser and WebGL-canvas differences in
  // pointer capture. A pointercancel commits the last valid image coordinate,
  // matching pointerup rather than silently discarding a visible drag preview.
  document.addEventListener('pointermove', update, listenerOptions)
  document.addEventListener('pointerup', complete, listenerOptions)
  document.addEventListener('pointercancel', complete, listenerOptions)
  update(event)
}

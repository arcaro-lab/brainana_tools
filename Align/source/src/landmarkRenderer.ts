import type { FitState, Landmark, Loaded, Modality, Plane, ReviewView, View } from './appTypes'
import type { Vec3 } from './rigid'
import { imagePointToCanvas, planeDepthAxis } from './coordinateProjection'

const SVG_NS = 'http://www.w3.org/2000/svg'

export function depthDistance(current: Vec3 | null, plane: Plane, point: Vec3): number {
  if (!current) return Infinity
  return Math.abs(point[planeDepthAxis(plane)] - current[planeDepthAxis(plane)])
}

export type ModalityMarkerContext = {
  views: Record<Plane, View>
  loaded: Loaded | null
  currentMm: Vec3 | null
  landmarks: Landmark[]
  selectedId: number | null
  fitResult: FitState | null
  renderOptimizationWindow: (view: View) => void
  onMarkerPointerDown: (event: PointerEvent, view: View, id: number) => void
}

export function renderModalityMarkers(context: ModalityMarkerContext): void {
  const { views, loaded, currentMm, landmarks, selectedId, fitResult } = context
  for (const view of Object.values(views)) {
    const { overlay, plane, canvas } = view
    overlay.setAttribute('viewBox', `0 0 ${canvas.width || 1} ${canvas.height || 1}`)
    overlay.innerHTML = ''
    if (!loaded) continue
    const tolerance = Math.max(...loaded.raw.pixDims) * 1.25
    for (const landmark of landmarks) {
      const point = landmark[view.modality]
      if (!point) continue
      const distance = depthDistance(currentMm, plane, point)
      if (distance > tolerance * 2.5) continue
      const pos = imagePointToCanvas(view, point)
      if (!pos) continue
      const group = document.createElementNS(SVG_NS, 'g')
      group.classList.add('marker')
      if (landmark.id === selectedId) group.classList.add('selected')
      if (!landmark.enabled) group.classList.add('disabled')
      if (distance > tolerance) group.classList.add('nearby')
      group.setAttribute('transform', `translate(${pos[0]},${pos[1]})`)
      group.dataset.id = String(landmark.id)
      group.innerHTML = `<circle class="hit" r="15"></circle><circle class="ring" r="7"></circle><line x1="-11" y1="0" x2="11" y2="0"></line><line x1="0" y1="-11" x2="0" y2="11"></line><text x="10" y="-9">${landmark.id}</text>`
      group.addEventListener('pointerdown', event => context.onMarkerPointerDown(event, view, landmark.id))
      overlay.appendChild(group)
    }
    context.renderOptimizationWindow(view)
    if (!fitResult?.landmarksChanged) continue
    for (const landmark of fitResult.landmarkSnapshot) {
      const point = landmark[view.modality]
      if (!point) continue
      const current = landmarks.find(candidate => candidate.id === landmark.id)?.[view.modality]
      if (current && Math.hypot(current[0]-point[0], current[1]-point[1], current[2]-point[2]) < 1e-4) continue
      const distance = depthDistance(currentMm, plane, point)
      if (distance > tolerance * 2.5) continue
      const pos = imagePointToCanvas(view, point)
      if (!pos) continue
      const group = document.createElementNS(SVG_NS, 'g')
      group.classList.add('marker', 'alignment-snapshot')
      if (distance > tolerance) group.classList.add('nearby')
      group.setAttribute('transform', `translate(${pos[0]},${pos[1]})`)
      group.innerHTML = `<circle class="ring" r="9"></circle><text x="12" y="12">${landmark.id}</text>`
      overlay.appendChild(group)
    }
  }
}

export type ReviewMarkerContext = {
  views: Record<Plane, ReviewView>
  fixedLoaded: Loaded | null
  fixedCurrentMm: Vec3 | null
  fitResult: FitState | null
  pointFor: (landmark: Landmark, modality: Modality) => Vec3 | null
  fixedModality: Modality | null
  movingModality: Modality | null
}

export function renderReviewLandmarks(context: ReviewMarkerContext): void {
  for (const view of Object.values(context.views)) {
    const { overlay, plane, canvas } = view
    overlay.setAttribute('viewBox', `0 0 ${canvas.width || 1} ${canvas.height || 1}`)
    overlay.innerHTML = ''
    if (!context.fitResult || !context.fixedLoaded || !context.fixedCurrentMm || !context.fixedModality || !context.movingModality) continue
    const tolerance = Math.max(...context.fixedLoaded.raw.pixDims) * 1.25
    for (const landmark of context.fitResult.landmarkSnapshot) {
      if (!landmark.enabled) continue
      const points: Array<{ point: Vec3 | null; kind: 'fixed' | 'moving' }> = [
        { point: context.pointFor(landmark, context.fixedModality), kind: 'fixed' },
        { point: context.pointFor(landmark, context.movingModality), kind: 'moving' },
      ]
      for (const item of points) {
        if (!item.point) continue
        const distance = depthDistance(context.fixedCurrentMm, plane, item.point)
        if (distance > tolerance * 2.5) continue
        const pos = imagePointToCanvas(view as unknown as View, item.point)
        if (!pos) continue
        const group = document.createElementNS(SVG_NS, 'g')
        group.classList.add('review-marker', item.kind)
        if (distance > tolerance) group.classList.add('nearby')
        group.setAttribute('transform', `translate(${pos[0]},${pos[1]})`)
        group.innerHTML = item.kind === 'fixed'
          ? `<circle r="8"></circle><text x="11" y="-9">${landmark.id}</text>`
          : '<path d="M 0 -9 L 9 0 L 0 9 L -9 0 Z"></path>'
        overlay.appendChild(group)
      }
    }
  }
}

import type { Modality, Plane, ReviewView, View } from './appTypes'
import type { Vec3 } from './rigid'
import { coordinateLabel } from './coordinateProjection'

export function setOrthogonalCrosshairs(
  modality: Modality,
  views: Record<Plane, View>,
  mm: Vec3,
  sourcePlane?: Plane,
): void {
  for (const view of Object.values(views)) {
    if (sourcePlane && view.plane === sourcePlane) continue
    view.nv.scene.crosshairPos = view.nv.mm2frac(mm)
    view.nv.drawScene()
  }
  const label = document.querySelector<HTMLElement>(`#${modality}-coords`)
  if (label) label.textContent = coordinateLabel(mm)
}

export function setReviewCrosshairs(views: Record<Plane, ReviewView>, mm: Vec3): void {
  for (const view of Object.values(views)) {
    if (!view.nv.volumes.length) continue
    view.nv.scene.crosshairPos = view.nv.mm2frac(mm)
    view.nv.drawScene()
  }
}

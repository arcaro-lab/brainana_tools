// Docked "morphology" picker (top of the side panel): choose the surface shading metric (curvature /
// sulcal depth / thickness / none) and the curvature style (binary FreeSurfer vs continuous gray)
// from dropdowns. Color controls (colormap, display range, clip, legend) live in the shared "Color
// display" section at the bottom of the side panel. The yellow-marker mode moved to the toolbar's
// Marker / Crosshair section.
import { h, selectField, type SelectOption } from '../dom.ts'
import type { MorphologyDisplayMetric, CurvatureStyle } from '../../niivue/multiView.ts'

// Marker placement mode (used by the toolbar Marker / Crosshair section + the dashboard).
export type MarkerMode = 'crosshair3d' | 'nearestNode'

export interface MorphologyPanelCallbacks {
  onDisplay: (m: MorphologyDisplayMetric) => void
  onCurvatureStyle: (s: CurvatureStyle) => void
}

export interface MorphologyPanel {
  element: HTMLElement
  toggle: () => void
  hide: () => void
}

export function createMorphologyPanel(cb: MorphologyPanelCallbacks): MorphologyPanel {
  const metricOptions: SelectOption[] = [
    { value: 'curvature', label: 'Curvature' },
    { value: 'sulc', label: 'Sulcal depth' },
    { value: 'thickness', label: 'Thickness' },
    { value: 'none', label: 'None' },
  ]
  const styleField = { element: null as unknown as HTMLElement }

  const metricPicker = selectField('Display', metricOptions, (value) => {
    styleField.element.hidden = value !== 'curvature'
    cb.onDisplay(value as MorphologyDisplayMetric)
  })

  const stylePicker = selectField('Curvature style', [
    { value: 'binary', label: 'Binary' },
    { value: 'continuous', label: 'Continuous' },
  ], (value) => cb.onCurvatureStyle(value as CurvatureStyle))
  styleField.element = stylePicker.element

  const element = h('div', { class: 'side-panel', hidden: true }, [
    h('div', { class: 'side-panel-head' }, ['morphology']),
    metricPicker.element,
    stylePicker.element,
  ])

  // Initial active states (curvature · binary).
  metricPicker.setValue('curvature')
  stylePicker.setValue('binary')

  return {
    element,
    toggle: () => (element.hidden = !element.hidden),
    hide: () => (element.hidden = true),
  }
}

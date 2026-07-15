// Docked "Morphology" picker (top of the side panel): choose the surface shading metric (curvature /
// sulcal depth / thickness / none), the curvature style (binary FreeSurfer vs continuous gray), and
// the yellow marker mode. Color controls (colormap, display range, clip, legend) live in the shared
// "Color display" section at the bottom of the side panel, not here.
import { h } from '../dom.ts'
import type { MorphologyDisplayMetric, CurvatureStyle } from '../../niivue/multiView.ts'

export type MarkerMode = 'crosshair3d' | 'nearestNode'

export interface MorphologyPanelCallbacks {
  onDisplay: (m: MorphologyDisplayMetric) => void
  onCurvatureStyle: (s: CurvatureStyle) => void
  onMarkerMode: (m: MarkerMode) => void
}

export interface MorphologyPanel {
  element: HTMLElement
  toggle: () => void
  hide: () => void
}

const chip = (label: string): HTMLButtonElement => h('button', { type: 'button', class: 'chip' }, [label]) as HTMLButtonElement

export function createMorphologyPanel(cb: MorphologyPanelCallbacks): MorphologyPanel {
  // Display metric chips.
  const displayChips: Array<[MorphologyDisplayMetric, string]> = [
    ['curvature', 'Curvature'],
    ['sulc', 'Sulcal depth'],
    ['thickness', 'Thickness'],
    ['none', 'None'],
  ]
  const displayButtons = new Map<MorphologyDisplayMetric, HTMLButtonElement>()
  const displayRow = h('div', { class: 'chip-row' })
  const setActiveMetric = (m: MorphologyDisplayMetric): void => {
    for (const [k, b] of displayButtons) b.classList.toggle('active', k === m)
    styleField.hidden = m !== 'curvature'
  }
  for (const [metric, label] of displayChips) {
    const b = chip(label)
    b.addEventListener('click', () => {
      setActiveMetric(metric)
      cb.onDisplay(metric)
    })
    displayButtons.set(metric, b)
    displayRow.append(b)
  }

  // Curvature style chips (only meaningful for curvature).
  const styleButtons = new Map<CurvatureStyle, HTMLButtonElement>()
  const styleRow = h('div', { class: 'chip-row' })
  const setActiveStyle = (s: CurvatureStyle): void => {
    for (const [k, b] of styleButtons) b.classList.toggle('active', k === s)
  }
  for (const [style, label] of [['binary', 'Binary'], ['continuous', 'Continuous']] as Array<[CurvatureStyle, string]>) {
    const b = chip(label)
    b.addEventListener('click', () => {
      setActiveStyle(style)
      cb.onCurvatureStyle(style)
    })
    styleButtons.set(style, b)
    styleRow.append(b)
  }
  const styleField = h('div', { class: 'field' }, [h('span', {}, ['Curvature style']), styleRow])

  // Yellow marker mode chips.
  const markerButtons = new Map<MarkerMode, HTMLButtonElement>()
  const markerRow = h('div', { class: 'chip-row' })
  for (const [mode, label] of [['crosshair3d', '3D crosshair'], ['nearestNode', 'Nearest node']] as Array<[MarkerMode, string]>) {
    const b = chip(label)
    b.addEventListener('click', () => {
      for (const [k, mb] of markerButtons) mb.classList.toggle('active', k === mode)
      cb.onMarkerMode(mode)
    })
    markerButtons.set(mode, b)
    markerRow.append(b)
  }

  const element = h('div', { class: 'side-panel', hidden: true }, [
    h('div', { class: 'side-panel-head' }, ['Morphology']),
    h('div', { class: 'field' }, [h('span', {}, ['Display']), displayRow]),
    styleField,
    h('div', { class: 'field' }, [h('span', {}, ['Yellow marker']), markerRow]),
  ])

  // Initial active states.
  setActiveMetric('curvature')
  setActiveStyle('binary')
  markerButtons.get('crosshair3d')?.classList.add('active')

  return {
    element,
    toggle: () => (element.hidden = !element.hidden),
    hide: () => (element.hidden = true),
  }
}

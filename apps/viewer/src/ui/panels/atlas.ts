// Docked "atlas" picker (top of the side panel): pick an ARM level (1-6) or D99 from a dropdown,
// adjust overlay opacity, or clear.
import type { Manifest } from '../../types.ts'
import { h, selectField, type SelectOption } from '@brainana/ui/dom.ts'
import { createSlider } from '@brainana/ui/components/slider.ts'

export interface AtlasSelection {
  atlas: 'ARM' | 'D99'
  level: number // ARM level 1..6; 0 for D99
}

export interface AtlasPanelCallbacks {
  onSelect: (sel: AtlasSelection | null) => void
  onOpacity: (opacity: number) => void
}

export interface AtlasPanel {
  element: HTMLElement
  setActive: (sel: AtlasSelection | null) => void
}

const key = (sel: AtlasSelection | null): string => (sel ? `${sel.atlas}${sel.level}` : 'none')

// Parse an option value back into a selection ('none' → null, 'ARM3' → level 3, 'D990' → D99).
function parseKey(value: string): AtlasSelection | null {
  if (value === 'none') return null
  if (value.startsWith('ARM')) return { atlas: 'ARM', level: Number(value.slice(3)) }
  return { atlas: 'D99', level: 0 }
}

export function createAtlasPanel(manifest: Manifest, cb: AtlasPanelCallbacks): AtlasPanel {
  const options: SelectOption[] = [{ value: 'none', label: 'None' }]
  for (let i = 1; i <= 6; i++) {
    if (manifest.atlases?.charm?.[String(i)]) options.push({ value: `ARM${i}`, label: `ARM${i}` })
  }
  if (manifest.atlases?.d99) options.push({ value: 'D990', label: 'D99' })

  const picker = selectField('Atlas', options, (value) => cb.onSelect(parseKey(value)))
  const opacity = createSlider({ label: 'Overlay opacity', min: 0, max: 1, step: 0.05, value: 0.7, onInput: (v) => cb.onOpacity(v) })

  const element = h('div', { class: 'side-panel', hidden: true }, [
    h('div', { class: 'side-panel-head' }, ['atlas']),
    picker.element,
    opacity.element,
  ])

  return {
    element,
    setActive: (sel) => picker.setValue(key(sel)),
  }
}

export interface BrowserCapabilities {
  browser: 'chrome' | 'edge' | 'firefox' | 'safari' | 'unknown'
  browserVersion: string | null
  webgl2: boolean
  pointerEvents: boolean
  directoryPicker: boolean
  fileDownloads: boolean
  workers: boolean
  offscreenCanvas: boolean
  devicePixelRatio: number
  maxTextureSize: number | null
  hardwareRenderer: string | null
}

function detectBrowser(userAgent: string): Pick<BrowserCapabilities, 'browser' | 'browserVersion'> {
  const patterns: Array<[BrowserCapabilities['browser'], RegExp]> = [
    ['edge', /Edg\/(\d+(?:\.\d+)*)/],
    ['firefox', /Firefox\/(\d+(?:\.\d+)*)/],
    ['chrome', /(?:Chrome|CriOS)\/(\d+(?:\.\d+)*)/],
    ['safari', /Version\/(\d+(?:\.\d+)*).*Safari\//],
  ]
  for (const [browser, pattern] of patterns) {
    const match = userAgent.match(pattern)
    if (match) return { browser, browserVersion: match[1] ?? null }
  }
  return { browser: 'unknown', browserVersion: null }
}

export function detectBrowserCapabilities(win: Window = window): BrowserCapabilities {
  const identity = detectBrowser(win.navigator.userAgent)
  const canvas = win.document.createElement('canvas')
  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false })
  let maxTextureSize: number | null = null
  let hardwareRenderer: string | null = null
  if (gl) {
    maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || null
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    if (debug) hardwareRenderer = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || '') || null
  }
  return {
    ...identity,
    webgl2: !!gl,
    pointerEvents: 'PointerEvent' in win,
    directoryPicker: typeof (win as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function',
    fileDownloads: 'download' in win.document.createElement('a'),
    workers: 'Worker' in win,
    offscreenCanvas: 'OffscreenCanvas' in win,
    devicePixelRatio: Number(win.devicePixelRatio) || 1,
    maxTextureSize,
    hardwareRenderer,
  }
}

export function browserCompatibilityIssues(capabilities: BrowserCapabilities): string[] {
  const issues: string[] = []
  if (!capabilities.webgl2) issues.push('WebGL2 is unavailable. Brainana Align cannot display MRI or CT volumes in this browser.')
  if (!capabilities.pointerEvents) issues.push('Pointer Events are unavailable. Landmark and optimization-window interaction may not work reliably.')
  if (!capabilities.fileDownloads) issues.push('Browser file downloads are unavailable.')
  return issues
}

export function normalizeWheelDelta(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, pageHeight = 800): number {
  if (!Number.isFinite(event.deltaY)) return 0
  if (event.deltaMode === 1) return event.deltaY * 16
  if (event.deltaMode === 2) return event.deltaY * Math.max(1, pageHeight)
  return event.deltaY
}

export function capabilitySummary(capabilities: BrowserCapabilities): string {
  const browser = capabilities.browserVersion ? `${capabilities.browser} ${capabilities.browserVersion}` : capabilities.browser
  const renderer = capabilities.hardwareRenderer ? `, renderer: ${capabilities.hardwareRenderer}` : ''
  return `${browser}; WebGL2: ${capabilities.webgl2 ? 'available' : 'unavailable'}; max texture: ${capabilities.maxTextureSize ?? 'unknown'}${renderer}`
}

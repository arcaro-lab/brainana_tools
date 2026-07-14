import type { BrowserCapabilities } from './browserCapabilities'
import { browserCompatibilityIssues, capabilitySummary } from './browserCapabilities'

export function installBrowserCompatibilityBanner(capabilities: BrowserCapabilities): boolean {
  const issues = browserCompatibilityIssues(capabilities)
  const topbar = document.querySelector<HTMLElement>('.topbar')
  if (!topbar) return issues.length === 0

  const banner = document.createElement('section')
  banner.id = 'browser-compatibility'
  banner.className = issues.length ? 'browser-compatibility error' : 'browser-compatibility hidden'
  banner.setAttribute('role', issues.length ? 'alert' : 'status')
  banner.innerHTML = `
    <div><strong>Browser compatibility</strong><span id="browser-compatibility-message"></span></div>
    <details><summary>Technical details</summary><code id="browser-capability-summary"></code></details>
  `
  topbar.insertAdjacentElement('afterend', banner)
  banner.querySelector<HTMLElement>('#browser-compatibility-message')!.textContent = issues.join(' ')
  banner.querySelector<HTMLElement>('#browser-capability-summary')!.textContent = capabilitySummary(capabilities)
  if (issues.length) {
    for (const selector of ['#mri-file', '#ct-file', '#new-pair', '#refine', '#export-open']) {
      const control = document.querySelector<HTMLInputElement | HTMLButtonElement>(selector)
      if (control) control.disabled = true
    }
  }
  return issues.length === 0
}

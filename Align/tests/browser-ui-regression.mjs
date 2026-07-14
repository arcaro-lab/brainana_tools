import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(new URL('../source/package.json', import.meta.url))
const { chromium } = require('playwright-core')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'source', 'dist')
const token = 'a'.repeat(64)
let browser
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  const cssName = indexHtml.match(/href="\/assets\/([^"]+\.css)"/)?.[1]
  const jsName = indexHtml.match(/src="\/assets\/([^"]+\.js)"/)?.[1]
  assert.ok(cssName && jsName, 'Built asset names were not found')
  const css = fs.readFileSync(path.join(dist, 'assets', cssName), 'utf8')
  const js = fs.readFileSync(path.join(dist, 'assets', jsName), 'utf8')
  await page.setContent(`<style>${css}</style><div id="app"></div>`)
  await page.evaluate(sessionToken => {
    window.location.hash = `session=${sessionToken}`
    window.__brainanaFetchHeaders = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url
      const headers = new Headers(init.headers)
      window.__brainanaFetchHeaders.push({ url, token: headers.get('x-brainana-session') })
      if (url === '/api/config') return new Response(JSON.stringify({ enabled: true, mode: 'local', label: 'This Mac' }), { status: 200, headers: { 'content-type': 'application/json' } })
      return originalFetch(input, init)
    }
  }, token)
  await page.addScriptTag({ content: js, type: 'module' })
  await page.waitForSelector('#mri-sagittal-placeholder')
  await page.waitForSelector('#browser-compatibility')

  for (const plane of ['sagittal', 'coronal', 'axial']) {
    await assertText(page, `#mri-${plane}-placeholder`, 'No MRI selected')
    await assertText(page, `#ct-${plane}-placeholder`, 'No CT selected')
    assert.equal(await page.locator(`#mri-${plane}-window-layer`).count(), 1)
    assert.equal(await page.locator(`#ct-${plane}-window-layer`).count(), 1)
  }
  await assertText(page, '#status', 'This browser cannot initialize the required WebGL2 viewer.')
  await assertText(page, '#window-summary', 'No optimization windows defined. The full geometric overlap will be used.')

  const fetchHeaders = await page.evaluate(() => window.__brainanaFetchHeaders)
  assert.ok(fetchHeaders.some(entry => entry.url === '/api/config' && entry.token === 'a'.repeat(64)), 'Runtime API request did not include the per-launch session token')

  assert.equal(await page.locator('#mri-file').isDisabled(), true)
  assert.equal(await page.locator('#ct-file').isDisabled(), true)
  assert.equal(await page.locator('#new-pair').isDisabled(), true)

  assert.deepEqual(pageErrors, [], `Unexpected browser page errors: ${pageErrors.join('\n')}`)
  assert.equal(await page.locator('#browser-compatibility').evaluate(element => element.classList.contains('error')), true)
  await assertText(page, '#status', 'This browser cannot initialize the required WebGL2 viewer.')
  console.log('browser UI regression checks passed')
} finally {
  if (browser) await browser.close()
}

async function assertText(page, selector, expected) {
  const actual = (await page.locator(selector).textContent())?.trim()
  assert.equal(actual, expected, `${selector} text mismatch`)
}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const meta = JSON.parse(fs.readFileSync(path.join(root,'source','VERSION.json'),'utf8'))
const checks = [
  ['source/version.mjs', JSON.stringify(meta.version)],
  ['source/version.mjs', JSON.stringify(meta.buildId)],
  ['source/version.env', `VERSION=${JSON.stringify(meta.version)}`],
  ['source/version.env', `BUILD_ID=${JSON.stringify(meta.buildId)}`],
  ['source/package.json', `"version": "${meta.version}"`],
  ['source/package-lock.json', `"version": "${meta.version}"`],
  ['source/src/main.ts', `v${meta.version}`],
  ['generated/Info.plist', `<string>${meta.version}</string>`],
  ['generated/Info.plist', `<string>${meta.bundleVersion}</string>`]
]
const errors=[]
for (const [rel, needle] of checks) {
  const p=path.join(root,rel)
  if (!fs.existsSync(p) || !fs.readFileSync(p,'utf8').includes(needle)) errors.push(`${rel} missing ${needle}`)
}
const launcher=fs.readFileSync(path.join(root,'packaging','brainana-align-launcher'),'utf8')
if (/^VERSION="/m.test(launcher) || /^BUILD_ID="/m.test(launcher)) errors.push('launcher contains hard-coded identity')
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`Identity consistent: ${meta.version} (${meta.buildId})`)

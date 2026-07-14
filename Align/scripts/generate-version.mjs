import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const source = path.join(root, 'source')
const metadata = JSON.parse(fs.readFileSync(path.join(source, 'VERSION.json'), 'utf8'))
const required = ['app','version','buildId','bundleVersion','bundleIdentifier','minimumMacOS','behaviorReference','readableSourceBase']
for (const key of required) {
  if (typeof metadata[key] !== 'string' || !metadata[key].trim()) throw new Error(`VERSION.json missing ${key}`)
}
const js = `// Generated from VERSION.json. Do not edit.\nexport const VERSION=${JSON.stringify(metadata.version)}\nexport const BUILD_ID=${JSON.stringify(metadata.buildId)}\nexport const BEHAVIOR_REFERENCE=${JSON.stringify(metadata.behaviorReference)}\nexport const SOURCE_BASE=${JSON.stringify(metadata.readableSourceBase)}\n`
fs.writeFileSync(path.join(source, 'version.mjs'), js)
fs.writeFileSync(path.join(source, 'src', 'version.ts'), js)
const env = `# Generated from VERSION.json. Do not edit.\nVERSION=${JSON.stringify(metadata.version)}\nBUILD_ID=${JSON.stringify(metadata.buildId)}\n`
fs.writeFileSync(path.join(source, 'version.env'), env)
const pkgPath = path.join(source, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = metadata.version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
const lockPath = path.join(source, 'package-lock.json')
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
lock.version = metadata.version
if (lock.packages?.['']) lock.packages[''].version = metadata.version
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
const mainPath = path.join(source, 'src', 'main.ts')
let main = fs.readFileSync(mainPath, 'utf8')
main = main.replace(/Brainana Align <span>v[^<]+<\/span>/, `Brainana Align <span>v${metadata.version}</span>`)
fs.writeFileSync(mainPath, main)
const launcherTemplate = path.join(root, 'packaging', 'templates', 'brainana-align-launcher.in')
fs.copyFileSync(launcherTemplate, path.join(root, 'packaging', 'brainana-align-launcher'))
fs.chmodSync(path.join(root, 'packaging', 'brainana-align-launcher'), 0o755)
const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>CFBundleDisplayName</key>\n\t<string>${metadata.app}</string>\n\t<key>CFBundleExecutable</key>\n\t<string>brainana-align-launcher</string>\n\t<key>CFBundleIdentifier</key>\n\t<string>${metadata.bundleIdentifier}</string>\n\t<key>CFBundleName</key>\n\t<string>${metadata.app}</string>\n\t<key>CFBundlePackageType</key>\n\t<string>APPL</string>\n\t<key>CFBundleShortVersionString</key>\n\t<string>${metadata.version}</string>\n\t<key>CFBundleVersion</key>\n\t<string>${metadata.bundleVersion}</string>\n\t<key>LSMinimumSystemVersion</key>\n\t<string>${metadata.minimumMacOS}</string>\n</dict>\n</plist>\n`
fs.mkdirSync(path.join(root, 'generated'), {recursive:true})
fs.writeFileSync(path.join(root, 'generated', 'Info.plist'), plist)
fs.writeFileSync(path.join(root, 'generated', 'VERSION.json'), JSON.stringify(metadata, null, 2) + '\n')
console.log(`${metadata.version} (${metadata.buildId})`)

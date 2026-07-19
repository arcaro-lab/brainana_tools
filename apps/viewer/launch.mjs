// Viewer app entry (`npm start` / `npm run dev`). Composition root: it hands the generic,
// tool-agnostic launcher the Viewer's identity + domain manifest provider. This is the ONLY
// place the Viewer domain meets the platform — the packages/core-* stay domain-free.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '@brainana/core-launcher/launch.mjs'
import { viewerManifestProvider } from './server/manifest.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist')
const distRoot = fs.existsSync(dist) ? dist : null

launch({
  manifestProvider: viewerManifestProvider,
  appLabel: 'Brainana Viewer',
  cacheApp: 'BrainanaViewer',
  distRoot,
  preferredPort: 5173,
}).catch((error) => {
  console.error('Launcher failed:', error)
  process.exit(1)
})

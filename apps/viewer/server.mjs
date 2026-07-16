// Viewer headless server entry (`npm run server`). Composition root: hands the generic core
// server CLI the Viewer's identity + domain manifest provider.
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runServerCli } from '@brainana/core-server/main.mjs'
import { viewerManifestProvider } from './server/manifest.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist')

runServerCli({
  manifestProvider: viewerManifestProvider,
  appLabel: 'Brainana Viewer',
  cacheApp: 'BrainanaViewer',
  distRoot: fs.existsSync(dist) ? dist : null,
})

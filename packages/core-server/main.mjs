// Reusable headless server CLI shared by brainana tools. `runServerCli(options)` parses the
// generic flags and starts the core server with the app's injected manifest provider + identity.
// TOOL-AGNOSTIC: imports no domain; the app entry (apps/<tool>/server.mjs) supplies that.
// Flags:
//   --output-dir <path>   open a local source at startup (optional; server can start unbound)
//   --port <n>            port (default 5173; 0 = ephemeral)
//   --token <t>           session token (default: none → guard disabled, loopback only)
//   --dist <path>         static assets dir to serve (default: the app's distRoot, if any)
//   --cache-dir <path>    remote-file cache root (default: per-OS cache dir for cacheApp)
//   --legacy              enable legacy-compat unscoped data route for the old bundle
import path from 'node:path'
import { startServer } from './runtime.mjs'
import { versionInfo } from './version.mjs'
import { cacheDir } from './paths.mjs'

const argv = process.argv.slice(2)

function arg(name, fallback) {
  const eq = argv.find((v) => v.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const hasFlag = (name) => argv.includes(name)

// Start the headless server with the app's identity + injected domain manifest provider.
export async function runServerCli({ manifestProvider, appLabel = 'Brainana', cacheApp = 'Brainana', distRoot = null } = {}) {
  const outputDir = arg('--output-dir', process.env.BRAINANA_OUTPUT_DIR)
  const port = Number(arg('--port', process.env.PORT || 5173))
  const token = arg('--token', process.env.BRAINANA_TOKEN || null)
  const distArg = arg('--dist', null)
  const resolvedDist = distArg ? path.resolve(distArg) : distRoot
  const legacyCompat = hasFlag('--legacy') || process.env.BRAINANA_LEGACY === '1'

  const initialSources = outputDir ? [{ type: 'local', path: path.resolve(outputDir), label: path.basename(path.resolve(outputDir)) }] : []

  // Cache remote files in the same per-OS location the launcher uses, so the cache is shared
  // regardless of which entry point started the server (overridable via --cache-dir / env).
  const cacheRoot = arg('--cache-dir', process.env.BRAINANA_CACHE_DIR) || cacheDir(cacheApp)

  const { server, address } = await startServer({ token, distRoot: resolvedDist, initialSources, legacyCompat, port, cacheRoot, manifestProvider })

  console.log(`${appLabel} ${versionInfo.version} (${versionInfo.buildId})`)
  console.log(`Listening on http://127.0.0.1:${address.port}${token ? ' (token required)' : ''}`)
  if (outputDir) console.log(`Startup local source: ${path.resolve(outputDir)}`)
  if (resolvedDist) console.log(`Serving static assets from ${resolvedDist}${legacyCompat ? ' (legacy-compat route enabled)' : ''}`)
  if (!outputDir) console.log('No startup source — add sources in-app via POST /api/sources')

  const shutdown = () => server.close(() => process.exit(0))
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
  return { server, address }
}

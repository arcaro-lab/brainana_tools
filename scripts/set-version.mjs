#!/usr/bin/env node
// Single command to move the whole monorepo to a new version — the ONE place a release
// version is set. Writes the version into the root package.json and every workspace
// package.json (apps/*, packages/*), then regenerates the runtime version module
// (scripts/generate-version.mjs → packages/core-server/version.mjs, the single source read
// at runtime). Nothing reads the workspace packages' version field (all are `private`), but
// keeping them in lockstep avoids a stale 0.x lingering in a shipped package.json.
//
// Usage:
//   node scripts/set-version.mjs <version>     # e.g. 1.0.0 or 1.2.0-rc.1
//   npm run set-version 1.0.0
//
// The version is edited with a line-targeted replace (not JSON re-stringify) so the root
// package.json's "//…" documentation keys, key order, and formatting are preserved.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const version = process.argv[2]
if (!version) {
  console.error('set-version: missing <version>.\n  usage: node scripts/set-version.mjs <version>   (e.g. 1.0.0)')
  process.exit(1)
}
// Permissive semver: major.minor.patch with an optional -prerelease / +build suffix.
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/.test(version)) {
  console.error(`set-version: "${version}" is not a valid semver version (expected e.g. 1.0.0 or 1.2.0-rc.1).`)
  process.exit(1)
}

// Resolve the list of package.json files to touch: the root plus every workspace directory
// declared in the root package.json `workspaces` globs (each of the form "<dir>/*").
const rootPkgPath = path.join(root, 'package.json')
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
const targets = [rootPkgPath]
for (const pattern of rootPkg.workspaces || []) {
  if (!pattern.endsWith('/*')) continue // only "<dir>/*" globs are used in this repo
  const dir = path.join(root, pattern.slice(0, -2))
  if (!existsSync(dir)) continue
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgPath = path.join(dir, entry.name, 'package.json')
    if (existsSync(pkgPath)) targets.push(pkgPath)
  }
}

// Replace only the first top-level `"version": "…"` in each file. `version` is not used as a
// key anywhere else in these manifests, so the first match is always the package version.
const VERSION_LINE = /("version"\s*:\s*)"[^"]*"/
let changed = 0
for (const pkgPath of targets) {
  const rel = path.relative(root, pkgPath)
  const text = readFileSync(pkgPath, 'utf8')
  if (!VERSION_LINE.test(text)) {
    console.warn(`set-version: no "version" field in ${rel} — skipped`)
    continue
  }
  const before = text.match(VERSION_LINE)[0].match(/"([^"]*)"$/)[1]
  const next = text.replace(VERSION_LINE, `$1"${version}"`)
  if (next === text) {
    console.log(`  = ${rel} (already ${version})`)
    continue
  }
  writeFileSync(pkgPath, next)
  console.log(`  ✓ ${rel}: ${before} → ${version}`)
  changed++
}

// Regenerate the runtime version module from the (now-updated) root package.json.
execFileSync('node', [path.join('scripts', 'generate-version.mjs')], { cwd: root, stdio: 'inherit' })

// Refresh package-lock.json so its recorded workspace versions match package.json — otherwise
// `npm ci` (CI + the release workflow) refuses to install with a "package.json and
// package-lock.json in sync" error. `--package-lock-only` rewrites only the lockfile (no
// node_modules churn). Skip with --no-lock for a lock-less dry run.
if (changed > 0 && !process.argv.includes('--no-lock')) {
  console.log('set-version: refreshing package-lock.json (npm install --package-lock-only)…')
  execFileSync('npm', ['install', '--package-lock-only'], { cwd: root, stdio: 'inherit' })
}
console.log(`set-version: ${changed} file(s) updated to ${version}.`)

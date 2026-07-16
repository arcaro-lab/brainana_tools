#!/usr/bin/env node
// Runs every *_test.mjs in a child process and reports a per-file PASS/SKIP/FAIL summary.
// Workspace-aware: discovers tests in the root tests/ dir AND in packages/*/tests and
// apps/*/tests, so a package/app can keep its tests co-located and self-contained.
// A test file signals failure with a non-zero exit; it signals a skip (an optional dependency
// such as ssh2 is unavailable, or dist/ is not built) by exiting 0 after printing a line that
// ends with ": skipped". Skips are reported distinctly so they can never masquerade as passes.
import { spawnSync } from 'node:child_process'
import { readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Collect *_test.mjs files directly under a given directory (non-recursive).
function testsIn(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('_test.mjs'))
    .map((e) => path.join(dir, e.name))
}

// Every workspace group that may hold a tests/ dir, plus the root tests/ dir.
function workspaceTestDirs() {
  const dirs = [path.join(root, 'tests')]
  for (const group of ['packages', 'apps']) {
    const base = path.join(root, group)
    if (!existsSync(base)) continue
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (e.isDirectory()) dirs.push(path.join(base, e.name, 'tests'))
    }
  }
  return dirs
}

const tests = workspaceTestDirs()
  .flatMap(testsIn)
  .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

if (tests.length === 0) {
  console.error('No *_test.mjs files found in tests/, packages/*/tests, or apps/*/tests')
  process.exit(1)
}

const SKIP_RE = /:\s*skipped\s*$/m

let failed = 0
let skipped = 0
for (const test of tests) {
  const label = path.relative(root, test)
  console.log(`\n=== ${label} ===`)
  // Capture stdout so we can classify skip vs pass, then echo it through unchanged.
  const result = spawnSync(process.execPath, [test], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit'],
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.status !== 0) {
    failed += 1
    console.log(`  --> FAIL (exit ${result.status})`)
  } else if (SKIP_RE.test(result.stdout || '')) {
    skipped += 1
    console.log('  --> SKIP')
  } else {
    console.log('  --> PASS')
  }
}

const passed = tests.length - failed - skipped
console.log(`\n${passed} passed, ${skipped} skipped, ${failed} failed (of ${tests.length} test file(s))`)
process.exit(failed ? 1 : 0)

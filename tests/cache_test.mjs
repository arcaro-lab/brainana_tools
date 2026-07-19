// Unit tests for core-server/cache.mjs RemoteFileCache: validates by size+mtime, refetches on
// mismatch, rejects incomplete transfers, and namespaces cache paths so two sources never
// collide. The remote fetch is an injected async writer, so no network/SFTP is needed — the
// whole SFTP stack's cache logic is verified even when ssh2 is absent.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { RemoteFileCache } from '@brainana/core-server/cache.mjs'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

// Build a fetchToTemp that writes fixed bytes and counts how often it runs.
function fetcher(bytes) {
  const counter = { calls: 0 }
  const fetchToTemp = async (temp) => {
    counter.calls++
    await fsp.writeFile(temp, bytes)
  }
  return { fetchToTemp, counter }
}

async function main() {
  const cacheRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'brainana-rfc-'))
  try {
    const cache = new RemoteFileCache({ cacheRoot, namespace: 'host-a' })
    const payload = Buffer.from('REMOTE-CONTENT')
    const info = { size: payload.length, mtimeMs: 1_000_000 }

    // First ensure fetches; second ensure with identical stat is served from cache.
    const f1 = fetcher(payload)
    const p1 = await cache.ensure('sub-1/anat/x.nii.gz', info, f1.fetchToTemp)
    assert.equal(fs.readFileSync(p1, 'utf8'), 'REMOTE-CONTENT', 'fetched content is cached')
    assert.equal(f1.counter.calls, 1, 'first ensure fetches')

    const f1b = fetcher(payload)
    await cache.ensure('sub-1/anat/x.nii.gz', info, f1b.fetchToTemp)
    assert.equal(f1b.counter.calls, 0, 'valid cache is NOT refetched')
    ok('RemoteFileCache serves a valid cache without refetching')

    // A changed mtime (or size) invalidates the cache and triggers a refetch.
    const f2 = fetcher(payload)
    await cache.ensure('sub-1/anat/x.nii.gz', { size: payload.length, mtimeMs: 2_000_000 }, f2.fetchToTemp)
    assert.equal(f2.counter.calls, 1, 'mtime mismatch refetches')
    ok('RemoteFileCache refetches when size/mtime changes')

    // A fetch that writes the wrong number of bytes must be rejected (no partial served).
    const short = { fetchToTemp: async (temp) => fsp.writeFile(temp, Buffer.from('TOO-SHORT')) }
    await assert.rejects(
      cache.ensure('sub-2/y.nii', { size: 999, mtimeMs: 1 }, short.fetchToTemp),
      /transfer incomplete/,
      'incomplete transfer throws',
    )
    ok('RemoteFileCache rejects an incomplete transfer')

    // Same relative path under a different namespace resolves to a distinct cache file.
    const cacheB = new RemoteFileCache({ cacheRoot, namespace: 'host-b' })
    assert.notEqual(cache.cachePath('sub-1/anat/x.nii.gz'), cacheB.cachePath('sub-1/anat/x.nii.gz'), 'namespaces do not collide')
    ok('RemoteFileCache namespaces the cache path so sources never collide')
  } finally {
    await fsp.rm(cacheRoot, { recursive: true, force: true })
  }

  console.log(`cache_test: ${passed} checks passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

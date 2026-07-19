// Unit tests for core-server/export.mjs writeStreamAtomic: streams to a temp file then renames
// into place, refuses to clobber when overwrite=false, and never leaves a temp file behind.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { writeStreamAtomic } from '@brainana/core-server/export.mjs'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

const tempsIn = (dir) => fs.readdirSync(dir).filter((n) => n.includes('brainana-partial-'))

async function main() {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'brainana-export-'))
  try {
    // Fresh write into a not-yet-existing nested dir.
    const dest = path.join(dir, 'nested', 'out.txt')
    const res = await writeStreamAtomic(Readable.from(['hello ', 'world']), dest, false)
    assert.equal(res.exists, false, 'reports a fresh write')
    assert.equal(res.bytes, 11, 'reports bytes written')
    assert.equal(fs.readFileSync(dest, 'utf8'), 'hello world', 'content landed atomically')
    assert.deepEqual(tempsIn(path.dirname(dest)), [], 'no temp file left behind')
    ok('writeStreamAtomic writes a new file and cleans up its temp')

    // No-clobber: an existing destination is preserved and the stream is not written.
    const again = await writeStreamAtomic(Readable.from(['SHOULD NOT LAND']), dest, false)
    assert.equal(again.exists, true, 'refuses to overwrite when overwrite=false')
    assert.equal(fs.readFileSync(dest, 'utf8'), 'hello world', 'original content untouched')
    assert.deepEqual(tempsIn(path.dirname(dest)), [], 'no temp file left behind after skipped clobber')
    ok('writeStreamAtomic refuses to clobber and leaves no temp')

    // overwrite=true replaces the file.
    const over = await writeStreamAtomic(Readable.from(['new']), dest, true)
    assert.equal(over.exists, false, 'overwrite path performs the write')
    assert.equal(fs.readFileSync(dest, 'utf8'), 'new', 'file was overwritten')
    ok('writeStreamAtomic overwrites when allowed')

    // A source stream that errors mid-write must not leave a temp file (or the destination).
    const boom = new Readable({ read() { this.destroy(new Error('boom')) } })
    const target = path.join(dir, 'fails.txt')
    await assert.rejects(writeStreamAtomic(boom, target, false), /boom/, 'stream error propagates')
    assert.equal(fs.existsSync(target), false, 'no destination on error')
    assert.deepEqual(tempsIn(dir), [], 'temp cleaned up after a mid-stream error')
    ok('writeStreamAtomic cleans up the temp when the source stream errors')
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }

  console.log(`export_test: ${passed} checks passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

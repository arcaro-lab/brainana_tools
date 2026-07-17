// Unit test for readSshHosts(): parse ~/.ssh/config into the recall-dropdown host list.
// Points HOME at a temp dir (os.homedir() honours $HOME on this platform) so the parser reads a
// controlled fixture. Runs in a child process (see scripts/run-tests.mjs), so mutating HOME is safe.
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { readSshHosts } from '@brainana/core-server/runtime.mjs'

let passed = 0
const ok = (name) => {
  passed++
  console.log(`  ok - ${name}`)
}

const originalHome = process.env.HOME
async function withHome(configText, fn) {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'brainana-ssh-'))
  try {
    if (configText !== null) {
      await fsp.mkdir(path.join(home, '.ssh'), { recursive: true })
      await fsp.writeFile(path.join(home, '.ssh', 'config'), configText)
    }
    process.env.HOME = home
    return fn()
  } finally {
    process.env.HOME = originalHome
    await fsp.rm(home, { recursive: true, force: true })
  }
}

async function main() {
  // 1. A normal block: alias + HostName + User + Port.
  await withHome(
    ['Host monkey1', '  HostName 10.0.0.7', '  User arcaro', '  Port 2222'].join('\n'),
    () => {
      const hosts = readSshHosts()
      assert.deepEqual(hosts, [{ host: 'monkey1', hostName: '10.0.0.7', user: 'arcaro', port: 2222 }])
      ok('parses a normal Host block')
    },
  )

  // 2. `=`-separated keywords and mixed casing are accepted.
  await withHome(['HOST=box', 'HostName=example.org', 'user = me'].join('\n'), () => {
    const hosts = readSshHosts()
    assert.deepEqual(hosts, [{ host: 'box', hostName: 'example.org', user: 'me' }])
    ok('accepts = separators and case-insensitive keywords')
  })

  // 3. Wildcard/pattern hosts are skipped; comments and blanks ignored; the first concrete pattern wins.
  await withHome(
    ['# a comment', 'Host *', '  User default', '', 'Host prod-?', '  HostName nope', 'Host alias real-host', '  HostName 1.2.3.4'].join('\n'),
    () => {
      const hosts = readSshHosts()
      assert.deepEqual(hosts, [{ host: 'alias', hostName: '1.2.3.4' }])
      ok('skips wildcard hosts and takes the first concrete pattern')
    },
  )

  // 4. No config file → empty list (best-effort).
  await withHome(null, () => {
    assert.deepEqual(readSshHosts(), [])
    ok('returns [] when ~/.ssh/config is absent')
  })

  console.log(`\nssh-config: ${passed} assertions passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

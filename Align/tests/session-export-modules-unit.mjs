import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = name => fs.readFileSync(path.join(root, 'source', 'src', name), 'utf8')
const sessions = read('sessionPersistence.ts')
const exports = read('exportArtifacts.ts')
const main = read('main.ts')
assert.match(sessions, /SESSION_SCHEMA_VERSION = 1/)
assert.match(sessions, /payload\.savedAt \?\? payload\.saved_at/)
assert.match(sessions, /payload\.appVersion \?\? payload\.version/)
assert.match(sessions, /schemaVersion > SESSION_SCHEMA_VERSION/)
assert.match(sessions, /geometryDifference/)
assert.match(exports, /createRegistrationArtifacts/)
assert.match(exports, /saveArtifacts/)
assert.match(exports, /await saveArtifact/)
assert.match(main, /createSessionPayload/)
assert.match(main, /parseSessionPayload/)
assert.match(main, /sessionGeometryMismatches/)
assert.match(main, /createRegistrationArtifacts/)
assert.doesNotMatch(main, /version:'0\.7\.0'/)
assert.doesNotMatch(main, /saved_at:/)
console.log('session schema, migration, and export artifact checks passed')

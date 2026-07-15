import assert from 'node:assert/strict'
import { getRemoteEndpoint, onRemoteEndpointChange, setRemoteEndpoint } from '../source/src/remoteEndpoint.ts'

const observed: Array<string | null> = []
const unsubscribe = onRemoteEndpointChange(value => observed.push(value?.initialPath ?? null))
const endpoint = { baseUrl: 'http://127.0.0.1:45678', sessionToken: 'a'.repeat(64), initialPath: '/data/study' }

setRemoteEndpoint(endpoint)
assert.deepEqual(getRemoteEndpoint(), endpoint)
setRemoteEndpoint(null)
assert.equal(getRemoteEndpoint(), null)
assert.deepEqual(observed, ['/data/study', null])
unsubscribe()
setRemoteEndpoint(endpoint)
assert.deepEqual(observed, ['/data/study', null])
setRemoteEndpoint(null)

console.log('remote endpoint state notifications passed')

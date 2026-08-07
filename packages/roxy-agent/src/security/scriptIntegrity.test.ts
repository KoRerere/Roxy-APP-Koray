import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { it } from 'vitest'
import { assertSha512, sha512Hex } from './scriptIntegrity'

it('accepts script bytes that match the expected SHA-512', () => {
  const data = Buffer.from('export async function main() {}\n')
  assert.doesNotThrow(() => assertSha512(data, sha512Hex(data)))
})

it('rejects script bytes that do not match the expected SHA-512', () => {
  const expected = sha512Hex(Buffer.from('export async function main() {}\n'))
  assert.throws(
    () => assertSha512(Buffer.from('export async function main() { throw new Error() }\n'), expected),
    /SHA-512 mismatch/,
  )
})

it('rejects malformed expected digests', () => {
  assert.throws(() => assertSha512(Buffer.from('script'), 'invalid'), /invalid expected SHA-512/)
})

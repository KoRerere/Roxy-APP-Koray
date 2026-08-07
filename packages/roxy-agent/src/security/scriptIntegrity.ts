import { Buffer } from 'node:buffer'
import { createHash, timingSafeEqual } from 'node:crypto'

const SHA512_HEX_PATTERN = /^[a-f0-9]{128}$/

export function sha512Hex(data: Uint8Array): string {
  return createHash('sha512').update(data).digest('hex')
}

export function assertSha512(data: Uint8Array, expected: string): void {
  const normalized = expected.trim().toLowerCase()
  if (!SHA512_HEX_PATTERN.test(normalized)) {
    throw new Error('Script integrity check failed: invalid expected SHA-512')
  }

  const actualBytes = Buffer.from(sha512Hex(data), 'hex')
  const expectedBytes = Buffer.from(normalized, 'hex')
  if (!timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error('Script integrity check failed: SHA-512 mismatch')
  }
}

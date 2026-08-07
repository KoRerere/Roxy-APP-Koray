import assert from 'node:assert/strict'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'vitest'
import {
  assertFetchAllowed,
  readScriptPermissions,
} from './scriptPermissions'

let tempDir: string

beforeEach(async () => {
  tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-script-permissions-'))
})

afterEach(async () => {
  await fsPromises.rm(tempDir, { recursive: true, force: true })
})

it('uses the built-in platform allowlist when the manifest does not exist', async () => {
  const policy = await readScriptPermissions(path.join(tempDir, 'missing.permissions.json'))

  assert.deepEqual(policy.fs.read, [])
  assert.doesNotThrow(() => assertFetchAllowed('https://www.youtube.com/watch?v=test', policy))
  assert.doesNotThrow(() => assertFetchAllowed('https://sellercentral.amazon.com/home', policy))
  assert.throws(() => assertFetchAllowed('https://api.example.com/data', policy), /Permission denied/)
})

it('preserves fs read flags and allows only matching fetch hostnames', async () => {
  const manifest = path.join(tempDir, 'script.permissions.json')
  await fsPromises.writeFile(manifest, JSON.stringify({
    version: 1,
    fs: { read: [` ${path.join(tempDir, 'imports')} `] },
    fetch: { allow: ['api.example.com', '*.googleapis.com'] },
  }))

  const policy = await readScriptPermissions(manifest)

  assert.deepEqual(policy.fs.read, [path.join(tempDir, 'imports')])
  assert.doesNotThrow(() => assertFetchAllowed('https://api.example.com/data', policy))
  assert.doesNotThrow(() => assertFetchAllowed('https://sheets.googleapis.com/v4', policy))
  assert.throws(() => assertFetchAllowed('https://googleapis.com/v4', policy), /Permission denied/)
  assert.throws(() => assertFetchAllowed('file:///tmp/data.csv', policy), /Permission denied/)
})

it('rejects malformed permission manifests instead of widening access', async () => {
  const manifest = path.join(tempDir, 'script.permissions.json')
  await fsPromises.writeFile(manifest, JSON.stringify({ version: 2, fs: { read: '*' } }))

  await assert.rejects(() => readScriptPermissions(manifest), /Invalid script permissions/)
})

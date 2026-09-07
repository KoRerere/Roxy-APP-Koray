import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { it } from 'vitest'
import {
  buildCodexBootstrapConfig,
  writeCodexBootstrapConfig,
} from './codexBootstrapConfig'

it('builds the config consumed by the Codex plugin wrapper', () => {
  const config = buildCodexBootstrapConfig({
    apiKey: ' api-key ',
    workspaceId: 19744,
    apiHost: 'http://127.0.0.1:50000',
  })

  assert.deepEqual(config, {
    apiKey: 'api-key',
    workspaceId: '19744',
    apiHost: 'http://127.0.0.1:50000',
    timeout: '30000',
  })
})

it('skips writing when required plugin data is missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'roxy-codex-bootstrap-'))
  const configPath = path.join(dir, 'state', 'codex-oauth.json')

  try {
    const written = await writeCodexBootstrapConfig({
      apiKey: 'api-key',
      workspaceId: undefined,
      apiHost: 'http://127.0.0.1:50000',
    }, { configPath })

    assert.equal(written, false)
    await assert.rejects(readFile(configPath, 'utf8'), /ENOENT/)
  }
  finally {
    await rm(dir, { force: true, recursive: true })
  }
})

it('writes the config atomically with current-user-only file permissions', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'roxy-codex-bootstrap-'))
  const configPath = path.join(dir, 'state', 'codex-oauth.json')

  try {
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(configPath, '{"apiKey":"old"}', { mode: 0o644 })

    const written = await writeCodexBootstrapConfig({
      apiKey: 'api-key',
      workspaceId: '19744',
      apiHost: 'http://127.0.0.1:50001',
      timeout: 45000,
    }, { configPath })

    assert.equal(written, true)
    assert.deepEqual(JSON.parse(await readFile(configPath, 'utf8')), {
      apiKey: 'api-key',
      workspaceId: '19744',
      apiHost: 'http://127.0.0.1:50001',
      timeout: '45000',
    })
    assert.equal((await stat(configPath)).mode & 0o777, 0o600)
  }
  finally {
    await rm(dir, { force: true, recursive: true })
  }
})

import type { Server } from 'node:http'
import express from 'express'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteInstalledSkillBySlug: vi.fn(),
}))

vi.mock('@/core/skillManager', () => ({
  getSkillManager: () => mocks,
}))

let server: Server | undefined
let baseUrl = ''

beforeEach(async () => {
  vi.clearAllMocks()
  const { default: skillRoutes } = await import('./skillRoutes')
  const app = express()
  app.use(express.json())
  app.use('/api/skills', skillRoutes)
  await new Promise<void>((resolve, reject) => {
    const listeningServer = app.listen(0, '127.0.0.1')
    server = listeningServer
    listeningServer.once('listening', () => {
      const address = listeningServer.address()
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate test server port'))
        return
      }
      baseUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
    listeningServer.once('error', reject)
  })
})

afterEach(async () => {
  if (!server?.listening) {
    server = undefined
    return
  }
  await new Promise<void>((resolve, reject) => {
    server!.close(error => error ? reject(error) : resolve())
  })
  server = undefined
})

describe('skill routes', () => {
  it('deletes an installed Skill by validated slug and remains idempotent', async () => {
    // Regression: deleting a user Skill template had no Agent endpoint for removing
    // its installed package.
    // Fixed by: exposing a slug-scoped delete route backed by SkillManager.
    mocks.deleteInstalledSkillBySlug.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    let response = await fetch(`${baseUrl}/api/skills/installed/research-skill`, { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { code: 0, data: { deleted: true } })

    response = await fetch(`${baseUrl}/api/skills/installed/research-skill`, { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { code: 0, data: { deleted: false } })
    assert.deepEqual(mocks.deleteInstalledSkillBySlug.mock.calls, [
      ['research-skill'],
      ['research-skill'],
    ])
  })

  it('accepts slash-containing slugs through the wildcard route and normalizes them safely', async () => {
    // Regression: a slash in the slug would have been split into multiple path params
    // or rejected before it reached the installed Skill delete boundary.
    // Fixed by: capturing the full wildcard, normalizing it, and deleting by the
    // canonical installed directory slug.
    mocks.deleteInstalledSkillBySlug.mockResolvedValueOnce(true)

    const response = await fetch(`${baseUrl}/api/skills/installed/research%2Fskill`, { method: 'DELETE' })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { code: 0, data: { deleted: true } })
    assert.deepEqual(mocks.deleteInstalledSkillBySlug.mock.calls[0], ['research/skill'])
  })

  it('rejects slugs that could escape the installed Skills root', async () => {
    const response = await fetch(`${baseUrl}/api/skills/installed/%2E%2E%2Fuser`, { method: 'DELETE' })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { code: 1, msg: 'Invalid installed Skill slug' })
    assert.equal(mocks.deleteInstalledSkillBySlug.mock.calls.length, 0)
  })
})

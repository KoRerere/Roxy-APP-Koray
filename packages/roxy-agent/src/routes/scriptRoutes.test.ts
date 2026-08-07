import type { Server } from 'node:http'
import express from 'express'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'vitest'

let server: Server | undefined
let baseUrl = ''

beforeEach(async () => {
  const { default: scriptRoutes } = await import('./scriptRoutes')
  const app = express()
  app.use(express.json())
  app.use('/api/scripts', scriptRoutes)
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

describe('pOST /api/scripts/self-description', () => {
  it('returns statically parsed metadata and params schema', async () => {
    const response = await fetch(`${baseUrl}/api/scripts/self-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `
          defineMetadata({ name: 'API script', description: 'Parsed by agent' })
          defineParams({ type: 'object', properties: { query: { type: 'string' } } })
          export async function main(options: { query: string }) {}
        `,
      }),
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      code: 0,
      data: {
        metadata: { name: 'API script', description: 'Parsed by agent' },
        paramsSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
        },
      },
    })
  })

  it('rejects an empty source', async () => {
    const response = await fetch(`${baseUrl}/api/scripts/self-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '' }),
    })

    assert.deepEqual(await response.json(), { code: 1, msg: 'code is required' })
  })

  it('returns a parser error for an invalid script', async () => {
    const response = await fetch(`${baseUrl}/api/scripts/self-description`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'export function main( {' }),
    })
    const payload = await response.json() as { code: number, msg: string }

    assert.equal(payload.code, 1)
    assert.match(payload.msg, /脚本语法解析失败/)
  })
})

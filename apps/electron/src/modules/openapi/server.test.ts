import type { Server } from 'node:http'
import express from 'express'
import { afterEach, describe, expect, it } from 'vitest'
import { listenOnPort } from './server'

describe('listenOnPort', () => {
  let occupiedServer: Server | undefined

  afterEach(async () => {
    if (!occupiedServer) {
      return
    }

    await new Promise<void>(resolve => occupiedServer!.close(() => resolve()))
    occupiedServer = undefined
  })

  it('does not fall back to another port when the configured port is occupied', async () => {
    // Regression: OpenAPI used to silently move to port +1 (or another free port),
    // leaving the user's configured endpoint unavailable to existing integrations.
    // Fixed by: listenOnPort binds only the requested port and propagates EADDRINUSE.
    const holder = express().listen(0, '0.0.0.0')
    occupiedServer = holder
    await new Promise<void>(resolve => holder.once('listening', resolve))
    const address = holder.address()
    const port = typeof address === 'object' && address ? address.port : 0

    await expect(listenOnPort(express(), port)).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })
})

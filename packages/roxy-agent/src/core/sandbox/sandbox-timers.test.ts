import assert from 'node:assert/strict'
import { it } from 'vitest'
import { createSandboxTimers } from './sandbox-timers'

it('disposes timers owned by one sandbox session', async () => {
  let active = true
  let calls = 0
  const timers = createSandboxTimers(() => active, () => {})
  timers.setInterval(() => calls++, 5)
  timers.setTimeout(() => calls++, 5)
  timers.dispose()
  active = false
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(calls, 0)
})

it('routes timer callback failures to the owning session', async () => {
  const errors: unknown[] = []
  const timers = createSandboxTimers(() => true, error => errors.push(error))
  timers.setTimeout(() => {
    throw new Error('timer failed')
  }, 0)
  await new Promise(resolve => setTimeout(resolve, 10))
  timers.dispose()
  assert.equal((errors[0] as Error).message, 'timer failed')
})

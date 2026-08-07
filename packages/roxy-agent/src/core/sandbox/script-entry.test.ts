import assert from 'node:assert/strict'
import { it } from 'vitest'
import { executeSandboxScriptEntry } from './script-entry'

it('awaits an exported main function that returns void', async () => {
  let receivedOptions: unknown

  const result = await executeSandboxScriptEntry({
    async main(options: unknown) {
      receivedOptions = options
    },
  }, { query: 'shoes' })

  assert.equal(result, undefined)
  assert.deepEqual(receivedOptions, { query: 'shoes' })
})

it('returns the string produced by the exported main function', async () => {
  const result = await executeSandboxScriptEntry({
    async main() {
      return 'LoginRequired'
    },
  }, {})

  assert.equal(result, 'LoginRequired')
})

it('propagates an exported main rejection', async () => {
  const error = new Error('LLM request failed')

  await assert.rejects(
    executeSandboxScriptEntry({
      async main() {
        throw error
      },
    }, {}),
    error,
  )
})

it('rejects a main function that returns an unsupported value', async () => {
  await assert.rejects(
    executeSandboxScriptEntry({ main: () => 42 }, {}),
    /must return a string or undefined/i,
  )
})

it('rejects a script without a supported entry point', async () => {
  await assert.rejects(
    executeSandboxScriptEntry({}, {}),
    /no exported main\(\) function/i,
  )
})

import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import { describe, it } from 'node:test'
import {
  buildAgentBackendAuthorization,
  readAgentApiKey,
} from './agent-backend-auth'

describe('Agent backend authentication', () => {
  it('reads the API Key returned for the current workspace', () => {
    assert.equal(readAgentApiKey({
      code: 0,
      data: { apiKey: ' team-api-key ' },
    }, 'failed'), 'team-api-key')
  })

  it('builds the same apiKey:token credential used by Agent', () => {
    assert.equal(
      buildAgentBackendAuthorization(' team-api-key ', ' member-token '),
      'Bearer team-api-key:member-token',
    )
  })

  it('does not fall back to token-only authentication when the API Key is missing', () => {
    assert.throws(
      () => buildAgentBackendAuthorization('', 'member-token'),
      /Agent API Key is unavailable/,
    )
  })

  it('preserves the backend error when loading the API Key fails', () => {
    assert.throws(
      () => readAgentApiKey({ code: 1, msg: 'API Key unavailable for workspace' }, 'failed'),
      /API Key unavailable for workspace/,
    )
  })
})

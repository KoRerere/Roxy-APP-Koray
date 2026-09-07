import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAgentPaths } from './agent-paths'

describe('agent paths', () => {
  it('exposes the Codex bootstrap config path under state', () => {
    const paths = createAgentPaths('/tmp/roxy-agent-test')

    expect(paths.codexOauthConfigFile).toBe(path.join('/tmp/roxy-agent-test', 'state', 'codex-oauth.json'))
  })
})

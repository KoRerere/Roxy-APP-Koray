import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zodToJsonSchema } from 'roxy-agent-runtime'
import { it } from 'vitest'

it('createPlaywrightClientForWorker starts playwright MCP in memory', async () => {
  const agentHome = mkdtempSync(join(tmpdir(), 'roxy-agent-home-test-'))
  const originalAgentHome = process.env.ROXY_AGENT_HOME
  const originalApiHost = process.env.ROXY_API_HOST
  const originalApiKey = process.env.ROXY_API_KEY
  const originalWorkspaceId = process.env.ROXY_WORKSPACE_ID

  process.env.ROXY_AGENT_HOME = agentHome
  process.env.ROXY_API_HOST = 'http://127.0.0.1:59999'
  process.env.ROXY_API_KEY = 'api-key'
  process.env.ROXY_WORKSPACE_ID = '42'
  const { McpManager, mcpManager } = await import('./mcpManager')

  try {
    const manager = new McpManager()

    assert.deepEqual((manager as any)._buildConnection('remote-http', { url: 'https://example.com/mcp' }), {
      name: 'remote-http',
      transport: 'http',
      url: 'https://example.com/mcp',
    })
    assert.throws(
      () => (manager as any)._buildConnection('legacy-sse', { type: 'sse', url: 'https://example.com/sse' }),
      /Unknown transport type "sse"/,
    )

    await manager.createProfileBinding({
      bindingId: 'worker-1',
      executionId: 'run-1',
      conversationId: 'session-1',
      allowedDirIds: ['allowed-dir'],
    })
    assert.equal(manager.playwright.getArtifactDir('worker-1'), undefined)
    const playwrightOnly = await manager.getPlaywrightToolsForBinding('worker-1')
    assert.ok(playwrightOnly.some(tool => tool.descriptor.name === 'mcp_roxybrowser_playwright_worker-1__browser_snapshot'))
    assert.ok(playwrightOnly.some(tool => tool.descriptor.name === 'mcp_roxybrowser_playwright_worker-1__roxy_browser_connect'))
    const visible = await manager.getToolsForBinding('worker-1', true)
    assert.ok(visible.some(tool => tool.descriptor.name === 'mcp_roxybrowser_playwright_worker-1__roxy_browser_connect'))
    assert.ok(visible.some(tool => tool.descriptor.name.startsWith('mcp_roxybrowser-openapi-mcp__')))
    for (const tool of visible) {
      const schema = zodToJsonSchema(tool.descriptor.inputSchema)
      assert.equal(schema.type, 'object', `${tool.descriptor.name} must expose an object input schema`)
    }

    // 窗口作用域：绑定窗口后越界 dirId 必须被拒绝
    assert.deepEqual(manager.getWorkerAllowedDirIds('worker-1'), ['allowed-dir'])
    const launchTool = visible.find(tool => tool.descriptor.name === 'mcp_roxybrowser_playwright_worker-1__roxy_browser_launch')!
    assert.match(launchTool.descriptor.description, /authorized profile window/)
    const rejected = await launchTool.handler({ dirId: 'other-account-dir' }, {
      agentId: 'test',
      traceId: 'test',
      toolUseId: 'test',
      signal: new AbortController().signal,
    })
    assert.match(rejected.content, /不在本次任务授权的窗口范围内/)

    await manager.releaseProfileBinding('worker-1')
    await manager.releaseExecution('run-1')
    assert.equal(manager.count, 0)
  }
  finally {
    await mcpManager.shutdown()
    if (originalAgentHome === undefined) {
      delete process.env.ROXY_AGENT_HOME
    }
    else {
      process.env.ROXY_AGENT_HOME = originalAgentHome
    }
    if (originalApiHost === undefined) {
      delete process.env.ROXY_API_HOST
    }
    else {
      process.env.ROXY_API_HOST = originalApiHost
    }
    if (originalApiKey === undefined) {
      delete process.env.ROXY_API_KEY
    }
    else {
      process.env.ROXY_API_KEY = originalApiKey
    }
    if (originalWorkspaceId === undefined) {
      delete process.env.ROXY_WORKSPACE_ID
    }
    else {
      process.env.ROXY_WORKSPACE_ID = originalWorkspaceId
    }
    rmSync(agentHome, { recursive: true, force: true })
  }
})

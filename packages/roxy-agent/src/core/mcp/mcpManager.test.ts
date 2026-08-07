import type { StructuredTool } from '@langchain/core/tools'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
      transport: 'http',
      url: 'https://example.com/mcp',
    })
    assert.throws(
      () => (manager as any)._buildConnection('legacy-sse', { type: 'sse', url: 'https://example.com/sse' }),
      /Unknown transport type "sse"/,
    )

    await manager.createPlaywrightClientForWorker('worker-1', 'session-1')
    const tools = (manager as any).workerPlaywrightTools.get('worker-1') as StructuredTool[]

    assert.ok(tools.some(tool => tool.name === 'browser_snapshot'))
    assert.ok(tools.some(tool => tool.name === 'roxy_browser_launch'))
    // 低层 open/connect 工具不应暴露给模型；统一走 roxy_browser_launch。
    const visible = await manager.getToolsForWorker('worker-1', true)
    assert.ok(!visible.some(tool => tool.name === 'roxy_open_browsers'))
    assert.ok(!visible.some(tool => tool.name === 'roxy_browser_open'))
    assert.ok(!visible.some(tool => tool.name === 'roxy_browser_connect'))

    // 窗口作用域：绑定窗口后越界 dirId 必须被拒绝
    manager.setWorkerAllowedDirIds('worker-1', ['allowed-dir'])
    assert.deepEqual(manager.getWorkerAllowedDirIds('worker-1'), ['allowed-dir'])
    const launchTool = visible.find(tool => tool.name === 'roxy_browser_launch')!
    const rejected = await launchTool.invoke({ dirId: 'other-account-dir' } as any)
    assert.match(String(rejected), /不在本次任务授权的窗口范围内/)

    await manager.destroyPlaywrightClientForWorker('worker-1')
    assert.equal(manager.count, 0)
  }
  finally {
    await mcpManager.shutdown()
    if (originalAgentHome === undefined)
      delete process.env.ROXY_AGENT_HOME
    else
      process.env.ROXY_AGENT_HOME = originalAgentHome
    if (originalApiHost === undefined)
      delete process.env.ROXY_API_HOST
    else
      process.env.ROXY_API_HOST = originalApiHost
    if (originalApiKey === undefined)
      delete process.env.ROXY_API_KEY
    else
      process.env.ROXY_API_KEY = originalApiKey
    if (originalWorkspaceId === undefined)
      delete process.env.ROXY_WORKSPACE_ID
    else
      process.env.ROXY_WORKSPACE_ID = originalWorkspaceId
    rmSync(agentHome, { recursive: true, force: true })
  }
})

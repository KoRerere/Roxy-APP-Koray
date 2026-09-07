import type { RuntimeMcpTool } from '@/core/mcp/runtimeMcpTool'
import type { Agent, AgentDefinition, IAgentManager, ISessionStore, ToolContext, ToolDefinition } from 'roxy-agent-runtime'
import { NullClarificationHandler, registerBuiltinTools, ToolRegistry } from 'roxy-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { withWindowScopeGuard } from '@/core/profiles/profileScheduler'
import { createRuntimeFileCollector } from '../file-collector'
import { registerRuntimeScriptTools } from '../tools'
import { createGeneralPurposeAgent, generalPurposeAgentResourceKey } from './general-purpose-subagent'

function fakeManager(): IAgentManager {
  return {
    registerRoot: () => {},
    spawn: async request => ({
      path: `${request.parentPath}/${request.name}`,
      name: request.name,
      agentType: request.agentType,
      status: 'starting',
    }),
    list: () => [],
    wait: async () => ({ timedOut: false, agents: [], runningPaths: [] }),
    cancelSubtree: () => {},
    dispose: async () => {},
  }
}

function fakeAgent(): Agent {
  return {
    id: 'general-purpose-child',
    sessionId: 'general-purpose-child-session',
    invoke: async () => ({ messages: [{ role: 'assistant', content: 'done' }], trajectory: [] }),
    async* stream() {},
    structured: <T>() => ({
      invoke: async () => {
        throw new Error('structured output is not used in this test')
      },
    }) as { invoke: () => Promise<T> },
    resume: () => {},
    clarify: () => {},
    cancelPending: () => {},
    dispose: async () => {},
  }
}

function createParentTools(extraTools: ToolDefinition[] = []): ToolRegistry {
  const registry = new ToolRegistry()
  for (const tool of registerBuiltinTools({
    enableTodos: true,
    clarificationHandler: new NullClarificationHandler(),
    customToolNames: ['apply_patch'],
  })) {
    registry.add(tool.descriptor, tool.handler)
  }
  registerRuntimeScriptTools(registry, { workspaceDir: '/tmp/roxy-root-agent' })
  for (const tool of extraTools) {
    registry.add(tool.descriptor, tool.handler)
  }
  for (const name of ['spawn_agent', 'list_agents', 'wait_agent']) {
    registry.add({
      name,
      description: name,
      inputSchema: z.object({}),
      source: 'builtin',
    }, async () => ({ content: name, isError: false }))
  }
  return registry
}

const toolContext: ToolContext = {
  agentId: 'child',
  traceId: 'trace',
  toolUseId: 'tool-use',
  signal: new AbortController().signal,
}

const agentMessage = 'Open the selected profiles and inspect the page.'

describe('general-purpose agent', () => {
  it('passes the host session store and shared execution lease to the child runtime', async () => {
    const sessionStore = {
      append: vi.fn(async () => {}),
      read: vi.fn(async () => []),
      list: vi.fn(async () => []),
      meta: vi.fn(async () => null),
    } satisfies ISessionStore
    const createProfileBinding = vi.fn(async () => {})
    const releaseProfileBinding = vi.fn()
    let definition: AgentDefinition | undefined

    const child = await createGeneralPurposeAgent({
      agentPath: '/root/worker',
      manager: fakeManager(),
      message: agentMessage,
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'deepseek-v4-flash',
      apiKey: 'token',
      parentTools: createParentTools(),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      sessionStore,
      mcp: {
        createProfileBinding,
        getPlaywrightToolsForBinding: vi.fn(async () => []),
        releaseProfileBinding,
      },
      runtimeFactory: vi.fn(async (input: AgentDefinition) => {
        definition = input
        return fakeAgent()
      }),
    })

    expect(createProfileBinding).toHaveBeenCalledWith(expect.objectContaining({
      bindingId: child.resourceKey,
      executionId: 'run-1',
      conversationId: 'conversation-1',
      allowedDirIds: [],
    }))
    expect(definition?.sessionStore).toBe(sessionStore)
    expect(definition?.sessionId).toMatch(new RegExp(`^${child.resourceKey}_[a-f0-9]{16}$`))

    await child.dispose()
    expect(releaseProfileBinding).toHaveBeenCalledWith(child.resourceKey)
  })

  it('passes the current Skill manifest snapshot to the child runtime', async () => {
    let definition: AgentDefinition | undefined
    const skills = [{
      name: 'browser-research',
      description: 'Research using browser automation.',
      sourcePath: '/tmp/roxy-skills/browser-research',
      bodyPath: '/tmp/roxy-skills/browser-research/SKILL.md',
      frontmatter: {
        name: 'browser-research',
        description: 'Research using browser automation.',
      },
    }]

    const child = await createGeneralPurposeAgent({
      agentPath: '/root/skill_worker',
      manager: fakeManager(),
      message: agentMessage,
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'deepseek-v4-flash',
      apiKey: 'token',
      parentTools: createParentTools(),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      skills,
      mcp: {
        createProfileBinding: vi.fn(async () => {}),
        getPlaywrightToolsForBinding: vi.fn(async () => []),
        releaseProfileBinding: vi.fn(),
      },
      runtimeFactory: vi.fn(async (input: AgentDefinition) => {
        definition = input
        return fakeAgent()
      }),
    })

    expect(definition?.skills).toBe(skills)
    await child.dispose()
  })

  it('configures the profile scope before runtime creation and isolates browser tools', async () => {
    const launchHandler = vi.fn(async () => ({ content: 'launched', isError: false }))
    const childSnapshotHandler = vi.fn(async () => ({ content: 'child snapshot', isError: false }))
    const rootSnapshotHandler = vi.fn(async () => ({ content: 'root snapshot', isError: false }))
    const sharedOpenApiHandler = vi.fn(async () => ({ content: 'shared openapi', isError: false }))
    const allowedDirIds = new Set<string>()
    const createProfileBinding = vi.fn(async (options: { allowedDirIds?: readonly string[] }) => {
      allowedDirIds.clear()
      for (const dirId of options.allowedDirIds ?? []) {
        allowedDirIds.add(dirId)
      }
    })
    const releaseProfileBinding = vi.fn()
    const agent = fakeAgent()
    const invoke = vi.spyOn(agent, 'invoke')
    let definition: AgentDefinition | undefined
    let bindingReadyBeforeRuntime = false
    const childResourceKey = generalPurposeAgentResourceKey('conversation-1', '/root/operator')

    const child = await createGeneralPurposeAgent({
      agentPath: '/root/operator',
      manager: fakeManager(),
      message: agentMessage,
      dirIds: ['dir-1', 'dir-2'],
      rootAllowedDirIds: ['dir-1', 'dir-2'],
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'deepseek-v4-flash',
      apiFormat: 'openai',
      apiKey: 'token',
      inheritedToolNames: ['apply_patch', 'update_plan', 'mcp_roxybrowser-openapi-mcp__roxy_workspace_list'],
      parentTools: createParentTools([
        {
          descriptor: {
            name: 'mcp_roxybrowser-openapi-mcp__roxy_workspace_list',
            description: 'shared openapi',
            inputSchema: z.object({}),
            source: 'mcp',
          },
          handler: sharedOpenApiHandler,
        },
        {
          descriptor: {
            name: 'mcp_roxybrowser_playwright_chat_conversation-1__browser_snapshot',
            description: 'root snapshot',
            inputSchema: z.object({}),
            source: 'mcp',
          },
          handler: rootSnapshotHandler,
        },
      ]),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      mcp: {
        createProfileBinding,
        getPlaywrightToolsForBinding: vi.fn(async (): Promise<RuntimeMcpTool[]> => [
          withWindowScopeGuard({
            descriptor: {
              name: `mcp_roxybrowser_playwright_${childResourceKey}__roxy_browser_launch`,
              description: 'launch',
              inputSchema: z.strictObject({ dirId: z.string() }),
              source: 'mcp',
            },
            handler: launchHandler,
          }, () => allowedDirIds),
          {
            descriptor: {
              name: `mcp_roxybrowser_playwright_${childResourceKey}__browser_snapshot`,
              description: 'child snapshot',
              inputSchema: z.object({}),
              source: 'mcp',
            },
            handler: childSnapshotHandler,
          },
        ]),
        releaseProfileBinding,
      },
      runtimeFactory: vi.fn(async (input: AgentDefinition) => {
        bindingReadyBeforeRuntime = createProfileBinding.mock.calls.length === 1
        definition = input
        return agent
      }),
    })

    expect(bindingReadyBeforeRuntime).toBe(true)
    expect(createProfileBinding).toHaveBeenCalledWith(expect.objectContaining({
      bindingId: child.resourceKey,
      executionId: 'run-1',
      allowedDirIds: ['dir-1', 'dir-2'],
    }))
    expect(definition?.tools.resolve('spawn_agent')).toBeUndefined()
    expect(definition?.tools.resolve('list_agents')).toBeUndefined()
    expect(definition?.tools.resolve('wait_agent')).toBeUndefined()
    expect(definition?.tools.resolve('parallel_dispatch')).toBeUndefined()
    expect(definition?.tools.resolve('apply_patch')?.descriptor).toMatchObject({
      kind: 'custom',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    })
    expect(definition?.tools.resolve('update_plan')).toBeDefined()
    expect(definition?.tools.resolve('roxy_script_run')).toBeUndefined()
    expect(definition?.tools.resolve('mcp_roxybrowser-openapi-mcp__roxy_workspace_list')?.handler).toBe(sharedOpenApiHandler)
    expect(definition?.tools.resolve(`mcp_roxybrowser_playwright_${child.resourceKey}__browser_snapshot`)?.handler).toBe(childSnapshotHandler)
    expect(definition?.tools.resolve('mcp_roxybrowser_playwright_chat_conversation-1__browser_snapshot')).toBeUndefined()
    expect(definition?.systemPrompt).not.toContain(`mcp_roxybrowser_playwright_${child.resourceKey}__roxy_browser_launch`)

    const launch = definition!.tools.resolve(`mcp_roxybrowser_playwright_${child.resourceKey}__roxy_browser_launch`)!
    await expect(launch.handler({ dirId: 'dir-1' }, toolContext)).resolves.toMatchObject({ isError: false })
    await expect(launch.handler({ dirId: 'dir-3' }, toolContext)).resolves.toMatchObject({ isError: true })
    expect(launchHandler).toHaveBeenCalledTimes(1)

    await child.invoke()
    const input = invoke.mock.calls[0]?.[0]
    expect(input).toEqual([
      expect.objectContaining({
        role: 'developer',
        visible: false,
        content: expect.stringContaining(`<cwd>/tmp/roxy-general-purpose-agents/${child.resourceKey}</cwd>`),
      }),
      expect.objectContaining({ role: 'developer', visible: false, content: expect.stringContaining('<dir_id>dir-1</dir_id>') }),
      { role: 'user', content: agentMessage },
    ])

    await child.dispose()
    expect(releaseProfileBinding).toHaveBeenCalledWith(child.resourceKey)
  })

  it('omits apply_patch guidance for non-OpenAI formats', async () => {
    let definition: AgentDefinition | undefined
    const child = await createGeneralPurposeAgent({
      agentPath: '/root/anthropic_worker',
      manager: fakeManager(),
      message: agentMessage,
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'claude-sonnet',
      apiFormat: 'anthropic',
      apiKey: 'token',
      inheritedToolNames: [],
      parentTools: createParentTools(),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      mcp: {
        createProfileBinding: vi.fn(async () => {}),
        getPlaywrightToolsForBinding: vi.fn(async () => []),
        releaseProfileBinding: vi.fn(),
      },
      runtimeFactory: vi.fn(async (input: AgentDefinition) => {
        definition = input
        return fakeAgent()
      }),
    })

    expect(definition?.systemPrompt).not.toContain('### File Editing with `apply_patch`')
    await child.dispose()
  })

  it('keeps root-only report and template tools out of default child inheritance', async () => {
    // Regression: a general-purpose child inherited root-only completion and
    // persistence tools, allowing it to submit a partial report or template.
    // Fixed by: filtering those names before the child registry is assembled.
    let definition: AgentDefinition | undefined
    const child = await createGeneralPurposeAgent({
      agentPath: '/root/report_worker',
      manager: fakeManager(),
      message: agentMessage,
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'deepseek-v4-flash',
      apiKey: 'token',
      parentTools: createParentTools([
        {
          descriptor: {
            name: 'roxy_task_report',
            description: 'report',
            inputSchema: z.object({}),
            source: 'builtin',
          },
          handler: async () => ({ content: 'report', isError: false }),
        },
        {
          descriptor: {
            name: 'roxy_save_user_template',
            description: 'save template',
            inputSchema: z.object({}),
            source: 'builtin',
          },
          handler: async () => ({ content: 'saved', isError: false }),
        },
        {
          descriptor: {
            name: 'roxy_delete_user_template',
            description: 'delete user template',
            inputSchema: z.object({ id: z.number() }),
            source: 'builtin',
          },
          handler: async () => ({ content: 'deleted', isError: false }),
        },
      ]),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      mcp: {
        createProfileBinding: vi.fn(async () => {}),
        getPlaywrightToolsForBinding: vi.fn(async () => []),
        releaseProfileBinding: vi.fn(),
      },
      runtimeFactory: vi.fn(async (input: AgentDefinition) => {
        definition = input
        return fakeAgent()
      }),
    })

    expect(definition?.tools.resolve('roxy_task_report')).toBeUndefined()
    expect(definition?.tools.resolve('roxy_save_user_template')).toBeUndefined()
    expect(definition?.tools.resolve('roxy_delete_user_template')).toBeUndefined()
    await child.dispose()
  })

  it('rejects invalid input before allocating a profile binding', async () => {
    const createProfileBinding = vi.fn(async () => {})
    const common = {
      agentPath: '/root/worker',
      manager: fakeManager(),
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'deepseek-v4-flash',
      apiKey: 'token',
      rootAllowedDirIds: ['dir-1'],
      parentTools: createParentTools(),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      mcp: {
        createProfileBinding,
        getPlaywrightToolsForBinding: vi.fn(async () => []),
        releaseProfileBinding: vi.fn(),
      },
      runtimeFactory: vi.fn(async () => fakeAgent()),
    }

    await expect(createGeneralPurposeAgent({ ...common, message: '   ' })).rejects.toThrow(/message/i)
    await expect(createGeneralPurposeAgent({ ...common, message: agentMessage, dirIds: ['dir-2'] })).rejects.toThrow(/allowlist/)
    await expect(createGeneralPurposeAgent({
      ...common,
      message: agentMessage,
      inheritedToolNames: ['missing_tool'],
    })).rejects.toThrow(/not registered on the main agent/)
    expect(createProfileBinding).not.toHaveBeenCalled()
  })

  it('inherits the root scope and creates deterministic resource keys', async () => {
    const createProfileBinding = vi.fn(async () => {})
    const releaseProfileBinding = vi.fn()
    const child = await createGeneralPurposeAgent({
      agentPath: '/root/worker',
      manager: fakeManager(),
      message: agentMessage,
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      model: 'deepseek-v4-flash',
      apiKey: 'token',
      rootAllowedDirIds: ['dir-1', 'dir-2'],
      parentTools: createParentTools(),
      workspaceDir: '/tmp/roxy-general-purpose-agents',
      fileCollector: createRuntimeFileCollector(),
      mcp: {
        createProfileBinding,
        getPlaywrightToolsForBinding: vi.fn(async () => []),
        releaseProfileBinding,
      },
      runtimeFactory: vi.fn(async () => fakeAgent()),
    })

    expect(createProfileBinding).toHaveBeenCalledWith(expect.objectContaining({
      bindingId: child.resourceKey,
      allowedDirIds: ['dir-1', 'dir-2'],
    }))
    await child.dispose()

    const first = generalPurposeAgentResourceKey('conversation-1', '/root/tiktok_operator')
    const second = generalPurposeAgentResourceKey('conversation-1', '/root/order_checker')
    const otherConversation = generalPurposeAgentResourceKey('conversation-2', '/root/tiktok_operator')
    expect(first).not.toBe(second)
    expect(first).not.toBe(otherConversation)
    expect(first).toMatch(/^agent_[a-f0-9]{24}$/)
    expect(first).not.toContain('/')
    expect(first).not.toContain('tiktok_operator')
  })
})

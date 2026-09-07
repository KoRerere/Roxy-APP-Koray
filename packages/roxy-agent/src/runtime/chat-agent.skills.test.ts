import type {
  Agent,
  AgentDefinition,
  AgentResponse,
  AgentStreamEvent,
  SkillManifest,
  ToolContext,
  ToolDescriptor,
} from 'roxy-agent-runtime'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const testRoot = `${tmpdir()}/roxy-agent-chat-skills-test`
const runtimeCreateMock = vi.hoisted(() => vi.fn())
const agentDisposeMock = vi.hoisted(() => vi.fn(async () => {}))
const listRuntimeSkillManifestsMock = vi.hoisted(() => vi.fn())

vi.mock('roxy-agent-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('roxy-agent-runtime')>()
  return {
    ...actual,
    AgentRuntime: {
      create: runtimeCreateMock,
    },
  }
})

vi.mock('@/config', () => ({
  aiAgentUrl: 'http://127.0.0.1:26580/llm-proxy',
  aiAgentResponsesUrl: 'http://127.0.0.1:26580/llm-proxy/v1',
  aiAgentToken: 'test-token',
  env: {
    AI_AGENT_VERSION: 'test',
    ENV_TYPE: 'test',
    ROXY_API_KEY: 'api-key',
    ROXY_SERVER_HEADERS: {},
    ROXY_USER_TOKEN: 'user-token',
    ROXY_WORKSPACE_ID: 'workspace-1',
  },
}))

vi.mock('@/core/mcp/mcpManager', () => ({
  mcpManager: {
    createProfileBinding: vi.fn(async () => {}),
    getToolsForBinding: vi.fn(async () => []),
    releaseProfileBinding: vi.fn(),
    releaseExecution: vi.fn(async () => {}),
  },
}))

vi.mock('@/core/skillManager', () => ({
  getSkillManager: () => ({
    listRuntimeSkillManifests: listRuntimeSkillManifestsMock,
  }),
}))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    memoryDir: `${testRoot}/memory`,
    memoryIndexFile: `${testRoot}/memory/MEMORY.md`,
    skillsBuiltinDir: `${testRoot}/library/skills/builtin`,
    sessionDir: (sessionId: string) => `${testRoot}/sessions/${sessionId}`,
    sessionBrowserDir: (sessionId: string) => `${testRoot}/sessions/${sessionId}/browser`,
    sessionRecordingLog: (sessionId: string) => `${testRoot}/sessions/${sessionId}/recording.jsonl`,
    sessionRollout: (sessionId: string) => `${testRoot}/sessions/${sessionId}/rollout.jsonl`,
  },
}))

vi.mock('./provider', () => ({
  getRuntimeModel: vi.fn(async () => ({
    model: 'deepseek-v4-flash',
    headers: {},
    modelInfo: {
      api_format: 'responses',
      meta: {},
    },
  })),
}))

function fakeAgent(): Agent {
  return {
    id: 'root-agent',
    sessionId: 'conversation-1',
    invoke: async (): Promise<AgentResponse> => ({ messages: [], trajectory: [] }),
    async* stream(): AsyncIterable<AgentStreamEvent> {},
    structured: <T>() => ({
      invoke: async () => {
        throw new Error('structured output is not used in this test')
      },
    }) as { invoke: () => Promise<T> },
    resume: () => {},
    clarify: () => {},
    cancelPending: () => {},
    dispose: agentDisposeMock,
  }
}

describe('runtime chat agent Skills wiring', () => {
  afterEach(async () => {
    vi.clearAllMocks()
    await rm(testRoot, { recursive: true, force: true })
  })

  it('restores report windows after rebuilding the agent for a follow-up turn', async () => {
    listRuntimeSkillManifestsMock.mockResolvedValue([])
    runtimeCreateMock.mockResolvedValue(fakeAgent())
    const { createRuntimeChatAgent } = await import('./chat-agent')
    const { mcpManager } = await import('@/core/mcp/mcpManager')
    const first = await createRuntimeChatAgent({
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
      reportAllowedDirIds: ['used', 'selected-only'],
    })
    first.createInput('执行任务')
    vi.mocked(mcpManager.createProfileBinding).mock.calls[0]![0].onBrowserLaunched?.('used')
    await first.destroy()

    const next = await createRuntimeChatAgent({
      conversationId: 'conversation-1',
      executionId: 'run-2',
      turnId: 'turn-2',
      reportAllowedDirIds: [],
    })
    next.createInput('重新生成任务报告')
    const definition = runtimeCreateMock.mock.calls[1]![0] as AgentDefinition
    const report = definition.tools.resolve('roxy_task_report')!
    const context: ToolContext = { agentId: 'root', traceId: 'test', signal: new AbortController().signal }
    const result = await report.handler({
      taskName: '重新生成',
      params: [],
      windows: [{ dirId: 'used', success: true, failureReason: '' }],
    }, context)

    expect(result.isError).toBe(false)
    expect((await report.handler({
      taskName: '重新生成',
      params: [],
      windows: [{ dirId: 'selected-only', success: false, status: 'unused', failureReason: '' }],
    }, context)).isError).toBe(true)
    await next.destroy()
  })

  it('passes local Skill manifests into the root AgentRuntime definition', async () => {
    // Regression: createRuntimeChatAgent never passed SkillManifest data into
    // AgentRuntime.create, so runtime skill catalog prompt rendering always saw
    // an empty list and the agent never discovered available Skills.
    // Fixed by: loading SkillManager's runtime manifests before creating the
    // root runtime and sharing that snapshot with children.
    const skills: SkillManifest[] = [{
      name: 'browser-research',
      description: 'Research using browser automation.',
      sourcePath: `${testRoot}/skills/browser-research`,
      bodyPath: `${testRoot}/skills/browser-research/SKILL.md`,
      frontmatter: {
        name: 'browser-research',
        description: 'Research using browser automation.',
      },
    }]
    listRuntimeSkillManifestsMock.mockResolvedValue(skills)
    runtimeCreateMock.mockResolvedValue(fakeAgent())

    const { createRuntimeChatAgent } = await import('./chat-agent')
    const instance = await createRuntimeChatAgent({
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
    })

    const definition = runtimeCreateMock.mock.calls[0]?.[0] as AgentDefinition | undefined
    expect(listRuntimeSkillManifestsMock).toHaveBeenCalledTimes(1)
    expect(definition?.skills).toBe(skills)

    await instance.destroy()
  })

  it('does not force-select the template creator for a report-backed save turn', async () => {
    // Regression: report-card saves force-loaded roxy-template-creator even
    // when the model should decide whether the matching skill applies.
    // Fixed by: template context only provides report data and leaves selection
    // to the Skills catalog plus the system prompt.
    const creator: SkillManifest = {
      name: 'roxy-template-creator',
      description: 'Create reusable Skill templates.',
      sourcePath: `${testRoot}/library/skills/builtin/roxy-template-creator`,
      bodyPath: `${testRoot}/library/skills/builtin/roxy-template-creator/SKILL.md`,
      frontmatter: {
        name: 'roxy-template-creator',
        description: 'Create reusable Skill templates.',
      },
    }
    listRuntimeSkillManifestsMock.mockResolvedValue([creator])
    runtimeCreateMock.mockResolvedValue(fakeAgent())

    const { createRuntimeChatAgent } = await import('./chat-agent')
    const instance = await createRuntimeChatAgent({
      conversationId: 'conversation-template',
      executionId: 'run-template',
      turnId: 'turn-template',
    })

    const input = instance.createInput('请你将刚才的任务保存为模板')
    expect(Array.isArray(input)).toBe(true)
    expect(!Array.isArray(input) && typeof input !== 'string' ? input.skills : undefined).toBeUndefined()

    await instance.destroy()
  })

  it('enables metrics in development and test environments but not production', async () => {
    // Regression: metrics were gated to development only, so automated tests
    // exercised a different runtime plugin set than non-production product runs.
    // Fixed by: enabling the metrics plugin for every non-production Agent env.
    const config = await import('@/config')
    listRuntimeSkillManifestsMock.mockResolvedValue([])
    runtimeCreateMock.mockResolvedValue(fakeAgent())

    const { createRuntimeChatAgent } = await import('./chat-agent')
    for (const envType of ['development', 'test'] as const) {
      config.env.ENV_TYPE = envType
      runtimeCreateMock.mockClear()
      const instance = await createRuntimeChatAgent({
        conversationId: `conversation-${envType}`,
        executionId: `run-${envType}`,
        turnId: `turn-${envType}`,
      })

      const definition = runtimeCreateMock.mock.calls[0]?.[0] as AgentDefinition | undefined
      expect(definition?.plugins?.some(plugin => plugin.name === 'metrics')).toBe(true)

      await instance.destroy()
    }

    config.env.ENV_TYPE = 'production'
    runtimeCreateMock.mockClear()
    const instance = await createRuntimeChatAgent({
      conversationId: 'conversation-production',
      executionId: 'run-production',
      turnId: 'turn-production',
    })

    const definition = runtimeCreateMock.mock.calls[0]?.[0] as AgentDefinition | undefined
    expect(definition?.plugins?.some(plugin => plugin.name === 'metrics')).toBe(false)

    await instance.destroy()
  })

  it('switches the live HITL handler to full access for subsequent calls', async () => {
    // Regression: approving a single tool call had no way to change the live
    // handler, so the next model turn asked for approval again.
    // Fixed by: exposing a runtime control that enables full access on the
    // existing ChatHitlHandler instance.
    listRuntimeSkillManifestsMock.mockResolvedValue([])
    runtimeCreateMock.mockResolvedValue(fakeAgent())

    const { createRuntimeChatAgent } = await import('./chat-agent')
    const instance = await createRuntimeChatAgent({
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
    })

    const definition = runtimeCreateMock.mock.calls[0]?.[0] as AgentDefinition | undefined
    const descriptor: ToolDescriptor = {
      name: 'write',
      description: 'write',
      inputSchema: z.any(),
      source: 'builtin',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    }
    expect(definition?.hitl.needsApproval(descriptor)).toBe(true)
    instance.setFullAccess()
    expect(definition?.hitl.needsApproval(descriptor)).toBe(false)

    await instance.destroy()
  })

  it('applies the expected approval policy to stdin, scripts, and template tools', async () => {
    // Regression: write_stdin and roxy_script_run inherited their conservative
    // tool annotations and interrupted Agent automation with approval dialogs.
    // Fixed by: declaring those tools as read-only and closed-world through
    // their standard ToolAnnotations.
    listRuntimeSkillManifestsMock.mockResolvedValue([])
    runtimeCreateMock.mockResolvedValue(fakeAgent())

    const { createRuntimeChatAgent } = await import('./chat-agent')
    const instance = await createRuntimeChatAgent({
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
    })

    const definition = runtimeCreateMock.mock.calls[0]?.[0] as AgentDefinition | undefined
    const writeStdin = definition?.tools.resolve('write_stdin')
    const scriptDescribe = definition?.tools.resolve('roxy_script_describe')
    const scriptRun = definition?.tools.resolve('roxy_script_run')
    const listTemplates = definition?.tools.resolve('roxy_list_templates')
    const readTemplateInfo = definition?.tools.resolve('roxy_read_template_info')
    const deleteUserTemplate = definition?.tools.resolve('roxy_delete_user_template')

    expect(writeStdin).toBeDefined()
    expect(scriptDescribe).toBeDefined()
    expect(scriptRun).toBeDefined()
    expect(listTemplates).toBeDefined()
    expect(readTemplateInfo).toBeDefined()
    expect(deleteUserTemplate).toBeDefined()
    expect(definition?.hitl.needsApproval(writeStdin!.descriptor, { session_id: 1 })).toBe(false)
    expect(definition?.hitl.needsApproval(scriptDescribe!.descriptor, { scriptPath: 'official:demo' })).toBe(false)
    expect(
      definition?.hitl.needsApproval(scriptRun!.descriptor, { scripts: [{ scriptPath: 'official:demo', dirIds: ['dir-1'] }] }),
    ).toBe(false)
    expect(definition?.hitl.needsApproval(listTemplates!.descriptor, { scope: 'official' })).toBe(false)
    expect(definition?.hitl.needsApproval(readTemplateInfo!.descriptor, { scope: 'user', id: 1 })).toBe(false)
    expect(definition?.hitl.needsApproval(deleteUserTemplate!.descriptor, { id: 1 })).toBe(true)

    await instance.destroy()
  })

  it('allows safe configured exec_command patterns without HITL', async () => {
    // Regression: CommandPermissions existed in runtime but the product chat
    // assembly did not inject it, so even read-only commands such as rg paused.
    // Fixed by: wiring the product command policy into both exec_command and
    // the chat HITL handler.
    listRuntimeSkillManifestsMock.mockResolvedValue([])
    runtimeCreateMock.mockResolvedValue(fakeAgent())

    const { createRuntimeChatAgent } = await import('./chat-agent')
    const instance = await createRuntimeChatAgent({
      conversationId: 'conversation-1',
      executionId: 'run-1',
      turnId: 'turn-1',
    })

    const definition = runtimeCreateMock.mock.calls[0]?.[0] as AgentDefinition | undefined
    const execCommand = definition?.tools.resolve('exec_command')
    expect(execCommand).toBeDefined()
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'rg TODO src' })).toBe(false)
    expect(
      definition?.hitl.needsApproval(execCommand!.descriptor, {
        cmd: 'rg --files /Users/anbin/Projects/roxy-agent-server | rg -i "sandbox|utils" | head -50',
      }),
    ).toBe(false)
    expect(
      definition?.hitl.needsApproval(execCommand!.descriptor, {
        cmd: 'find /Users/anbin -maxdepth 6 -type d -name "sandbox" 2>/dev/null | head -20',
      }),
    ).toBe(false)
    expect(
      definition?.hitl.needsApproval(execCommand!.descriptor, {
        cmd: 'find /Users/anbin -maxdepth 6 -type d -name "sandbox" 2>/dev/null; find /Users/anbin -maxdepth 8 -path "*@roxybrowser/sandbox*" -name "*.js" 2>/dev/null | head -20',
      }),
    ).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'curl https://example.com' })).toBe(false)
    expect(
      definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'curl -I https://example.com | head -20' }),
    ).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'cat package.json' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'git status --short' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'git ls-files packages/roxy-agent' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'git rev-parse HEAD' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'df -h' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'printf ready' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'Get-ChildItem -Force', shell: 'pwsh' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'Get-Content package.json', shell: 'pwsh' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'Select-String TODO src/index.ts', shell: 'pwsh' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'Get-ChildItem | Remove-Item', shell: 'pwsh' })).toBe(true)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'Remove-Item package.json', shell: 'pwsh' })).toBe(true)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'pnpm test' })).toBe(true)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'rg TODO src && rm -rf /' })).toBe(true)
    // These commands are otherwise read-only, but their output-file options
    // must stay hard-blocked instead of becoming an implicit write allowlist.
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'sort -o result.txt input.txt' })).toBe(false)
    expect(definition?.hitl.needsApproval(execCommand!.descriptor, { cmd: 'git log --output=history.txt' })).toBe(false)

    const deniedInput = await execCommand!.descriptor.inputSchema.parseAsync({ cmd: 'rg --pre cat TODO src' })
    const denied = await execCommand!.handler(deniedInput, {
      signal: new AbortController().signal,
    } as ToolContext)
    expect(denied).toEqual(expect.objectContaining({ isError: true }))
    expect(denied.content).toContain('command denied by permissions policy')

    await instance.destroy()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createDeepAgent: vi.fn((config: any) => ({ config })),
  createLLM: vi.fn(async () => ({ model: 'llm' })),
  createDeepAgentRuntime: vi.fn(async () => ({
    backend: { kind: 'backend' },
    middleware: [],
    tools: [],
    interruptOn: {},
    destroy: vi.fn(),
  })),
  createPlaywrightClientForWorker: vi.fn(async () => {}),
  destroyPlaywrightClientForWorker: vi.fn(async () => {}),
  getToolsForWorker: vi.fn(async () => []),
  setWorkerAllowedDirIds: vi.fn(),
  conversationCheckpointPath: vi.fn(() => '/tmp/should-not-be-used/checkpoint.db'),
  sqliteFromConnString: vi.fn(() => ({ kind: 'checkpointer' })),
  createRunScriptTool: vi.fn(() => ({ name: 'run_script' })),
}))

vi.mock('deepagents', () => ({
  createDeepAgent: mocks.createDeepAgent,
  GENERAL_PURPOSE_SUBAGENT: {
    name: 'general-purpose',
    description: 'general purpose',
    tools: [],
    middleware: [],
  },
}))

vi.mock('@/core/mcp/mcpManager', () => ({
  mcpManager: {
    createPlaywrightClientForWorker: mocks.createPlaywrightClientForWorker,
    destroyPlaywrightClientForWorker: mocks.destroyPlaywrightClientForWorker,
    getToolsForWorker: mocks.getToolsForWorker,
    setWorkerAllowedDirIds: mocks.setWorkerAllowedDirIds,
  },
}))

vi.mock('../../llm', () => ({
  createLLM: mocks.createLLM,
}))

vi.mock('../backend', () => ({
  createDeepAgentRuntime: mocks.createDeepAgentRuntime,
}))

vi.mock('../checkpointPaths', () => ({
  conversationCheckpointPath: mocks.conversationCheckpointPath,
}))

vi.mock('../sqlite-checkpointer', () => ({
  SqliteSaver: {
    fromConnString: mocks.sqliteFromConnString,
  },
}))

vi.mock('../tools/get_script_self_description', () => ({
  getScriptSelfDescriptionTool: { name: 'get_script_self_description' },
}))

vi.mock('../tools/list_scripts', () => ({
  listScriptsTool: { name: 'list_scripts' },
}))

vi.mock('../tools/run_script', () => ({
  createRunScriptTool: mocks.createRunScriptTool,
}))

vi.mock('../tools/run_worker', () => ({
  workerTools: [{ name: 'parallel_dispatch' }],
}))

vi.mock('../tools/filesystem', () => ({
  createRoxyFilesystemMiddleware: vi.fn(() => ({ name: 'filesystem' })),
}))

describe('createChatAgent worker session handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the parent conversation session and does not create a checkpoint for workers', async () => {
    const { createChatAgent } = await import('./chat')

    await createChatAgent({
      role: 'worker',
      workerId: 'profile-worker-1',
      conversationId: 'conv-parent',
      turnId: 'turn-1',
      taskMonitorTaskId: 'profile-worker-1',
    })

    expect(mocks.createPlaywrightClientForWorker).toHaveBeenCalledWith('profile-worker-1', 'conv-parent')
    expect(mocks.conversationCheckpointPath).not.toHaveBeenCalled()
    expect(mocks.sqliteFromConnString).not.toHaveBeenCalled()
    expect(mocks.createDeepAgentRuntime).toHaveBeenCalledWith(expect.objectContaining({
      allowExecution: true,
      workspaceDir: expect.stringContaining('conv-parent'),
      conversationId: 'conv-parent',
      workerId: 'profile-worker-1',
      taskMonitorTaskId: 'profile-worker-1',
    }))
    expect(mocks.createRunScriptTool).toHaveBeenCalledWith(expect.objectContaining({
      workspaceDir: expect.stringContaining('conv-parent'),
      taskMonitorTaskId: 'profile-worker-1',
    }))
    expect(mocks.createDeepAgent).toHaveBeenCalledWith(expect.objectContaining({
      checkpointer: undefined,
      name: 'worker',
    }))
  })

  it('rejects workers without a parent conversation id', async () => {
    const { createChatAgent } = await import('./chat')

    await expect(createChatAgent({
      role: 'worker',
      workerId: 'profile-worker-1',
    })).rejects.toThrow('Worker chat agent requires parent conversationId')
  })

  it('passes the abort signal to model initialization and releases created resources', async () => {
    const abortController = new AbortController()
    mocks.createLLM.mockImplementationOnce(async (options: { signal?: AbortSignal }) => {
      abortController.abort('User cancelled')
      expect(options.signal).toBe(abortController.signal)
      throw new DOMException('User cancelled', 'AbortError')
    })
    const { createChatAgent } = await import('./chat')

    await expect(createChatAgent({
      workerId: 'chat_run-1',
      conversationId: 'conversation-1',
      turnId: 'turn-1',
      signal: abortController.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(mocks.createPlaywrightClientForWorker).toHaveBeenCalledWith('chat_run-1', 'conversation-1')
    expect(mocks.destroyPlaywrightClientForWorker).toHaveBeenCalledWith('chat_run-1')
    expect(mocks.createDeepAgentRuntime).not.toHaveBeenCalled()
  })

  it('releases the runtime and playwright client when cancellation follows runtime initialization', async () => {
    const abortController = new AbortController()
    const runtimeDestroy = vi.fn(async () => {})
    mocks.createDeepAgentRuntime.mockImplementationOnce(async () => {
      abortController.abort('User cancelled')
      return {
        backend: { kind: 'backend' },
        middleware: [],
        tools: [],
        interruptOn: {},
        destroy: runtimeDestroy,
      }
    })
    const { createChatAgent } = await import('./chat')

    await expect(createChatAgent({
      workerId: 'chat_run-2',
      conversationId: 'conversation-1',
      turnId: 'turn-2',
      signal: abortController.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })

    expect(runtimeDestroy).toHaveBeenCalledOnce()
    expect(mocks.destroyPlaywrightClientForWorker).toHaveBeenCalledWith('chat_run-2')
    expect(mocks.createDeepAgent).not.toHaveBeenCalled()
  })
})

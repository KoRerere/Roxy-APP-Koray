import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  tmpDir: '',
  runnerInstances: [] as Array<{
    workerId: string
    payloadPath: string
    agentScriptPath: string
    timeoutMs: number
    writer: (event: any) => void
    signal?: AbortSignal
    start: ReturnType<typeof vi.fn>
    promise: Promise<any>
  }>,
  publishTaskMonitorTaskStarted: vi.fn(),
  publishTaskMonitorTaskFinished: vi.fn(),
  clearPayloadFile: vi.fn(async () => {}),
}))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    get tmpDir() {
      return mocks.tmpDir
    },
  },
}))

vi.mock('@/core/task-monitor', () => ({
  publishTaskMonitorTaskFinished: mocks.publishTaskMonitorTaskFinished,
  publishTaskMonitorTaskStarted: mocks.publishTaskMonitorTaskStarted,
}))

vi.mock('../../core/worker/workerRunner', () => {
  class MockWorkerRunner {
    promise: Promise<any>
    start = vi.fn()

    constructor(
      public workerId: string,
      public payloadPath: string,
      public agentScriptPath: string,
      public timeoutMs: number,
      public writer: (event: any) => void,
      public signal?: AbortSignal,
    ) {
      this.promise = Promise.resolve({
        worker: workerId,
        status: 'success',
        result: `done ${workerId}`,
        exitCode: 0,
        signal: null,
        durationMs: 12,
      })
      mocks.runnerInstances.push(this)
    }
  }

  return {
    DEFAULT_WORKER_TIMEOUT_MS: 3_600_000,
    clearPayloadFile: mocks.clearPayloadFile,
    WorkerRunner: MockWorkerRunner,
  }
})

describe('parallel_dispatch conversation metadata', () => {
  const previousAgentScriptPath = process.env.AGENT_SCRIPT_PATH

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.runnerInstances.length = 0
    mocks.tmpDir = await fs.mkdtemp(path.join(tmpdir(), 'roxy-agent-worker-test-'))
    process.env.AGENT_SCRIPT_PATH = '/tmp/roxy-agent.mjs'
  })

  afterEach(async () => {
    if (previousAgentScriptPath === undefined)
      delete process.env.AGENT_SCRIPT_PATH
    else
      process.env.AGENT_SCRIPT_PATH = previousAgentScriptPath

    await fs.rm(mocks.tmpDir, { recursive: true, force: true })
  })

  it('writes the parent conversationId into worker payloads and events', async () => {
    const { createWorkerTools } = await import('./run_worker')
    const workerTools = createWorkerTools('conv-parent')
    const writer = vi.fn()

    await workerTools[0].invoke({
      assignments: [{
        worker: 'profile-worker-1',
        task: 'search fingerprint browsers',
        title: 'Search with Baidu',
        dirId: 'dir-1',
      }],
    }, {
      configurable: {
        conversationId: 'conv-parent',
        turnId: 'turn-parent',
      },
      writer,
    } as any)

    expect(mocks.publishTaskMonitorTaskStarted).toHaveBeenCalledWith(expect.objectContaining({
      conversationId: 'conv-parent',
      sourceType: 'worker',
      title: 'Search with Baidu',
    }))
    expect(writer).toHaveBeenCalledWith(expect.objectContaining({
      type: 'worker_dispatched',
      data: expect.objectContaining({
        title: 'Search with Baidu',
        workerId: expect.stringContaining('profile-worker-1'),
      }),
    }))

    expect(mocks.runnerInstances).toHaveLength(1)
    const payload = JSON.parse(await fs.readFile(mocks.runnerInstances[0].payloadPath, 'utf8'))
    expect(payload).toEqual(expect.objectContaining({
      conversationId: 'conv-parent',
      turnId: 'turn-parent',
      task: 'search fingerprint browsers',
      timeoutMs: 3_600_000,
    }))
    expect(mocks.runnerInstances[0].timeoutMs).toBe(3_600_000)
  })

  it('uses a custom timeout for the worker payload and runner', async () => {
    const { createWorkerTools } = await import('./run_worker')
    const workerTools = createWorkerTools('conv-parent')

    await workerTools[0].invoke({
      assignments: [{
        worker: 'profile-worker-1',
        task: 'search fingerprint browsers',
        title: 'Search with Baidu',
        dirId: 'dir-1',
      }],
      timeout: 120_000,
    }, {} as any)

    expect(mocks.runnerInstances).toHaveLength(1)
    const payload = JSON.parse(await fs.readFile(mocks.runnerInstances[0].payloadPath, 'utf8'))
    expect(payload.timeoutMs).toBe(120_000)
    expect(mocks.runnerInstances[0].timeoutMs).toBe(120_000)
  })

  it('binds the worker payload to the assigned dirId', async () => {
    const { createWorkerTools } = await import('./run_worker')
    const workerTools = createWorkerTools('conv-parent')

    await workerTools[0].invoke({
      assignments: [{
        worker: 'profile-worker-1',
        task: 'search fingerprint browsers',
        title: 'Search with Baidu',
        dirId: 'dir-bound',
      }],
    }, {} as any)

    const payload = JSON.parse(await fs.readFile(mocks.runnerInstances[0].payloadPath, 'utf8'))
    expect(payload.allowedDirIds).toEqual(['dir-bound'])
  })

  it('requires a dirId on every assignment', async () => {
    const { createWorkerTools } = await import('./run_worker')
    const workerTools = createWorkerTools('conv-parent')

    await expect(workerTools[0].invoke({
      assignments: [{
        worker: 'profile-worker-1',
        task: 'search fingerprint browsers',
        title: 'Search with Baidu',
      }],
    }, {} as any)).rejects.toThrow()

    expect(mocks.runnerInstances).toHaveLength(0)
  })

  it('rejects the same dirId assigned to two workers', async () => {
    const { createWorkerTools } = await import('./run_worker')
    const workerTools = createWorkerTools('conv-parent')

    const result = await workerTools[0].invoke({
      assignments: [
        { worker: 'profile-worker-1', task: 'a', title: 'a', dirId: 'dup' },
        { worker: 'profile-worker-2', task: 'b', title: 'b', dirId: 'dup' },
      ],
    }, {} as any)

    expect(String(result)).toMatch(/assigned to more than one worker/)
    expect(mocks.runnerInstances).toHaveLength(0)
  })

  it('rejects a non-positive worker timeout', async () => {
    const { createWorkerTools } = await import('./run_worker')
    const workerTools = createWorkerTools('conv-parent')

    await expect(workerTools[0].invoke({
      assignments: [{
        worker: 'profile-worker-1',
        task: 'search fingerprint browsers',
        title: 'Search with Baidu',
        dirId: 'dir-1',
      }],
      timeout: 0,
    }, {} as any)).rejects.toThrow()

    expect(mocks.runnerInstances).toHaveLength(0)
  })
})

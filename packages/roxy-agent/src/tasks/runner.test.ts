import assert from 'node:assert/strict'
import { afterEach, describe, it, vi } from 'vitest'
import { AiAgentHttpError } from '@/api/errors'
import { DEFAULT_SCRIPT_TASK_CONCURRENCY } from './constants'
import {
  resolveTaskConcurrency,
  startLeaseWithRetry,
  TaskRunner,
} from './runner'

const runnerMocks = vi.hoisted(() => ({
  getTask: vi.fn(),
  getTemplate: vi.fn(),
  resolveTemplate: vi.fn(async (refInput: string) => {
    const template = await runnerMocks.getTemplate(refInput)
    return {
      ref: {
        namespace: 'user' as const,
        id: template.id,
        value: `user:${template.id}` as const,
      },
      kind: template.templateType,
      id: template.id,
      workspaceId: template.workspaceId,
      name: template.name,
      metadata: template.metadata ?? {},
      createdAt: '',
      updatedAt: '',
    }
  }),
  startExecution: vi.fn(),
  finishExecution: vi.fn(),
  heartbeat: vi.fn(),
  executeAgentTask: vi.fn(),
  prepareTaskScript: vi.fn(),
  createScriptExecutionPlan: vi.fn(),
  executeScriptTask: vi.fn(),
  reserveWindows: vi.fn(),
  closeWindows: vi.fn(),
  releaseWindows: vi.fn(),
  markRunning: vi.fn(),
  updateAssociations: vi.fn(),
  createLog: vi.fn((input: any) => ({
    id: input.id,
    user_id: input.userId,
    workspace_id: input.workspaceId,
    task_id: input.taskId,
    task_name: input.taskName,
    template_id: input.templateId,
    template_name: input.templateName,
    template_type: input.templateType,
    trigger_type: input.triggerType,
    occurrence_id: null,
    scheduled_at: input.scheduledAt,
    input: input.input,
    window_dir_ids: [],
    script_runs: [],
    conversation_id: null,
    file_ids: [],
    status: 'preparing',
    started_at: '2026-07-23T01:00:00.000Z',
    ended_at: null,
    end_reason_code: null,
  })),
  finishLog: vi.fn((id: string, input: any) => ({
    ...runnerMocks.createLog.mock.results.at(-1)?.value,
    id,
    status: input.status,
    ended_at: '2026-07-23T01:00:01.000Z',
    end_reason_code: input.endReasonCode ?? null,
  })),
}))

vi.mock('@/config', () => ({
  env: {
    ROXY_USER_ID: 'user-1',
    ROXY_WORKSPACE_ID: 'workspace-1',
  },
}))

vi.mock('@/api/agentApiClient', () => ({
  agentUserTasksApi: {
    getById: runnerMocks.getTask,
    startExecution: runnerMocks.startExecution,
    finishExecution: runnerMocks.finishExecution,
    heartbeat: runnerMocks.heartbeat,
  },
}))

vi.mock('@/services/templateService', () => ({
  resolveTemplate: runnerMocks.resolveTemplate,
}))

vi.mock('@/database/tasks', () => ({
  taskLogStore: {
    create: runnerMocks.createLog,
    finish: runnerMocks.finishLog,
    markRunning: runnerMocks.markRunning,
    updateAssociations: runnerMocks.updateAssociations,
  },
}))

vi.mock('./executors/agent', () => ({
  executeAgentTask: runnerMocks.executeAgentTask,
  prepareTaskSkill: vi.fn(),
}))

vi.mock('./executors/script', () => ({
  createScriptExecutionPlan: runnerMocks.createScriptExecutionPlan,
  executeScriptTask: runnerMocks.executeScriptTask,
  prepareTaskScript: runnerMocks.prepareTaskScript,
}))

vi.mock('./windowReservation', () => ({
  reserveAvailableTaskWindows: runnerMocks.reserveWindows,
  windowReservationRegistry: {
    release: runnerMocks.releaseWindows,
  },
}))

vi.mock('./windowLifecycle', () => ({
  closeTaskBrowserWindows: runnerMocks.closeWindows,
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('taskRunner', () => {
  function arrangePromptRun(windows: Array<{ id: number, dirId: string }> = []) {
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      creatorUserId: 'user-1',
      name: 'Task',
      userTemplateId: 2,
      windowIds: windows.map(window => window.dirId),
      metadata: { prompt: 'run' },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Prompt template',
      templateType: 'prompt',
    })
    runnerMocks.reserveWindows.mockResolvedValue(windows)
    runnerMocks.startExecution.mockResolvedValue({
      acquired: true,
      leaseToken: 'lease-token',
      occurrenceId: null,
    })
    runnerMocks.finishExecution.mockResolvedValue({ finished: true })
  }

  it('rejects another creator schedule before preparing resources or writing logs', async () => {
    // 回归：陈旧定时器不能绕过本人任务过滤，触发他人的任务准备流程。
    for (const triggerType of ['once', 'cron'] as const) {
      arrangePromptRun()
      const task = await runnerMocks.getTask()
      runnerMocks.getTask.mockResolvedValue({ ...task, creatorUserId: 'other-user' })
      await assert.rejects(new TaskRunner().start(1, {
        triggerType,
        scheduledAt: '2026-07-23T01:00:00.000Z',
      }), { code: 'TASK_SCHEDULE_FORBIDDEN' })
    }
    assert.equal(runnerMocks.getTemplate.mock.calls.length, 0)
    assert.equal(runnerMocks.createLog.mock.calls.length, 0)
    assert.equal(runnerMocks.reserveWindows.mock.calls.length, 0)
    assert.equal(runnerMocks.startExecution.mock.calls.length, 0)
  })

  it('allows manual execution of another creator task', async () => {
    arrangePromptRun()
    const task = await runnerMocks.getTask()
    runnerMocks.getTask.mockResolvedValue({ ...task, creatorUserId: 'other-user' })
    runnerMocks.executeAgentTask.mockResolvedValue({ status: 'success', fileIds: [] })
    const completed = await new TaskRunner().run(1, { triggerType: 'manual' })
    assert.equal(completed.status, 'success')
    assert.equal(runnerMocks.startExecution.mock.calls.length, 1)
  })

  it('does not record missed schedules owned by other accounts', async () => {
    arrangePromptRun()
    const task = await runnerMocks.getTask()
    runnerMocks.getTask.mockResolvedValue({ ...task, creatorUserId: 'other-user' })
    await assert.rejects(new TaskRunner().recordMissed(1, 'once', '2026-07-23T01:00:00.000Z'), {
      code: 'TASK_SCHEDULE_FORBIDDEN',
    })
    assert.equal(runnerMocks.createLog.mock.calls.length, 0)
    assert.equal(runnerMocks.getTemplate.mock.calls.length, 0)
  })

  it('keeps backend schedule rejection distinct from execution contention', async () => {
    arrangePromptRun()
    runnerMocks.startExecution.mockResolvedValue({ acquired: false, reason: 'not_task_creator' })
    const completed = await new TaskRunner().run(1, {
      triggerType: 'once',
      scheduledAt: '2026-07-23T01:00:00.000Z',
    })
    assert.equal(completed.status, 'skipped')
    assert.equal(completed.end_reason_code, 'TASK_SCHEDULE_FORBIDDEN')
    assert.equal(runnerMocks.executeAgentTask.mock.calls.length, 0)
    assert.equal(runnerMocks.startExecution.mock.calls.length, 1)
  })

  it('closes resolved windows before releasing them after success', async () => {
    const windows = [
      { id: 1, dirId: 'window-a' },
      { id: 2, dirId: 'window-b' },
    ]
    arrangePromptRun(windows)
    runnerMocks.executeAgentTask.mockResolvedValue({
      status: 'success',
      fileIds: [],
    })

    const completed = await new TaskRunner().run(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })

    assert.equal(completed.status, 'success')
    assert.equal(runnerMocks.executeAgentTask.mock.calls[0]?.[0].templateName, 'Prompt template')
    const finishInput = runnerMocks.finishLog.mock.calls.at(-1)?.[1]
    assert.deepEqual(finishInput.fileIds, [])
    assert.equal('scriptRuns' in finishInput, false)
    assert.deepEqual(runnerMocks.closeWindows.mock.calls[0][0], windows)
    assert.ok(
      runnerMocks.closeWindows.mock.invocationCallOrder[0]
      < runnerMocks.releaseWindows.mock.invocationCallOrder[0],
    )
  })

  it('resolves the persisted user template ID through a canonical user reference', async () => {
    arrangePromptRun()
    runnerMocks.executeAgentTask.mockResolvedValue({ status: 'success', fileIds: [] })

    await new TaskRunner().run(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })

    assert.deepEqual(runnerMocks.resolveTemplate.mock.calls[0], ['user:2'])
    assert.deepEqual(runnerMocks.getTemplate.mock.calls[0], ['user:2'])
  })

  it('allows a Skill task to run without an auxiliary prompt', async () => {
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      name: 'Skill task',
      creatorUserId: 'user-1',
      userTemplateId: 2,
      windowIds: [],
      metadata: { prompt: null },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Skill template',
      templateType: 'skill',
      metadata: {},
    })
    runnerMocks.reserveWindows.mockResolvedValue([])
    runnerMocks.startExecution.mockResolvedValue({
      acquired: true,
      leaseToken: 'lease-token',
      occurrenceId: null,
    })
    runnerMocks.finishExecution.mockResolvedValue({ finished: true })
    runnerMocks.executeAgentTask.mockResolvedValue({ status: 'success', fileIds: [] })

    const completed = await new TaskRunner().run(1, {
      triggerType: 'once',
      scheduledAt: '2026-07-23T01:00:00.000Z',
    })

    assert.equal(completed.status, 'success')
    assert.equal(runnerMocks.executeAgentTask.mock.calls[0]?.[0].prompt, '')
  })

  it('continues to reject a Prompt task without prompt content', async () => {
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      name: 'Prompt task',
      userTemplateId: 2,
      windowIds: [],
      metadata: { prompt: null },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Prompt template',
      templateType: 'prompt',
      metadata: {},
    })

    await assert.rejects(
      new TaskRunner().start(1, { triggerType: 'manual', scheduledAt: null }),
      /Task snapshot is missing an execution prompt/,
    )
    assert.equal(runnerMocks.createLog.mock.calls.length, 0)
  })

  it('stores per-window script runs without using the agent file column', async () => {
    const windows = [{ id: 1, dirId: 'window-a' }]
    const scriptRuns = [{
      dirId: 'window-a',
      slug: 'report-script',
      runId: 'run-a',
      fileIds: ['file-a'],
    }]
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      name: 'Script task',
      userTemplateId: 2,
      windowIds: ['window-a'],
      metadata: { params: { region: 'jp' }, concurrency: 3 },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Script template',
      templateType: 'script',
      metadata: {},
    })
    runnerMocks.reserveWindows.mockResolvedValue(windows)
    runnerMocks.startExecution.mockResolvedValue({
      acquired: true,
      leaseToken: 'lease-token',
      occurrenceId: 'occurrence-1',
    })
    runnerMocks.finishExecution.mockResolvedValue({ finished: true })
    runnerMocks.prepareTaskScript.mockResolvedValue({
      scriptPath: '/tmp/report.js',
      assetSlug: 'report-script',
      sha512: 'sha512',
    })
    const scriptPlan = {
      taskLogId: 'log-1',
      taskName: 'Script task',
      prepared: {
        scriptPath: '/tmp/report.js',
        assetSlug: 'report-script',
        sha512: 'sha512',
      },
      windows,
      scriptRuns: [{ ...scriptRuns[0], fileIds: [] }],
      params: { region: 'jp' },
      concurrency: 3,
    }
    runnerMocks.createScriptExecutionPlan.mockReturnValue(scriptPlan)
    runnerMocks.executeScriptTask.mockResolvedValue({
      status: 'success',
      fileIds: [],
      scriptRuns,
    })

    const completed = await new TaskRunner().run(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })

    assert.equal(completed.status, 'success')
    assert.equal(runnerMocks.prepareTaskScript.mock.calls[0]?.[0].ref.value, 'user:2')
    assert.equal(runnerMocks.createScriptExecutionPlan.mock.calls[0]?.[5], 3)
    assert.deepEqual(runnerMocks.markRunning.mock.calls[0]?.[1].scriptRuns, scriptPlan.scriptRuns)
    const finishInput = runnerMocks.finishLog.mock.calls.at(-1)?.[1]
    assert.deepEqual(finishInput.scriptRuns, scriptRuns)
    assert.equal('fileIds' in finishInput, false)
    assert.equal('conversationId' in finishInput, false)
  })

  it('keeps a script task in the script log shape when it is cancelled after acquiring a lease', async () => {
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      name: 'Script task',
      userTemplateId: 2,
      windowIds: [],
      metadata: { params: {} },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Script template',
      templateType: 'script',
      metadata: {},
    })
    runnerMocks.prepareTaskScript.mockResolvedValue({
      scriptPath: '/tmp/report.js',
      assetSlug: 'report-script',
      sha512: 'sha512',
    })
    runnerMocks.reserveWindows.mockResolvedValue([])
    runnerMocks.finishExecution.mockResolvedValue({ finished: true })

    const runner = new TaskRunner()
    runnerMocks.startExecution.mockImplementation(async (_taskId, input) => {
      queueMicrotask(() => runner.stop(input.taskLogId))
      return {
        acquired: true,
        leaseToken: 'lease-token',
        occurrenceId: null,
      }
    })

    const completed = await runner.run(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })

    assert.equal(completed.status, 'interrupted')
    assert.equal(completed.end_reason_code, 'TASK_INTERRUPTED')
    assert.equal(runnerMocks.createScriptExecutionPlan.mock.calls.length, 0)
    const finishInput = runnerMocks.finishLog.mock.calls.at(-1)?.[1]
    assert.deepEqual(finishInput.scriptRuns, [])
    assert.equal('conversationId' in finishInput, false)
    assert.equal('fileIds' in finishInput, false)
  })

  it('closes resolved windows after task execution fails', async () => {
    const windows = [{ id: 1, dirId: 'window-a' }]
    arrangePromptRun(windows)
    runnerMocks.executeAgentTask.mockRejectedValue(new Error('execution failed'))

    const completed = await new TaskRunner().run(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })

    assert.equal(completed.status, 'failed')
    assert.equal(completed.end_reason_code, 'TASK_EXECUTION_FAILED')
    assert.deepEqual(runnerMocks.closeWindows.mock.calls[0][0], windows)
  })

  it('closes resolved windows after a running task is stopped', async () => {
    const windows = [{ id: 1, dirId: 'window-a' }]
    arrangePromptRun(windows)
    runnerMocks.executeAgentTask.mockImplementation(({ signal }) => new Promise((resolve) => {
      signal.addEventListener('abort', () => resolve({
        status: 'interrupted',
        fileIds: [],
      }), { once: true })
    }))

    const runner = new TaskRunner()
    const started = await runner.start(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })
    await vi.waitFor(() => assert.equal(runnerMocks.executeAgentTask.mock.calls.length, 1))

    assert.equal(runner.stop(started.log.id), true)
    const completed = await started.completion

    assert.equal(completed.status, 'interrupted')
    assert.equal(completed.end_reason_code, 'TASK_INTERRUPTED')
    assert.deepEqual(runnerMocks.closeWindows.mock.calls[0][0], windows)
  })

  it('returns the terminal log snapshot when definition validation fails', async () => {
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'other-workspace',
      name: 'Task',
      userTemplateId: 2,
      windowIds: [],
      metadata: { prompt: 'run' },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Prompt template',
      templateType: 'prompt',
    })

    const started = await new TaskRunner().start(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })
    const completed = await started.completion

    assert.equal(started.log.status, 'failed')
    assert.equal(completed.status, 'failed')
    assert.equal(started.log.id, completed.id)
    assert.equal(started.log.end_reason_code, 'TASK_WORKSPACE_MISMATCH')
  })

  it('skips a disabled scheduled task without retrying', async () => {
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      creatorUserId: 'user-1',
      name: 'Task',
      userTemplateId: 2,
      windowIds: [],
      metadata: { prompt: 'run' },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Prompt template',
      templateType: 'prompt',
    })
    runnerMocks.reserveWindows.mockResolvedValue([])
    runnerMocks.startExecution.mockResolvedValue({
      acquired: false,
      reason: 'task_disabled',
    })

    const completed = await new TaskRunner().run(1, {
      triggerType: 'once',
      scheduledAt: '2026-07-23T01:00:00.000Z',
    })

    assert.equal(completed.status, 'skipped')
    assert.equal(completed.end_reason_code, 'TASK_DISABLED')
    assert.equal(runnerMocks.startExecution.mock.calls.length, 1)
    assert.equal(runnerMocks.executeAgentTask.mock.calls.length, 0)
  })

  it('records an abort during lease retry backoff as interrupted', async () => {
    vi.useFakeTimers()
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      name: 'Task',
      userTemplateId: 2,
      windowIds: [],
      metadata: { prompt: 'run' },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Prompt template',
      templateType: 'prompt',
    })
    runnerMocks.reserveWindows.mockResolvedValue([])
    runnerMocks.startExecution.mockRejectedValue(new Error('network unavailable'))

    const runner = new TaskRunner()
    const started = await runner.start(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })
    await vi.waitFor(() => assert.equal(runnerMocks.startExecution.mock.calls.length, 1))

    const stopPromise = runner.stopAll()
    await vi.runAllTimersAsync()
    await stopPromise
    const completed = await started.completion

    assert.equal(completed.status, 'interrupted')
    assert.equal(completed.end_reason_code, 'AGENT_SHUTDOWN')
    assert.equal(runnerMocks.startExecution.mock.calls.length, 1)
  })

  it('stops only the active run matching the task log ID', async () => {
    vi.useFakeTimers()
    runnerMocks.getTask.mockResolvedValue({
      id: 1,
      workspaceId: 'workspace-1',
      name: 'Task',
      userTemplateId: 2,
      windowIds: [],
      metadata: { prompt: 'run' },
    })
    runnerMocks.getTemplate.mockResolvedValue({
      id: 2,
      workspaceId: 'workspace-1',
      name: 'Prompt template',
      templateType: 'prompt',
    })
    runnerMocks.reserveWindows.mockResolvedValue([])
    runnerMocks.startExecution.mockRejectedValue(new Error('network unavailable'))

    const runner = new TaskRunner()
    const started = await runner.start(1, {
      triggerType: 'manual',
      scheduledAt: null,
    })
    await vi.waitFor(() => assert.equal(runnerMocks.startExecution.mock.calls.length, 1))

    assert.equal(runner.stop('another-log'), false)
    assert.equal(runner.stop(started.log.id), true)
    assert.equal(runner.stop(started.log.id), false)
    await vi.runAllTimersAsync()
    const completed = await started.completion

    assert.equal(completed.status, 'interrupted')
    assert.equal(completed.end_reason_code, 'TASK_INTERRUPTED')
    assert.equal(runnerMocks.startExecution.mock.calls.length, 1)
  })
})

describe('resolveScriptTaskConcurrency', () => {
  it('uses a valid task override', () => {
    assert.equal(resolveTaskConcurrency({ concurrency: 6 }), 6)
  })

  it('falls back to the legacy limit for missing or invalid metadata', () => {
    assert.equal(resolveTaskConcurrency({}), DEFAULT_SCRIPT_TASK_CONCURRENCY)
    assert.equal(resolveTaskConcurrency({ concurrency: 0 }), DEFAULT_SCRIPT_TASK_CONCURRENCY)
    assert.equal(resolveTaskConcurrency({ concurrency: 1.5 }), DEFAULT_SCRIPT_TASK_CONCURRENCY)
  })
})

describe('startLeaseWithRetry', () => {
  const input = {
    taskLogId: 'task-log',
    triggerType: 'once' as const,
    scheduledAt: '2026-07-23T01:00:00.000Z',
  }

  it('retries transient failures with the same task log ID', async () => {
    vi.useFakeTimers()
    const startExecution = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockRejectedValueOnce(new AiAgentHttpError(503, 'service unavailable'))
      .mockResolvedValue({
        acquired: true,
        leaseToken: 'lease-token',
        occurrenceId: input.scheduledAt,
      })

    const resultPromise = startLeaseWithRetry(
      1,
      input,
      new AbortController().signal,
      startExecution,
    )
    await vi.runAllTimersAsync()
    const result = await resultPromise

    assert.equal(result.acquired, true)
    assert.equal(startExecution.mock.calls.length, 3)
    for (const call of startExecution.mock.calls) {
      assert.equal(call[0], 1)
      assert.equal(call[1], input)
    }
  })

  it('does not retry client or application errors', async () => {
    for (const error of [
      new AiAgentHttpError(400, 'invalid request'),
      new AiAgentHttpError(200, 'application error', { code: 40001 }),
    ]) {
      const startExecution = vi.fn().mockRejectedValue(error)
      await assert.rejects(startLeaseWithRetry(
        1,
        input,
        new AbortController().signal,
        startExecution,
      ), error)
      assert.equal(startExecution.mock.calls.length, 1)
    }
  })

  it('does not retry a business conflict response', async () => {
    const startExecution = vi.fn().mockResolvedValue({
      acquired: false,
      reason: 'already_claimed',
    })

    const result = await startLeaseWithRetry(
      1,
      input,
      new AbortController().signal,
      startExecution,
    )

    assert.deepEqual(result, { acquired: false, reason: 'already_claimed' })
    assert.equal(startExecution.mock.calls.length, 1)
  })

  it('fails after three transient errors', async () => {
    vi.useFakeTimers()
    const error = new Error('network unavailable')
    const startExecution = vi.fn().mockRejectedValue(error)
    const resultPromise = startLeaseWithRetry(
      1,
      input,
      new AbortController().signal,
      startExecution,
    )
    const rejection = assert.rejects(resultPromise, error)

    await vi.runAllTimersAsync()
    await rejection
    assert.equal(startExecution.mock.calls.length, 3)
  })

  it('does not start another attempt after the task is aborted', async () => {
    vi.useFakeTimers()
    const abortController = new AbortController()
    const startExecution = vi.fn().mockRejectedValue(new Error('network unavailable'))
    const resultPromise = startLeaseWithRetry(
      1,
      input,
      abortController.signal,
      startExecution,
    )
    const rejection = assert.rejects(resultPromise, /stopped/)

    await vi.waitFor(() => assert.equal(startExecution.mock.calls.length, 1))
    abortController.abort(new Error('Task stopped'))
    await vi.runAllTimersAsync()
    await rejection
    assert.equal(startExecution.mock.calls.length, 1)
  })
})

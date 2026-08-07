import type { ScriptExecutionPlan } from './script'
import assert from 'node:assert/strict'
import { beforeEach, describe, it, vi } from 'vitest'
import { executeScriptTask } from './script'

const mocks = vi.hoisted(() => ({
  publishTaskMonitorTaskFinished: vi.fn(),
  publishTaskMonitorTaskStarted: vi.fn(),
  persistTaskArtifacts: vi.fn(),
  recordTaskExecutionEvent: vi.fn(),
  startSandboxScriptRun: vi.fn(),
  taskArtifacts: vi.fn(),
  closeTaskBrowserWindows: vi.fn(),
}))

vi.mock('@/core/task-monitor', () => ({
  publishTaskMonitorTaskFinished: mocks.publishTaskMonitorTaskFinished,
  publishTaskMonitorTaskStarted: mocks.publishTaskMonitorTaskStarted,
}))

vi.mock('@/services/taskArtifacts', () => ({
  persistTaskArtifacts: mocks.persistTaskArtifacts,
}))

vi.mock('@/services/taskExecutionDetails', () => ({
  recordTaskExecutionEvent: mocks.recordTaskExecutionEvent,
  taskArtifacts: mocks.taskArtifacts,
}))

vi.mock('@/services/sandboxService', () => ({
  startSandboxScriptRun: mocks.startSandboxScriptRun,
}))

vi.mock('../windowLifecycle', () => ({
  closeTaskBrowserWindows: mocks.closeTaskBrowserWindows,
}))

function plan(runIds: string[], concurrency = 20): ScriptExecutionPlan {
  return {
    taskLogId: 'task-log-1',
    taskName: 'Daily report',
    prepared: {
      scriptPath: '/tmp/task.js',
      assetSlug: 'task-script',
      sha512: 'sha512',
    },
    windows: runIds.map((_, index) => ({
      id: index + 1,
      dirId: `window-${index + 1}`,
    })),
    scriptRuns: runIds.map((runId, index) => ({
      dirId: `window-${index + 1}`,
      slug: 'task-script',
      runId,
      fileIds: [],
    })),
    params: {},
    concurrency,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.persistTaskArtifacts.mockResolvedValue({ fileIds: [], failedFiles: [] })
  mocks.taskArtifacts.mockReturnValue([])
  mocks.closeTaskBrowserWindows.mockImplementation(async (windows: Array<{ dirId: string }>) =>
    windows.map(window => window.dirId))
})

describe('script task error codes', () => {
  it('starts the next window when any active window finishes', async () => {
    const finishers = new Map<string, () => void>()
    mocks.startSandboxScriptRun.mockImplementation(() => ({
      finished: new Promise((resolve) => {
        const runId = mocks.startSandboxScriptRun.mock.calls.at(-1)?.[0].runId as string
        finishers.set(runId, () => resolve({ status: 'done', artifacts: [], outputs: [] }))
      }),
    }))

    const execution = executeScriptTask(
      plan(['run-1', 'run-2', 'run-3', 'run-4', 'run-5'], 2),
      new AbortController().signal,
    )

    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 2))
    const firstRunId = mocks.startSandboxScriptRun.mock.calls[0]?.[0].runId as string
    const secondRunId = mocks.startSandboxScriptRun.mock.calls[1]?.[0].runId as string
    finishers.get(firstRunId)?.()
    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 3))
    assert.equal(mocks.startSandboxScriptRun.mock.calls[2]?.[0].dirId, 'window-3')
    finishers.get(secondRunId)?.()
    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 4))
    finishers.get(mocks.startSandboxScriptRun.mock.calls[2]?.[0].runId as string)?.()
    finishers.get(mocks.startSandboxScriptRun.mock.calls[3]?.[0].runId as string)?.()
    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 5))
    finishers.get(mocks.startSandboxScriptRun.mock.calls[4]?.[0].runId as string)?.()

    const result = await execution
    assert.equal(result.status, 'success')
    assert.deepEqual(mocks.closeTaskBrowserWindows.mock.calls.map(call => call[0][0].dirId), [
      'window-1',
      'window-2',
      'window-3',
      'window-4',
      'window-5',
    ])
  })

  it('waits for window cleanup before filling the freed concurrency slot', async () => {
    let releaseClose: (() => void) | undefined
    mocks.closeTaskBrowserWindows.mockImplementationOnce(() => new Promise((resolve) => {
      releaseClose = () => resolve(['window-1'])
    }))
    mocks.startSandboxScriptRun.mockResolvedValue({
      finished: Promise.resolve({ status: 'done', artifacts: [], outputs: [] }),
    })

    const execution = executeScriptTask(plan(['run-1', 'run-2', 'run-3'], 2), new AbortController().signal)
    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 2))
    await vi.waitFor(() => assert.equal(mocks.closeTaskBrowserWindows.mock.calls.length, 1))
    assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 2)
    releaseClose?.()
    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 3))
    await execution
  })

  it('does not start a later batch after the task is interrupted', async () => {
    const abortController = new AbortController()
    const finishers: Array<() => void> = []
    mocks.startSandboxScriptRun.mockImplementation(() => ({
      finished: new Promise((resolve) => {
        finishers.push(() => resolve({ status: 'done', artifacts: [], outputs: [] }))
      }),
    }))

    const execution = executeScriptTask(
      plan(['run-1', 'run-2', 'run-3'], 2),
      abortController.signal,
    )

    await vi.waitFor(() => assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 2))
    abortController.abort()
    finishers.splice(0, 2).forEach(finish => finish())

    const result = await execution
    assert.equal(result.status, 'interrupted')
    assert.equal(mocks.startSandboxScriptRun.mock.calls.length, 2)
  })

  it('publishes the task lifecycle and delegates per-window monitoring to the sandbox service', async () => {
    mocks.startSandboxScriptRun.mockResolvedValue({
      browserUrl: 'ws://127.0.0.1/devtools/browser/1',
      browserType: 'chromium',
      finished: Promise.resolve({ status: 'done', artifacts: [], outputs: [] }),
    })

    await executeScriptTask(plan(['run-1']), new AbortController().signal)

    assert.deepEqual(mocks.publishTaskMonitorTaskStarted.mock.calls[0], [{
      taskId: 'task-log-1',
      title: 'Daily report',
      sourceType: 'script',
      runId: 'task-log-1',
    }])
    assert.deepEqual(mocks.startSandboxScriptRun.mock.calls[0]?.[0].taskMonitor, {
      taskId: 'task-log-1',
      browserId: 'window-1',
      label: 'window-1',
      input: { dirId: 'window-1', runId: 'run-1' },
    })
    assert.deepEqual(mocks.publishTaskMonitorTaskFinished.mock.calls[0], ['task-log-1'])
  })

  it('uses a stable code when every script run fails', async () => {
    mocks.startSandboxScriptRun.mockResolvedValue({
      finished: Promise.resolve({ status: 'failed' }),
    })

    const result = await executeScriptTask(plan(['run-1']), new AbortController().signal)

    assert.equal(result.status, 'failed')
    assert.equal(result.endReasonCode, 'SCRIPT_EXECUTION_FAILED')
  })

  it('treats LoginRequired as a failed script task and exposes the return value in the window log', async () => {
    mocks.startSandboxScriptRun.mockResolvedValue({
      finished: Promise.resolve({
        status: 'failed',
        returnValue: 'LoginRequired',
        artifacts: [],
        outputs: [],
      }),
    })

    const result = await executeScriptTask(plan(['run-1']), new AbortController().signal)

    assert.equal(result.status, 'failed')
    assert.equal(result.endReasonCode, 'SCRIPT_EXECUTION_FAILED')
    assert.equal(mocks.persistTaskArtifacts.mock.calls.length, 0)
    assert.deepEqual(
      mocks.recordTaskExecutionEvent.mock.calls.map(call => call[1]).filter(event =>
        event.type === 'script.log.append' || event.type === 'script.window.finished',
      ),
      [
        { type: 'script.log.append', windowKey: 'window-1', text: 'LoginRequired\n' },
        {
          type: 'script.window.finished',
          windowKey: 'window-1',
          status: 'failed',
          failedFiles: [],
        },
      ],
    )
  })

  it('uses a stable code when only some windows fail', async () => {
    mocks.startSandboxScriptRun
      .mockResolvedValueOnce({
        finished: Promise.resolve({ status: 'done', artifacts: [], outputs: [] }),
      })
      .mockResolvedValueOnce({
        finished: Promise.resolve({ status: 'failed' }),
      })

    const result = await executeScriptTask(
      plan(['run-1', 'run-2']),
      new AbortController().signal,
    )

    assert.equal(result.status, 'partial_failed')
    assert.equal(result.endReasonCode, 'PARTIAL_WINDOW_FAILURE')
  })

  it('treats LoginRequired in one of several windows as a partial failure', async () => {
    mocks.startSandboxScriptRun
      .mockResolvedValueOnce({
        finished: Promise.resolve({ status: 'done', artifacts: [], outputs: [] }),
      })
      .mockResolvedValueOnce({
        finished: Promise.resolve({
          status: 'failed',
          returnValue: 'LoginRequired',
          artifacts: [],
          outputs: [],
        }),
      })

    const result = await executeScriptTask(
      plan(['run-1', 'run-2']),
      new AbortController().signal,
    )

    assert.equal(result.status, 'partial_failed')
    assert.equal(result.endReasonCode, 'PARTIAL_WINDOW_FAILURE')
    assert.equal(mocks.persistTaskArtifacts.mock.calls.length, 1)
  })

  it('uses a stable code when artifact upload is incomplete', async () => {
    mocks.startSandboxScriptRun.mockResolvedValue({
      finished: Promise.resolve({ status: 'done', artifacts: [], outputs: [] }),
    })
    mocks.persistTaskArtifacts.mockResolvedValue({
      fileIds: ['file-1'],
      failedFiles: ['/tmp/output.txt'],
    })

    const result = await executeScriptTask(plan(['run-1']), new AbortController().signal)

    assert.equal(result.status, 'failed')
    assert.equal(result.endReasonCode, 'ARTIFACT_UPLOAD_PARTIAL_FAILURE')
    assert.deepEqual(result.fileIds, [])
    assert.deepEqual(result.scriptRuns, [{
      dirId: 'window-1',
      slug: 'task-script',
      runId: 'run-1',
      fileIds: ['file-1'],
    }])
  })

  it('stores uploaded files on the matching window script run', async () => {
    mocks.startSandboxScriptRun.mockResolvedValue({
      finished: Promise.resolve({ status: 'done', artifacts: [], outputs: [] }),
    })
    mocks.persistTaskArtifacts
      .mockResolvedValueOnce({ fileIds: ['file-1'], failedFiles: [] })
      .mockResolvedValueOnce({ fileIds: ['file-2'], failedFiles: [] })

    const result = await executeScriptTask(
      plan(['run-1', 'run-2']),
      new AbortController().signal,
    )

    assert.equal(result.status, 'success')
    assert.deepEqual(result.fileIds, [])
    assert.deepEqual(result.scriptRuns?.map(run => ({
      dirId: run.dirId,
      runId: run.runId,
      fileIds: run.fileIds,
    })), [
      { dirId: 'window-1', runId: 'run-1', fileIds: ['file-1'] },
      { dirId: 'window-2', runId: 'run-2', fileIds: ['file-2'] },
    ])
  })

  it('does not expose an internal abort reason', async () => {
    const abortController = new AbortController()
    abortController.abort(new Error('internal English abort reason'))

    const result = await executeScriptTask(plan(['run-1']), abortController.signal)

    assert.equal(result.status, 'interrupted')
    assert.equal(result.endReasonCode, 'TASK_INTERRUPTED')
  })
})

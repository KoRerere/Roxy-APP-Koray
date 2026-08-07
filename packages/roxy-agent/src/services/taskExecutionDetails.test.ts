import type { TaskLog } from '@/database/tasks'
import { createAgentPaths } from '@roxy/shared/agent-paths'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, vi } from 'vitest'
import {
  readTaskScriptRunLog,
  replayTaskExecutionFromLocalStorage,
  TaskExecutionDetailHub,
} from './taskExecutionDetails'

function taskLog(overrides: Partial<TaskLog> = {}): TaskLog {
  return {
    id: 'log-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    task_id: 1,
    task_name: 'Task',
    template_id: 2,
    template_name: 'Template',
    template_type: 'script',
    trigger_type: 'manual',
    occurrence_id: null,
    scheduled_at: null,
    input: {},
    window_dir_ids: ['window-1'],
    script_runs: [{
      dirId: 'window-1',
      slug: 'report-script',
      runId: 'run-1',
      fileIds: ['file-1'],
    }],
    conversation_id: null,
    file_ids: [],
    status: 'success',
    started_at: '2026-07-24T01:00:00.000Z',
    ended_at: '2026-07-24T01:01:00.000Z',
    end_reason_code: null,
    ...overrides,
  }
}

describe('taskExecutionDetailHub', () => {
  it('broadcasts every increment and replays the complete task process', () => {
    const hub = new TaskExecutionDetailHub()
    const subscriber = vi.fn()
    hub.subscribe(subscriber)

    hub.append('log-1', {
      type: 'script.window.started',
      window: { key: 'window-1', dirId: 'window-1', runId: 'run-1', label: '1' },
    })
    hub.append('log-1', {
      type: 'script.log.append',
      windowKey: 'window-1',
      text: '执行中\n',
    })

    assert.deepEqual(subscriber.mock.calls.map(call => call[0].sequence), [1, 2])
    assert.deepEqual(hub.replay('log-1').events.map(event => event.sequence), [1, 2])
    assert.deepEqual(hub.replay('log-1', 1).events.map(event => event.sequence), [2])
    assert.equal(hub.replay('log-1').revision, 2)
  })

  it('keeps independent sequences per task and clears deleted task details', () => {
    const hub = new TaskExecutionDetailHub()
    hub.append('log-1', {
      type: 'artifacts.updated',
      artifacts: [],
    })
    hub.append('log-2', {
      type: 'artifacts.updated',
      artifacts: [],
    })

    assert.equal(hub.replay('log-1').revision, 1)
    assert.equal(hub.replay('log-2').revision, 1)
    hub.delete('log-1')
    assert.deepEqual(hub.replay('log-1'), { taskLogId: 'log-1', revision: 0, events: [] })
  })

  it('keeps replay data when a WebSocket observer is unavailable', () => {
    const hub = new TaskExecutionDetailHub()
    hub.subscribe(() => {
      throw new Error('socket unavailable')
    })

    assert.doesNotThrow(() => hub.append('log-1', {
      type: 'artifacts.updated',
      artifacts: [],
    }))
    assert.equal(hub.replay('log-1').revision, 1)
  })

  it('restores a local replay baseline and continues its event sequence', () => {
    const hub = new TaskExecutionDetailHub()
    hub.restore({
      taskLogId: 'log-1',
      revision: 1,
      events: [{
        taskLogId: 'log-1',
        sequence: 1,
        createdAt: '2026-07-24T01:00:00.000Z',
        payload: { type: 'artifacts.updated', artifacts: [] },
      }],
    })

    const next = hub.append('log-1', {
      type: 'script.log.append',
      windowKey: 'window-1',
      text: 'continued\n',
    })

    assert.equal(next.sequence, 2)
    assert.equal(hub.replay('log-1').revision, 2)
  })
})

describe('local task execution replay', () => {
  it('reads each script window log from the durable workdir file', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-task-replay-'))
    const paths = createAgentPaths(tempDir)
    const log = taskLog()
    const run = log.script_runs[0]!
    const logFilePath = paths.workdirRunLogFile(run.slug, run.runId, new Date(log.started_at))
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true })
    fs.writeFileSync(logFilePath, 'persisted script output\n')

    try {
      const replay = replayTaskExecutionFromLocalStorage(log, {
        getConversationMessages: () => [],
        readScriptRunLog: (scriptRun, startedAt) =>
          readTaskScriptRunLog(scriptRun, startedAt, paths),
        describeArtifacts: fileIds => fileIds.map(fileId => ({
          fileId,
          fileName: `${fileId}.txt`,
          mimeType: 'text/plain',
          size: 12,
        })),
      })

      assert.equal(replay.revision, 4)
      assert.deepEqual(replay.events.map(event => event.payload.type), [
        'script.window.started',
        'script.log.replace',
        'artifacts.updated',
        'script.window.finished',
      ])
      assert.deepEqual(replay.events[1]?.payload, {
        type: 'script.log.replace',
        windowKey: 'window-1',
        text: 'persisted script output\n',
      })
      assert.deepEqual(replay.events[2]?.payload, {
        type: 'artifacts.updated',
        windowKey: 'window-1',
        artifacts: [{
          fileId: 'file-1',
          fileName: 'file-1.txt',
          mimeType: 'text/plain',
          size: 12,
        }],
      })
    }
    finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('rebuilds agent messages and artifacts from local conversation records', () => {
    const log = taskLog({
      template_type: 'prompt',
      script_runs: [],
      conversation_id: 'conversation-1',
      file_ids: ['file-1'],
    })
    const replay = replayTaskExecutionFromLocalStorage(log, {
      getConversationMessages: () => [
        { id: 'system-1', role: 'system', content: 'hidden', created_at: '2026-07-24T01:00:00.000Z' },
        { id: 'user-1', role: 'user', content: '开始任务', created_at: '2026-07-24T01:00:01.000Z' },
        { id: 'assistant-1', role: 'assistant', content: '任务完成', created_at: '2026-07-24T01:00:02.000Z' },
      ],
      readScriptRunLog: () => '',
      describeArtifacts: fileIds => fileIds.map(fileId => ({
        fileId,
        fileName: 'result.txt',
        mimeType: 'text/plain',
        size: 20,
      })),
    })

    assert.equal(replay.revision, 3)
    assert.deepEqual(replay.events.map(event => event.payload.type), [
      'agent.message.upsert',
      'agent.message.upsert',
      'artifacts.updated',
    ])
    assert.equal(replay.events[0]?.payload.type === 'agent.message.upsert'
      ? replay.events[0].payload.message.content
      : undefined, '开始任务')
    assert.equal(replay.events[1]?.payload.type === 'agent.message.upsert'
      ? replay.events[1].payload.message.content
      : undefined, '任务完成')
  })
})

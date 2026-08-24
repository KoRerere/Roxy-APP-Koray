import type { AgentChannelCommands } from './server'
import type { TaskLog, TaskLogStoreEvent } from '@/database/tasks'
import type {
  AgentChannelMessage,
  AgentConversationRunEventDTO,
  AgentProfileMonitorSnapshot,
  AgentTaskExecutionEvent,
  AgentTaskMonitorSnapshot,
} from '@roxy/shared/channel'
import type { AddressInfo } from 'node:net'
import { AgentChannelMessageSchema } from '@roxy/shared/channel'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { afterEach, describe, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { AgentChannelServer } from './server'

function assertUuidV7(value: string): void {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
}

function taskLog(status: TaskLog['status']): TaskLog {
  return {
    id: 'log-1',
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    task_id: 11,
    task_name: 'Daily report',
    template_id: 21,
    template_name: 'Report script',
    template_type: 'script',
    trigger_type: 'manual',
    occurrence_id: null,
    scheduled_at: null,
    input: {},
    window_dir_ids: [],
    script_runs: [],
    conversation_id: null,
    file_ids: [],
    status,
    started_at: '2026-07-24T01:00:00.000Z',
    ended_at: null,
    end_reason_code: null,
  }
}

function monitorSnapshot(): AgentTaskMonitorSnapshot {
  return {
    type: 'snapshot',
    data: {
      generatedAt: Date.now(),
      tasks: [],
    },
  }
}

function profileSnapshot(): AgentProfileMonitorSnapshot {
  return {
    type: 'snapshot',
    data: {
      generatedAt: Date.now(),
      profiles: [{
        dirId: 'dir-1',
        status: 'idle',
        connectedAt: 1,
        updatedAt: 1,
        idleSince: 1,
        events: [],
      }],
    },
  }
}

describe('agentChannelServer', () => {
  const resources: Array<() => Promise<void>> = []

  afterEach(async () => {
    await Promise.allSettled(resources.splice(0).map(close => close()))
  })

  it('sends initial snapshots and pushes task changes with UUIDv7 message IDs', async () => {
    let taskMonitorSubscriber: ((snapshot: AgentTaskMonitorSnapshot) => void) | undefined
    let profileMonitorSubscriber: ((snapshot: AgentProfileMonitorSnapshot) => void) | undefined
    let taskLogSubscriber: ((event: TaskLogStoreEvent) => void) | undefined
    let taskExecutionSubscriber: ((event: AgentTaskExecutionEvent) => void) | undefined
    const snapshot = monitorSnapshot()
    const server = createServer()
    const channel = new AgentChannelServer(server, {
      taskMonitor: {
        getSnapshot: () => snapshot,
        getProfileSnapshot: profileSnapshot,
        subscribe: (callback) => {
          taskMonitorSubscriber = callback
          return () => {
            taskMonitorSubscriber = undefined
          }
        },
        subscribeProfiles: (callback) => {
          profileMonitorSubscriber = callback
          return () => {
            profileMonitorSubscriber = undefined
          }
        },
      },
      taskLogs: {
        subscribe: (callback) => {
          taskLogSubscriber = callback
          return () => {
            taskLogSubscriber = undefined
          }
        },
      },
      taskExecution: {
        subscribe: (callback) => {
          taskExecutionSubscriber = callback
          return () => {
            taskExecutionSubscriber = undefined
          }
        },
      },
      getTaskLogSnapshot: () => [],
    }, 20)
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve)
      server.once('error', reject)
    })
    resources.push(async () => {
      await channel.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
    })

    const port = (server.address() as AddressInfo).port
    const client = new WebSocket(`ws://127.0.0.1:${port}/api/events`)
    const messages: AgentChannelMessage[] = []
    client.on('message', data => messages.push(AgentChannelMessageSchema.parse(JSON.parse(data.toString()))))
    resources.unshift(async () => {
      if (client.readyState === WebSocket.OPEN) {
        client.close()
      }
    })

    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve)
      client.once('error', reject)
    })
    await vi.waitFor(() => assert.equal(messages.length, 5))
    assert.deepEqual(messages.map(message => message.type), [
      'task_logs.snapshot',
      'task_monitor.snapshot',
      'profile_monitor.snapshot',
      'execution_center.snapshot',
      'channel.ready',
    ])
    for (const message of messages) {
      assertUuidV7(message.id)
    }

    taskLogSubscriber?.({ type: 'changed', log: taskLog('running') })
    taskMonitorSubscriber?.(monitorSnapshot())
    profileMonitorSubscriber?.(profileSnapshot())
    await vi.waitFor(() => assert.equal(messages.length, 8))
    assert.equal(messages[5].type, 'task_log.changed')
    assert.equal(messages[6].type, 'task_monitor.snapshot')
    assert.equal(messages[7].type, 'profile_monitor.snapshot')

    taskExecutionSubscriber?.({
      taskLogId: 'log-1',
      sequence: 1,
      createdAt: '2026-07-24T01:00:01.000Z',
      payload: {
        type: 'script.log.append',
        windowKey: 'window-1',
        text: 'started\n',
      },
    })
    await vi.waitFor(() => assert.equal(messages.length, 9))
    assert.equal(messages[8].type, 'task_execution.event')

    taskLogSubscriber?.({ type: 'deleted', logId: 'log-1' })
    await vi.waitFor(() => assert.equal(messages.length, 10))
    assert.deepEqual(messages[9], {
      id: messages[9]?.id,
      type: 'task_log.deleted',
      data: { logId: 'log-1' },
    })
    for (const message of messages) {
      assertUuidV7(message.id)
    }

    await new Promise(resolve => setTimeout(resolve, 60))
    assert.equal(client.readyState, WebSocket.OPEN)
  })

  it('does not announce readiness before storage migration completes', async () => {
    let completeMigration: (() => void) | undefined
    let taskLogSubscriber: ((event: TaskLogStoreEvent) => void) | undefined
    const migrationReady = new Promise<void>((resolve) => {
      completeMigration = resolve
    })
    const server = createServer()
    const channel = new AgentChannelServer(server, {
      taskMonitor: {
        getSnapshot: monitorSnapshot,
        subscribe: () => () => {},
      },
      taskLogs: {
        subscribe: (callback) => {
          taskLogSubscriber = callback
          return () => {
            taskLogSubscriber = undefined
          }
        },
      },
      taskExecution: { subscribe: () => () => {} },
      getTaskLogSnapshot: () => [],
    }, 1_000, () => migrationReady)
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve)
      server.once('error', reject)
    })
    resources.push(async () => {
      await channel.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
    })

    const port = (server.address() as AddressInfo).port
    const client = new WebSocket(`ws://127.0.0.1:${port}/api/events`)
    const messages: AgentChannelMessage[] = []
    client.on('message', data => messages.push(AgentChannelMessageSchema.parse(JSON.parse(data.toString()))))
    resources.unshift(async () => {
      if (client.readyState === WebSocket.OPEN) {
        client.close()
      }
    })

    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve)
      client.once('error', reject)
    })
    taskLogSubscriber?.({ type: 'changed', log: taskLog('running') })
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(messages.length, 0)

    completeMigration?.()
    await vi.waitFor(() => assert.equal(messages.length, 5))
    assert.deepEqual(messages.map(message => message.type), [
      'task_logs.snapshot',
      'task_monitor.snapshot',
      'execution_center.snapshot',
      'task_log.changed',
      'channel.ready',
    ])
    assert.equal(messages.at(-1)?.type, 'channel.ready')
  })

  it('closes without readiness when an initial snapshot cannot be created', async () => {
    const server = createServer()
    const channel = new AgentChannelServer(server, {
      taskMonitor: {
        getSnapshot: monitorSnapshot,
        subscribe: () => () => {},
      },
      taskLogs: {
        subscribe: () => () => {},
      },
      taskExecution: { subscribe: () => () => {} },
      getTaskLogSnapshot: () => {
        throw new Error('database unavailable')
      },
    })
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve)
      server.once('error', reject)
    })
    resources.push(async () => {
      await channel.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
    })

    const port = (server.address() as AddressInfo).port
    const client = new WebSocket(`ws://127.0.0.1:${port}/api/events`)
    const messages: AgentChannelMessage[] = []
    client.on('message', data => messages.push(AgentChannelMessageSchema.parse(JSON.parse(data.toString()))))

    const closeCode = await new Promise<number>((resolve, reject) => {
      client.once('close', resolve)
      client.once('error', reject)
    })
    assert.equal(closeCode, 1011)
    assert.deepEqual(messages, [])
  })

  it('pushes conversation events and accepts stop commands before readiness', async () => {
    let conversationSubscriber: ((event: AgentConversationRunEventDTO) => void) | undefined
    const replayEvent: AgentConversationRunEventDTO = {
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      sequence: 1,
      timestamp: 99,
      event: {
        type: 'run_started',
        data: {
          source: 'user',
          assistantMessageId: 'assistant-1',
          startedAt: 99,
        },
      },
    }
    let stopBeforeReady = false
    const commands: AgentChannelCommands = {
      startRun: vi.fn(async () => {
        throw new Error('start failed')
      }),
      stopRun: vi.fn(() => {
        stopBeforeReady = true
      }),
      submitApproval: vi.fn(),
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let completeReadiness: (() => void) | undefined
    const readiness = new Promise<void>((resolve) => {
      completeReadiness = resolve
    })
    const server = createServer()
    const channel = new AgentChannelServer(server, {
      taskMonitor: {
        getSnapshot: monitorSnapshot,
        subscribe: () => () => {},
      },
      taskLogs: { subscribe: () => () => {} },
      taskExecution: { subscribe: () => () => {} },
      conversationRuns: {
        getActiveEvents: () => [replayEvent],
        subscribe: (callback) => {
          conversationSubscriber = callback
          return () => {
            conversationSubscriber = undefined
          }
        },
      },
      getTaskLogSnapshot: () => [],
    }, 1_000, () => readiness, commands)
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve)
      server.once('error', reject)
    })
    resources.push(async () => {
      warn.mockRestore()
      await channel.close()
      await new Promise<void>(resolve => server.close(() => resolve()))
    })

    const port = (server.address() as AddressInfo).port
    const client = new WebSocket(`ws://127.0.0.1:${port}/api/events`)
    const messages: AgentChannelMessage[] = []
    client.on('message', data => messages.push(AgentChannelMessageSchema.parse(JSON.parse(data.toString()))))
    resources.unshift(async () => {
      if (client.readyState === WebSocket.OPEN) {
        client.close()
      }
    })
    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve)
      client.once('error', reject)
    })
    client.send(JSON.stringify({
      id: 'request-stop-before-ready',
      type: 'conversation.run.stop',
      data: { conversationId: 'conversation-1' },
    }))
    client.send(JSON.stringify({
      id: 'request-start-before-ready',
      type: 'conversation.run.start',
      data: {
        conversationId: 'conversation-1',
        message: 'Do not start before snapshots are ready',
      },
    }))
    await vi.waitFor(() => assert.equal(vi.mocked(commands.stopRun).mock.calls.length, 1))
    assert.equal(stopBeforeReady, true)
    assert.equal(vi.mocked(commands.startRun).mock.calls.length, 0)
    completeReadiness?.()
    await vi.waitFor(() => assert.equal(messages.at(-1)?.type, 'channel.ready'))
    assert.deepEqual(messages.map(message => message.type), [
      'conversation.run.event',
      'task_logs.snapshot',
      'task_monitor.snapshot',
      'execution_center.snapshot',
      'channel.ready',
    ])
    assert.deepEqual(messages.find(message => message.type === 'conversation.run.event')?.data, replayEvent)

    const event: AgentConversationRunEventDTO = {
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      sequence: 2,
      timestamp: 100,
      event: {
        type: 'user_message',
        data: {
          messageId: 'turn-1',
          content: 'hello',
          attachments: [],
          createdAt: 100,
        },
      },
    }
    conversationSubscriber?.(event)
    await vi.waitFor(() => assert.deepEqual(messages.at(-1)?.data, event))

    const scriptEvent: AgentConversationRunEventDTO = {
      ...event,
      sequence: 3,
      timestamp: 101,
      event: {
        type: 'script_output',
        data: {
          scriptName: 'report',
          level: 'info',
          message: 'processing row 1',
          scriptRunId: 'script-run-1',
          workerId: 'worker-1',
        },
      },
    }
    conversationSubscriber?.(scriptEvent)
    await vi.waitFor(() => assert.deepEqual(messages.at(-1)?.data, scriptEvent))

    client.send(JSON.stringify({
      id: 'request-start',
      type: 'conversation.run.start',
      data: {
        conversationId: 'conversation-1',
        message: 'Run the report',
        attachments: [{ fileId: 'file-1' }],
        localAttachments: [{
          kind: 'file',
          fileName: 'screen.png',
          mimeType: 'image/png',
          localPath: '/tmp/screen.png',
        }],
        fullAccess: true,
      },
    }))
    client.send(JSON.stringify({
      id: 'request-approval',
      type: 'conversation.approval.submit',
      data: {
        conversationId: 'conversation-1',
        approvalId: 'approval-1',
        decisions: [{ type: 'approve' }],
        fullAccess: true,
      },
    }))
    client.send('{')
    client.send(JSON.stringify({
      id: 'invalid-empty-message',
      type: 'conversation.run.start',
      data: { conversationId: 'conversation-1', message: '   ' },
    }))
    client.send(Buffer.from(JSON.stringify({
      id: 'binary-stop',
      type: 'conversation.run.stop',
      data: { conversationId: 'conversation-1' },
    })))
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(vi.mocked(commands.startRun).mock.calls.length, 1)
    assert.deepEqual(vi.mocked(commands.startRun).mock.calls[0]?.[0].data.localAttachments, [{
      kind: 'file',
      fileName: 'screen.png',
      mimeType: 'image/png',
      localPath: '/tmp/screen.png',
    }])
    assert.equal(vi.mocked(commands.stopRun).mock.calls.length, 1)
    assert.equal(vi.mocked(commands.submitApproval).mock.calls.length, 1)
    assert.equal(vi.mocked(commands.submitApproval).mock.calls[0]?.[0].data.fullAccess, true)
    assert.equal(warn.mock.calls.some(call => String(call[0]).includes('conversation.run.start')), true)
  })
})

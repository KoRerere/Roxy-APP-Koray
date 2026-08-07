import assert from 'node:assert/strict'
import test from 'node:test'
import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import { buildProcessFromEvents, mapHistoryConversation, mapHistoryMessages } from './historyAdapter'

(globalThis as typeof globalThis & { $t: (key: string) => string }).$t = key => key

function runEvent(sequence: number, event: AgentRunEvent, timestamp = 1000 + sequence): AgentConversationRunEventDTO {
  return {
    conversationId: 'conversation-1',
    runId: 'run-1',
    turnId: 'message-user',
    assistantMessageId: 'message-assistant',
    sequence,
    timestamp,
    event,
  }
}

test('script outputs are process events and default to collapsed', () => {
  const events = [
    runEvent(1, { type: 'run_started', data: { source: 'user', assistantMessageId: 'message-assistant', startedAt: 1000 } }),
    runEvent(2, { type: 'tool_started', data: { toolName: 'run_script', toolId: 'tool-1', input: {} } }),
    runEvent(3, { type: 'script_output', data: { toolId: 'tool-1', scriptName: '/scripts/cookie-robot.ts', level: 'info', message: 'running command' } }),
    runEvent(4, { type: 'tool_finished', data: { toolName: 'run_script', toolId: 'tool-1', output: 'done', status: 'success' } }),
    runEvent(5, { type: 'run_completed', data: { finalAnswer: 'done' } }),
  ]

  const parsed = buildProcessFromEvents('message-assistant', events)
  const scriptLog = parsed.process.events.find(event => event.type === 'script_log')

  assert.ok(scriptLog)
  assert.deepEqual(parsed.process.events.map(event => event.type), ['script_log', 'final_answer'])
  assert.equal(scriptLog.title, '运行脚本 /scripts/cookie-robot.ts')
  assert.equal(scriptLog.expanded, false)
  assert.equal(scriptLog.status, 'success')
  assert.equal(parsed.process.completed, true)
  assert.equal(parsed.process.collapsed, true)
})

test('script log is visible and running before script output or tool completion', () => {
  const parsed = buildProcessFromEvents('message-running-script', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'run_script', toolId: 'tool-1', target: 'cookie-robot', input: {} } }),
  ], { finalize: false })

  assert.deepEqual(parsed.process.events.map(event => event.type), ['script_log'])
  assert.equal(parsed.process.events[0]?.title, '运行脚本 cookie-robot')
  assert.equal(parsed.process.events[0]?.status, 'running')
})

test('agent failure events resolve display message and keep request id', () => {
  const parsed = buildProcessFromEvents('message-error', [
    runEvent(1, {
      type: 'run_failed',
      data: {
        code: 'insufficient_points',
        message: 'raw backend error',
        retryable: false,
        requestId: 'req-123',
      },
    }),
  ])

  assert.equal(parsed.status, 'error')
  assert.equal(parsed.content, '您的积分不足，请充值积分后重试。')
  assert.deepEqual(parsed.errorData, {
    code: 'insufficient_points',
    message: 'raw backend error',
    retryable: false,
    requestId: 'req-123',
  })
})

test('cancelled runs do not create user-facing error messages', () => {
  const parsed = buildProcessFromEvents('message-cancelled', [
    runEvent(1, { type: 'run_cancelled', data: { reason: 'user', message: 'User cancelled' } }),
  ])

  assert.equal(parsed.status, 'done')
  assert.equal(parsed.content, '')
  assert.equal(parsed.process.completed, false)
  assert.equal(parsed.process.collapsed, false)
  assert.equal(parsed.errorData, undefined)
})

test('unfinished streams do not promote the last content event or collapse the process', () => {
  const parsed = buildProcessFromEvents('message-unfinished', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'main', text: 'partial answer' } }),
  ], { finalize: false })

  assert.equal(parsed.content, '')
  assert.equal(parsed.status, 'streaming')
  assert.equal(parsed.process.completed, false)
  assert.equal(parsed.process.collapsed, false)
  assert.equal(parsed.process.events.some(event => event.type === 'content' && event.content === 'partial answer'), true)
})

test('keeps failed-attempt fragments visible while a network retry is still pending', () => {
  const parsed = buildProcessFromEvents('message-retrying', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'failed', text: 'partial answer' } }),
    runEvent(2, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }),
  ], { finalize: false })

  assert.equal(parsed.process.events.some(event => event.type === 'content' && event.content === 'partial answer'), true)
})

test('rolls back failed-attempt fragments when a retry produces replacement content', () => {
  const parsed = buildProcessFromEvents('message-retried', [
    runEvent(1, { type: 'thinking_delta', data: { thinkingId: 'failed-thinking', text: 'stale thinking' } }),
    runEvent(2, {
      type: 'thinking_completed',
      data: { thinkingId: 'failed-thinking', startTimestamp: 1001, endTimestamp: 1002, durationMs: 1 },
    }),
    runEvent(3, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }),
    runEvent(4, { type: 'content_delta', data: { contentId: 'success', text: 'fresh answer' } }),
    runEvent(5, { type: 'run_completed', data: {} }),
  ])

  assert.equal(parsed.content, 'fresh answer')
  assert.equal(parsed.process.events.some(event => event.type === 'thinking' && event.content.includes('stale')), false)
})

test('keeps incomplete content when the user stops during a pending retry', () => {
  const parsed = buildProcessFromEvents('message-stopped', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'failed', text: 'keep this partial answer' } }),
    runEvent(2, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }),
    runEvent(3, { type: 'run_cancelled', data: { reason: 'user' } }),
  ])

  assert.equal(parsed.process.events.some(event => event.type === 'content' && event.content === 'keep this partial answer'), true)
})

test('removes incomplete content when network retries are exhausted', () => {
  const parsed = buildProcessFromEvents('message-network-failed', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'failed', text: 'discard this partial answer' } }),
    runEvent(2, {
      type: 'run_failed',
      data: { code: 'network_interrupted', message: 'Network connection interrupted', retryable: true },
    }),
  ])

  assert.equal(parsed.process.events.some(event => event.type === 'content'), false)
  assert.equal(parsed.status, 'error')
})

test('worker events are grouped by workerId', () => {
  const parsed = buildProcessFromEvents('message-worker', [
    runEvent(1, { type: 'worker_dispatched', data: { workerId: 'worker-1', title: 'Collect data' } }),
    runEvent(2, { type: 'thinking_delta', data: { workerId: 'worker-1', thinkingId: 'think-1', text: 'Checking' } }),
    runEvent(3, { type: 'content_delta', data: { workerId: 'worker-1', contentId: 'content-1', text: 'Found it' } }),
    runEvent(4, { type: 'tool_started', data: { workerId: 'worker-1', toolName: 'run_script', toolId: 'tool-1', input: {} } }),
    runEvent(5, { type: 'script_output', data: { workerId: 'worker-1', toolId: 'tool-1', scriptName: 'collect-data', level: 'info', message: 'worker log' } }),
    runEvent(6, { type: 'tool_finished', data: { workerId: 'worker-1', toolName: 'run_script', toolId: 'tool-1', output: 'done', status: 'success' } }),
    runEvent(7, { type: 'worker_completed', data: { workerId: 'worker-1', status: 'success' } }),
    runEvent(8, { type: 'run_completed', data: {} }),
  ])

  const dispatch = parsed.process.events.find(event => event.type === 'parallel_dispatch')
  assert.ok(dispatch)
  assert.equal(dispatch.tasks.length, 1)
  assert.equal(dispatch.tasks[0]?.title, 'Collect data')
  assert.deepEqual(dispatch.tasks[0]?.events.map(event => event.type), ['thinking', 'content', 'script_log'])
  assert.equal(dispatch.tasks[0]?.events.find(event => event.type === 'script_log')?.lines[0]?.message, 'worker log')
  assert.equal(dispatch.tasks[0]?.events.find(event => event.type === 'script_log')?.status, 'success')
  assert.equal(dispatch.tasks[0]?.status, 'success')
})

test('network retry rollback is isolated to the matching worker', () => {
  const parsed = buildProcessFromEvents('message-worker-retry', [
    runEvent(1, { type: 'worker_dispatched', data: { workerId: 'worker-1', title: 'First worker' } }),
    runEvent(2, { type: 'worker_dispatched', data: { workerId: 'worker-2', title: 'Second worker' } }),
    runEvent(3, { type: 'content_delta', data: { contentId: 'root', text: 'root answer' } }),
    runEvent(4, { type: 'content_delta', data: { workerId: 'worker-1', contentId: 'failed', text: 'stale worker answer' } }),
    runEvent(5, { type: 'run_retrying', data: { workerId: 'worker-1', attempt: 1, maxAttempts: 5 } }),
    runEvent(6, { type: 'content_delta', data: { workerId: 'worker-2', contentId: 'second', text: 'second worker answer' } }),
    runEvent(7, { type: 'content_delta', data: { workerId: 'worker-1', contentId: 'fresh', text: 'fresh worker answer' } }),
    runEvent(8, { type: 'worker_completed', data: { workerId: 'worker-1', status: 'success' } }),
    runEvent(9, { type: 'worker_completed', data: { workerId: 'worker-2', status: 'success' } }),
    runEvent(10, { type: 'run_completed', data: {} }),
  ])

  const dispatch = parsed.process.events.find(event => event.type === 'parallel_dispatch')
  assert.ok(dispatch)
  const firstWorker = dispatch.tasks.find(worker => worker.id === 'worker-worker-1')
  const secondWorker = dispatch.tasks.find(worker => worker.id === 'worker-worker-2')
  assert.equal(firstWorker?.events.some(event => event.type === 'content' && event.content === 'stale worker answer'), false)
  assert.equal(firstWorker?.events.some(event => event.type === 'content' && event.content === 'fresh worker answer'), true)
  assert.equal(secondWorker?.events.some(event => event.type === 'content' && event.content === 'second worker answer'), true)
  assert.equal(parsed.content, 'root answer')
})

test('conversation history maps canonical events from the fixed camelCase detail contract', () => {
  const conversation = {
    id: 'conversation-1',
    title: 'Saved conversation',
    status: 'active' as const,
    latestRunId: 'run-1',
    latestRunStatus: 'completed' as const,
    unread: true,
    createdAt: 1_753_516_800_000,
    updatedAt: 1_753_516_860_000,
  }
  const detail = {
    conversation,
    messages: [
      { id: 'message-user', role: 'user' as const, content: 'hello', metadata: {}, createdAt: 1_753_516_800_000 },
      {
        id: 'message-assistant',
        role: 'assistant' as const,
        content: '',
        metadata: {},
        events: [
          runEvent(1, { type: 'content_delta', data: { contentId: 'answer', text: 'hi' } }),
          runEvent(2, { type: 'run_completed', data: {} }),
        ],
        createdAt: 1_753_516_860_000,
      },
    ],
    artifacts: [],
  }

  const mappedConversation = mapHistoryConversation(conversation)
  assert.equal(mappedConversation.title, 'Saved conversation')
  assert.equal(mappedConversation.latestRunId, 'run-1')
  assert.equal(mappedConversation.latestRunStatus, 'completed')
  assert.equal(mappedConversation.unread, true)
  assert.deepEqual(mapHistoryMessages(detail).map(message => ({
    id: message.id,
    conversationId: message.conversationId,
    runId: message.runId,
    role: message.role,
    content: message.content,
  })), [
    { id: 'message-user', conversationId: 'conversation-1', runId: undefined, role: 'user', content: 'hello' },
    { id: 'message-assistant', conversationId: 'conversation-1', runId: 'run-1', role: 'assistant', content: 'hi' },
  ])
})

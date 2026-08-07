import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import test from 'node:test'
import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import { appendConversationRunEvent, LocallyStoppedConversationRunRegistry, PendingConversationRunRegistry, reconcileConversationRunSummary, replaceConversationRunEvents, terminalRunStatus } from './conversation-run-state'

function event(sequence: number, type: AgentConversationRunEventDTO['event']['type']): AgentConversationRunEventDTO {
  const terminal = type === 'run_completed'
    ? { type, data: {} } as const
    : { type: 'content_delta', data: { contentId: 'content-1', text: `${sequence}` } } as const
  return {
    conversationId: 'conversation-1',
    runId: 'run-1',
    turnId: 'turn-1',
    assistantMessageId: 'assistant-1',
    sequence,
    timestamp: sequence,
    event: terminal,
  }
}

function compactedEvent(startSequence: number, sequence: number): AgentConversationRunEventDTO {
  return {
    ...event(sequence, 'content_delta'),
    startSequence,
  }
}

function contentEvent(sequence: number, contentId: string, text: string, workerId?: string): AgentConversationRunEventDTO {
  return {
    ...event(sequence, 'content_delta'),
    event: {
      type: 'content_delta',
      data: { contentId, text, workerId },
    },
  }
}

test('conversation run events deduplicate and report sequence gaps', () => {
  const stream = { runId: 'run-1', events: [] as AgentConversationRunEventDTO[], lastSequence: 0 }

  assert.equal(appendConversationRunEvent(stream, event(1, 'content_delta')), 'accepted')
  assert.equal(appendConversationRunEvent(stream, event(1, 'content_delta')), 'duplicate')
  assert.equal(appendConversationRunEvent(stream, event(3, 'content_delta')), 'gap')
  assert.equal(stream.lastSequence, 1)
  assert.equal(stream.events.length, 1)
})

test('history calibration restores a contiguous sequence before live events continue', () => {
  const stream = { runId: 'run-1', events: [] as AgentConversationRunEventDTO[], lastSequence: 0 }

  assert.equal(replaceConversationRunEvents(stream, [event(2, 'content_delta'), event(1, 'content_delta')]), true)
  assert.equal(stream.lastSequence, 2)
  assert.deepEqual(stream.events.map(item => item.sequence), [1, 2])
  assert.equal(appendConversationRunEvent(stream, event(3, 'content_delta')), 'accepted')
  assert.equal(replaceConversationRunEvents(stream, [event(1, 'content_delta'), event(3, 'content_delta')]), false)
})

test('compacted live blocks advance across their complete sequence range', () => {
  const stream = { runId: 'run-1', events: [] as AgentConversationRunEventDTO[], lastSequence: 0 }

  assert.equal(appendConversationRunEvent(stream, event(1, 'content_delta')), 'accepted')
  assert.equal(appendConversationRunEvent(stream, compactedEvent(2, 5)), 'accepted')
  assert.equal(stream.lastSequence, 5)
  assert.equal(appendConversationRunEvent(stream, event(6, 'content_delta')), 'accepted')
  assert.equal(appendConversationRunEvent(stream, compactedEvent(8, 9)), 'gap')
})

test('history calibration accepts adjacent compacted sequence ranges', () => {
  const stream = { runId: 'run-1', events: [] as AgentConversationRunEventDTO[], lastSequence: 0 }

  assert.equal(replaceConversationRunEvents(stream, [
    compactedEvent(2, 5),
    event(1, 'content_delta'),
    compactedEvent(6, 8),
  ]), true)
  assert.equal(stream.lastSequence, 8)
  assert.deepEqual(stream.events.map(item => [item.startSequence, item.sequence]), [
    [undefined, 1],
    [2, 5],
    [6, 8],
  ])
})

test('a compacted reconnect snapshot replaces previously received block fragments', () => {
  const stream = {
    runId: 'run-1',
    events: [
      contentEvent(1, 'intro', 'intro'),
      contentEvent(2, 'content-a', 'a1', 'worker-1'),
      contentEvent(3, 'content-b', 'b1', 'worker-2'),
      contentEvent(4, 'content-a', 'a2', 'worker-1'),
    ],
    lastSequence: 4,
  }
  const compactedA = {
    ...contentEvent(3, 'content-a', 'a1a2', 'worker-1'),
    startSequence: 2,
  }
  const compactedB = {
    ...contentEvent(5, 'content-b', 'b1b2', 'worker-2'),
    startSequence: 4,
  }

  assert.equal(appendConversationRunEvent(stream, compactedA), 'accepted')
  assert.equal(stream.lastSequence, 4)
  assert.equal(appendConversationRunEvent(stream, compactedB), 'accepted')
  assert.equal(stream.lastSequence, 5)
  assert.deepEqual(stream.events.map((item) => {
    if (item.event.type !== 'content_delta') {
      return undefined
    }
    return [item.event.data.contentId, item.event.data.text]
  }), [
    ['intro', 'intro'],
    ['content-a', 'a1a2'],
    ['content-b', 'b1b2'],
  ])
})

test('an older persisted snapshot does not replace newer in-memory streaming events', () => {
  const stream = {
    runId: 'run-1',
    events: [event(1, 'content_delta'), event(2, 'content_delta'), event(3, 'content_delta')],
    lastSequence: 3,
  }

  assert.equal(replaceConversationRunEvents(stream, [event(1, 'content_delta'), event(2, 'content_delta')]), true)
  assert.equal(stream.lastSequence, 3)
  assert.deepEqual(stream.events.map(item => item.sequence), [1, 2, 3])
})

test('terminal event types map to frontend run status', () => {
  assert.equal(terminalRunStatus(event(1, 'run_completed')), 'completed')
  assert.equal(terminalRunStatus(event(1, 'content_delta')), undefined)
})

test('server terminal state clears stale local running ids', () => {
  assert.deepEqual(reconcileConversationRunSummary(
    { latestRunId: 'run-1', latestRunStatus: 'streaming', runningRunIds: ['run-1'] },
    { latestRunId: 'run-1', latestRunStatus: 'cancelled', runningRunIds: [] },
    false,
  ), {
    latestRunId: 'run-1',
    latestRunStatus: 'cancelled',
    runningRunIds: [],
  })
})

test('a locally stopped run stays cancelled while the agent is still streaming', () => {
  assert.deepEqual(reconcileConversationRunSummary(
    { latestRunId: 'run-1', latestRunStatus: 'cancelled', runningRunIds: [] },
    { latestRunId: 'run-1', latestRunStatus: 'streaming', runningRunIds: [] },
    true,
  ), {
    latestRunId: 'run-1',
    latestRunStatus: 'cancelled',
    runningRunIds: [],
  })
})

test('a pending stop binds to the first matching run and freezes later events', () => {
  const registry = new LocallyStoppedConversationRunRegistry<{ prompt: string }>()
  registry.addPending('conversation-1', 'request-1', { prompt: 'stop this run' })
  const started = event(1, 'content_delta')
  started.event = {
    type: 'run_started',
    data: {
      requestId: 'request-1',
      source: 'user',
      assistantMessageId: started.assistantMessageId,
      startedAt: started.timestamp,
    },
  }

  assert.deepEqual(registry.resolve(started), { prompt: 'stop this run' })
  assert.equal(registry.hasRun('run-1'), true)
  assert.equal(registry.resolve(started), undefined)
})

test('a pending stop does not freeze a later request for the same conversation', () => {
  const registry = new LocallyStoppedConversationRunRegistry<{ prompt: string }>()
  registry.addPending('conversation-1', 'request-old', { prompt: 'old prompt' })
  const started = event(1, 'content_delta')
  started.event = {
    type: 'run_started',
    data: {
      requestId: 'request-new',
      source: 'user',
      assistantMessageId: started.assistantMessageId,
      startedAt: started.timestamp,
    },
  }

  assert.equal(registry.resolve(started), undefined)
  assert.equal(registry.hasRun('run-1'), false)
})

test('a silently dropped start command expires without a synthetic error', async () => {
  const registry = new PendingConversationRunRegistry<{ prompt: string }>()
  let expired: { prompt: string } | undefined
  registry.begin('conversation-1', 'request-1', { prompt: 'retry me' }, 5, (value) => {
    expired = value
  })

  assert.equal(registry.has('conversation-1'), true)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(registry.has('conversation-1'), false)
  assert.deepEqual(expired, { prompt: 'retry me' })
})

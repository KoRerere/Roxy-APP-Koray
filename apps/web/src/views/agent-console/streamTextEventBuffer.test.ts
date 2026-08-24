import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import test from 'node:test'
import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { StreamTextEventBufferScheduler, StreamTextEventBufferSchedulerHost } from './streamTextEventBuffer'
import { StreamTextEventBuffer, createIdleAwareStreamTextEventBufferScheduler } from './streamTextEventBuffer'

interface ScheduledCallback {
  callback: () => void
  cancelled: boolean
  delayMs: number
}

class ManualScheduler implements StreamTextEventBufferScheduler {
  readonly callbacks: ScheduledCallback[] = []

  schedule(callback: () => void, delayMs: number): () => void {
    const scheduled = { callback, cancelled: false, delayMs }
    this.callbacks.push(scheduled)
    return () => {
      scheduled.cancelled = true
    }
  }

  run(index: number): void {
    const scheduled = this.callbacks[index]
    if (scheduled && !scheduled.cancelled) {
      scheduled.callback()
    }
  }
}

class ManualIdleHost implements StreamTextEventBufferSchedulerHost {
  readonly idleCallbacks: Array<{ callback: IdleRequestCallback, options?: IdleRequestOptions, cancelled: boolean }> = []
  readonly timeoutCallbacks: ScheduledCallback[] = []

  requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
    const entry = { callback, options, cancelled: false }
    this.idleCallbacks.push(entry)
    return this.idleCallbacks.length
  }

  cancelIdleCallback(handle: number): void {
    const entry = this.idleCallbacks[handle - 1]
    if (entry) {
      entry.cancelled = true
    }
  }

  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const scheduled = { callback, cancelled: false, delayMs }
    this.timeoutCallbacks.push(scheduled)
    return this.timeoutCallbacks.length as unknown as ReturnType<typeof setTimeout>
  }

  clearTimeout(id: ReturnType<typeof setTimeout>): void {
    const index = Number(id) - 1
    const entry = this.timeoutCallbacks[index]
    if (entry) {
      entry.cancelled = true
    }
  }

  runIdle(index: number, didTimeout = false): void {
    const scheduled = this.idleCallbacks[index]
    if (scheduled && !scheduled.cancelled) {
      scheduled.callback({
        didTimeout,
        timeRemaining() {
          return 10
        },
      })
    }
  }
}

function contentEvent(
  sequence: number,
  conversationId = 'conversation-1',
  agentPath = '/root',
): AgentConversationRunEventDTO {
  return {
    conversationId,
    runId: `run-${conversationId}`,
    turnId: `turn-${conversationId}`,
    assistantMessageId: `assistant-${conversationId}`,
    sequence,
    timestamp: sequence,
    event: {
      type: 'content_delta',
      data: {
        agentPath,
        contentId: 'content-1',
        text: `${sequence}`,
      },
    },
  }
}

function toolEvent(sequence: number): AgentConversationRunEventDTO {
  return {
    ...contentEvent(sequence),
    event: {
      type: 'tool_started',
      data: {
        toolId: 'tool-1',
        toolName: 'list_agents',
        input: {},
      },
    },
  }
}

test('stream text uses a fixed 50ms window without resetting its timer', async () => {
  const scheduler = new ManualScheduler()
  const flushed: number[][] = []
  const buffer = new StreamTextEventBuffer({
    ttlMs: 50,
    scheduler,
    onError(error) {
      throw error
    },
    onFlush(items) {
      flushed.push(items.map(item => item.sequence))
    },
  })

  assert.equal(buffer.enqueue(contentEvent(1)), true)
  assert.equal(buffer.enqueue(contentEvent(2)), true)
  assert.equal(scheduler.callbacks.length, 1)
  assert.equal(scheduler.callbacks[0]?.delayMs, 50)

  scheduler.run(0)
  await buffer.flushRun('run-conversation-1')
  assert.deepEqual(flushed, [[1, 2]])
})

test('text buffers are isolated by conversation and agent path', async () => {
  const scheduler = new ManualScheduler()
  const flushed: number[][] = []
  const buffer = new StreamTextEventBuffer({
    ttlMs: 50,
    scheduler,
    onError(error) {
      throw error
    },
    onFlush(items) {
      flushed.push(items.map(item => item.sequence))
    },
  })

  buffer.enqueue(contentEvent(1, 'conversation-1', '/root/profile_one'))
  buffer.enqueue(contentEvent(2, 'conversation-1', '/root/profile_two'))
  buffer.enqueue(contentEvent(3, 'conversation-2', '/root/profile_one'))
  buffer.enqueue(contentEvent(4, 'conversation-1', '/root/profile_one'))

  assert.equal(scheduler.callbacks.length, 3)
  scheduler.run(0)
  await Promise.resolve()
  assert.deepEqual(flushed, [[1, 4]])
  scheduler.run(1)
  scheduler.run(2)
  await Promise.all([
    buffer.flushRun('run-conversation-1'),
    buffer.flushRun('run-conversation-2'),
  ])
  assert.deepEqual(flushed, [[1, 4], [2], [3]])
})

test('a following tool waits until buffered text has rendered', async () => {
  const scheduler = new ManualScheduler()
  let finishRender: (() => void) | undefined
  const released: string[] = []
  const buffer = new StreamTextEventBuffer({
    ttlMs: 50,
    scheduler,
    onError(error) {
      throw error
    },
    async onFlush(items) {
      released.push(`text:${items.map(item => item.sequence).join(',')}`)
      await new Promise<void>((resolve) => {
        finishRender = resolve
      })
    },
  })

  buffer.enqueue(contentEvent(1))
  const flushPromise = buffer.flushRun('run-conversation-1')
  let toolReleased = false
  const toolPromise = flushPromise.then(() => {
    toolReleased = true
    released.push('tool')
  })

  assert.equal(buffer.enqueue(toolEvent(2)), false)
  assert.deepEqual(released, ['text:1'])
  assert.equal(toolReleased, false)

  finishRender?.()
  await toolPromise
  assert.equal(toolReleased, true)
  assert.deepEqual(released, ['text:1', 'tool'])
})

test('idle-aware scheduler prefers requestIdleCallback when available', () => {
  const host = new ManualIdleHost()
  const scheduler = createIdleAwareStreamTextEventBufferScheduler(host)
  let ran = false

  const cancel = scheduler.schedule(() => {
    ran = true
  }, 42)

  assert.equal(host.idleCallbacks.length, 1)
  assert.equal(host.timeoutCallbacks.length, 0)
  host.runIdle(0)
  assert.equal(ran, true)

  cancel()
})

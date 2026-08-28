import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Agent Console 定向测试使用轻量 Node runner
import { it } from 'node:test'
import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import { appendConversationRunPresentationEvents } from './conversation-run-state'
import { buildProcessFromEvents } from './historyAdapter'
import { IncrementalProcessUpdater } from './incrementalProcess'

function translate(key: string, options?: Record<string, string | number>): string {
  return key.replace(/\{(\w+)\}/g, (match, name) => String(options?.[name] ?? match))
}

(globalThis as typeof globalThis & { $t: typeof translate }).$t = translate

function runEvent(sequence: number, event: AgentRunEvent): AgentConversationRunEventDTO {
  return {
    conversationId: 'conversation-1',
    runId: 'run-1',
    turnId: 'message-user',
    assistantMessageId: 'message-assistant',
    sequence,
    timestamp: 1000 + sequence,
    event,
  }
}

function checkpointed(events: AgentConversationRunEventDTO[]) {
  const parsed = buildProcessFromEvents('message-assistant', events, { finalize: false })
  const updater = new IncrementalProcessUpdater()
  updater.reset(events, parsed.checkpoint)
  return { parsed, updater }
}

it('appends streamed thinking deltas without replacing existing process events', () => {
  const initial = runEvent(1, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '已有内容' },
  })
  const delta = runEvent(2, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '，只追加这一段' },
  })
  const { parsed, updater } = checkpointed([initial])
  const thinking = parsed.process.events[0]
  assert.equal(thinking?.type, 'thinking')

  const result = updater.update('message-assistant', parsed.process, [initial, delta])
  assert.ok(result)
  assert.equal(result.process.events[0], thinking)
  assert.equal(thinking.content, '已有内容，只追加这一段')
  assert.equal(result.process.revision, 2)
})

it('retargets checkpoint references when the process tree is replaced', () => {
  const initial = runEvent(1, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '开始' },
  })
  const second = runEvent(2, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '第二段' },
  })
  const third = runEvent(3, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '第三段' },
  })
  const { parsed, updater } = checkpointed([initial])
  const secondResult = updater.update('message-assistant', parsed.process, [initial, second])
  assert.ok(secondResult)

  const replacementTree = structuredClone(secondResult.process)
  const thirdResult = updater.update('message-assistant', replacementTree, [initial, second, third])
  assert.ok(thirdResult)
  const replacementThinking = replacementTree.events[0]
  assert.equal(replacementThinking?.type, 'thinking')
  assert.equal(replacementThinking.content, '开始第二段第三段')
  const originalThinking = secondResult.process.events[0]
  assert.equal(originalThinking?.type, 'thinking')
  assert.equal(originalThinking.content, '开始第二段')
})

it('rejects checkpoint updates when the event prefix changed or a retry occurred', () => {
  const initial = runEvent(1, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '已有内容' },
  })
  const retry = runEvent(2, {
    type: 'run_retrying',
    data: { retryId: 'retry-1', attempt: 2, maxAttempts: 3, reason: '断线' },
  })
  const nextAttempt = runEvent(3, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '新一轮' },
  })
  const retried = checkpointed([initial, retry])
  assert.equal(retried.updater.update('message-assistant', retried.parsed.process, [initial, retry, nextAttempt]), false)

  const prefixChanged = checkpointed([initial])
  const replacedInitial = { ...initial }
  assert.equal(prefixChanged.updater.update('message-assistant', prefixChanged.parsed.process, [replacedInitial, nextAttempt]), false)
})

it('updates streamed synthesis content in place', () => {
  const initial = runEvent(1, {
    type: 'content_delta',
    data: { id: 'answer', contentId: 'answer', phase: 'synthesis', text: '答案' },
  })
  const delta = runEvent(2, {
    type: 'content_delta',
    data: { id: 'answer', contentId: 'answer', phase: 'synthesis', text: '继续' },
  })
  const { parsed, updater } = checkpointed([initial])
  const finalAnswer = parsed.process.events[0]
  assert.equal(finalAnswer?.type, 'final_answer')

  const result = updater.update('message-assistant', parsed.process, [initial, delta])
  assert.ok(result)
  assert.equal(result.process.events[0], finalAnswer)
  assert.equal(finalAnswer.content, '答案继续')
  assert.equal(result.content, '答案继续')
})

it('reduces tool lifecycle events from the checkpoint without rebuilding prior nodes', () => {
  const started = runEvent(1, {
    type: 'tool_started',
    data: { toolName: 'browser_open', toolId: 'tool-1', input: { url: 'https://example.com' } },
  })
  const finished = runEvent(2, {
    type: 'tool_finished',
    data: { toolName: 'browser_open', toolId: 'tool-1', output: 'opened', durationMs: 12, status: 'success' },
  })
  const { parsed, updater } = checkpointed([])

  const startedResult = updater.update('message-assistant', parsed.process, [started])
  assert.ok(startedResult)
  const tool = startedResult.process.events[0]
  assert.equal(tool?.type, 'tool_call')
  assert.equal(tool.status, 'running')

  const finishedResult = updater.update('message-assistant', startedResult.process, [started, finished])
  assert.ok(finishedResult)
  assert.equal(finishedResult.process.events[0], tool)
  assert.equal(tool.finished, true)
  assert.equal(tool.status, 'success')
  assert.equal(tool.output, 'opened')
  assert.deepEqual(finishedResult.process, buildProcessFromEvents('message-assistant', [started, finished], { finalize: false }).process)
})

it('completes thinking and appends script logs and artifacts incrementally', () => {
  const thinking = runEvent(1, {
    type: 'thinking_delta',
    data: { thinkingId: 'main', text: '分析中' },
  })
  const scriptStarted = runEvent(2, {
    type: 'tool_started',
    data: { toolName: 'roxy_script_run', toolId: 'script-1', target: '/scripts/task.ts', input: {} },
  })
  const { parsed, updater } = checkpointed([thinking, scriptStarted])
  const thinkingNode = parsed.process.events.find(event => event.type === 'thinking')
  const scriptNode = parsed.process.events.find(event => event.type === 'script_log')
  assert.ok(thinkingNode && scriptNode)

  const completed = runEvent(3, {
    type: 'thinking_completed',
    data: { thinkingId: 'main', durationMs: 25, endTimestamp: 1003 },
  })
  const log = runEvent(4, {
    type: 'script_output',
    data: { toolId: 'script-1', scriptName: '/scripts/task.ts', level: 'info', message: '第一行' },
  })
  const artifact = runEvent(5, {
    type: 'artifact_created',
    data: { fileId: 'file-1', fileName: 'result.txt', size: 12, mimeType: 'text/plain', operation: 'create' },
  })
  const allEvents = [thinking, scriptStarted, completed, log, artifact]
  const result = updater.update('message-assistant', parsed.process, allEvents)
  assert.ok(result)
  assert.equal(result.process.events.find(event => event.type === 'thinking'), thinkingNode)
  assert.equal(thinkingNode.status, 'success')
  assert.equal(result.process.events.find(event => event.type === 'script_log'), scriptNode)
  assert.deepEqual(scriptNode.lines, [{ level: 'info', message: '第一行' }])
  const files = result.process.events.find(event => event.type === 'agent_file')
  assert.ok(files)
  assert.deepEqual(files.files.map(file => file.fileName), ['result.txt'])
  assert.deepEqual(result.process, buildProcessFromEvents('message-assistant', allEvents, { finalize: false }).process)
})

it('incrementally merges spawn tools into lifecycle groups and updates nested events', () => {
  const spawn = runEvent(1, {
    type: 'tool_started',
    data: { toolName: 'spawn_agent', toolId: 'spawn-one', input: { name: 'one' } },
  })
  const lifecycle = runEvent(2, {
    type: 'agent_lifecycle',
    data: { agentPath: '/root/one', parentAgentPath: '/root', agentName: 'one', agentType: 'worker', status: 'running' },
  })
  const workerContent = runEvent(3, {
    type: 'content_delta',
    data: { agentPath: '/root/one', contentId: 'answer', text: '子任务输出' },
  })
  const { parsed, updater } = checkpointed([spawn])

  const lifecycleResult = updater.update('message-assistant', parsed.process, [spawn, lifecycle])
  assert.ok(lifecycleResult)
  assert.deepEqual(lifecycleResult.process.events.map(event => event.type), ['agent_lifecycle'])
  const lifecycleNode = lifecycleResult.process.events[0]
  assert.equal(lifecycleNode?.type, 'agent_lifecycle')

  const contentResult = updater.update('message-assistant', lifecycleResult.process, [spawn, lifecycle, workerContent])
  assert.ok(contentResult)
  assert.equal(contentResult.process.events[0], lifecycleNode)
  assert.equal(lifecycleNode.events[0]?.type, 'content')
  assert.equal(lifecycleNode.events[0].content, '子任务输出')
  assert.deepEqual(contentResult.process, buildProcessFromEvents('message-assistant', [spawn, lifecycle, workerContent], { finalize: false }).process)
})

it('checkpoint processing only reads the appended suffix', () => {
  const initial = runEvent(1, {
    type: 'content_delta',
    data: { contentId: 'initial', text: '历史内容' },
  })
  const { parsed, updater } = checkpointed([initial])
  Object.defineProperty(initial, 'event', {
    configurable: true,
    get() {
      throw new Error('checkpoint 不应重新归约历史事件')
    },
  })
  const appended = runEvent(2, {
    type: 'tool_started',
    data: { toolName: 'browser_open', toolId: 'tool-2', input: {} },
  })

  const result = updater.update('message-assistant', parsed.process, [initial, appended])
  assert.ok(result)
  assert.deepEqual(result.process.events.map(event => event.type), ['content', 'tool_call'])
})

it('appends ordered presentation deltas without sorting accumulated history', () => {
  const initial = runEvent(1, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '开始' },
  })
  const delta = runEvent(2, {
    type: 'thinking_delta',
    data: { id: 'main', thinkingId: 'main', text: '追加' },
  })
  const events = new Proxy([initial], {
    get(target, property, receiver) {
      if (property === 'sort') {
        throw new Error('增量路径不应排序已累积的历史事件')
      }
      return Reflect.get(target, property, receiver)
    },
  })

  appendConversationRunPresentationEvents(events, [delta])

  assert.deepEqual([...events], [initial, delta])
})

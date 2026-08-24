import assert from 'node:assert/strict'
import { it } from 'vitest'
import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import { buildProcessFromEvents, mapHistoryConversation, mapHistoryMessages } from './historyAdapter'

function translate(key: string, options?: Record<string, string | number>): string {
  return key.replace(/\{(\w+)\}/g, (match, name) => String(options?.[name] ?? match))
}

(globalThis as typeof globalThis & { $t: typeof translate }).$t = translate

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

function scopedRunEvent(conversationId: string, runId: string, sequence: number, event: AgentRunEvent): AgentConversationRunEventDTO {
  return { ...runEvent(sequence, event), conversationId, runId }
}

it('script outputs are process events and default to collapsed', () => {
  const events = [
    runEvent(1, { type: 'run_started', data: { source: 'user', assistantMessageId: 'message-assistant', startedAt: 1000 } }),
    runEvent(2, { type: 'tool_started', data: { toolName: 'roxy_script_run', toolId: 'tool-1', input: {} } }),
    runEvent(3, { type: 'script_output', data: { toolId: 'tool-1', scriptName: '/scripts/cookie-robot.ts', level: 'info', message: 'running command' } }),
    runEvent(4, { type: 'tool_finished', data: { toolName: 'roxy_script_run', toolId: 'tool-1', output: 'done', status: 'success' } }),
    runEvent(5, { type: 'run_completed', data: { finalAnswer: 'done' } }),
  ]

  const parsed = buildProcessFromEvents('message-assistant', events)
  const scriptLog = parsed.process.events.find(event => event.type === 'script_log')

  assert.ok(scriptLog)
  assert.deepEqual(parsed.process.events.map(event => event.type), ['script_log', 'final_answer'])
  assert.equal(scriptLog.title, '运行脚本 cookie-robot.ts')
  assert.equal(scriptLog.scriptName, '/scripts/cookie-robot.ts')
  assert.equal(scriptLog.expanded, false)
  assert.equal(scriptLog.status, 'success')
  assert.equal(parsed.process.completed, true)
  assert.equal(parsed.process.collapsed, true)
})

it('missing replay script logs use a localized placeholder', () => {
  const parsed = buildProcessFromEvents('message-missing-script-log', [
    runEvent(1, {
      type: 'tool_started',
      data: {
        toolName: 'roxy_script_run',
        toolId: 'tool-1',
        target: 'official:test',
        input: { scriptPath: 'official:test', dirIds: ['dir-1'] },
      },
    }),
    runEvent(2, {
      type: 'script_output',
      data: {
        toolId: 'tool-1',
        dirId: 'dir-1',
        scriptName: 'official:test',
        level: 'info',
        message: '',
        unavailableReason: 'file_missing',
      },
    }),
    runEvent(3, {
      type: 'tool_finished',
      data: { toolName: 'roxy_script_run', toolId: 'tool-1', output: 'done', status: 'success' },
    }),
  ])

  const scriptLog = parsed.process.events.find(event => event.type === 'script_log')
  assert.ok(scriptLog?.type === 'script_log')
  assert.deepEqual(scriptLog.lines, [{
    level: 'info',
    message: '（脚本日志文件不存在）',
  }])
})

it('parallel script outputs create one log per window and settle together', () => {
  const parsed = buildProcessFromEvents('message-parallel-script', [
    runEvent(1, {
      type: 'tool_started',
      data: {
        toolName: 'roxy_script_run',
        toolId: 'tool-1',
        target: 'cookie-robot',
        input: { dirIds: ['dir-1', 'dir-2'] },
      },
    }),
    runEvent(2, {
      type: 'script_output',
      data: {
        toolId: 'tool-1',
        scriptRunId: 'script-run-1',
        dirId: 'dir-1',
        scriptName: 'cookie-robot',
        level: 'info',
        message: 'window one started',
      },
    }),
    runEvent(3, {
      type: 'script_output',
      data: {
        toolId: 'tool-1',
        scriptRunId: 'script-run-2',
        dirId: 'dir-2',
        scriptName: 'cookie-robot',
        level: 'info',
        message: 'window two started',
      },
    }),
    runEvent(4, {
      type: 'script_output',
      data: {
        toolId: 'tool-1',
        scriptRunId: 'script-run-1',
        dirId: 'dir-1',
        scriptName: 'cookie-robot',
        level: 'info',
        message: 'window one finished',
      },
    }),
    runEvent(5, { type: 'tool_finished', data: { toolName: 'roxy_script_run', toolId: 'tool-1', output: 'done', status: 'failed' } }),
  ], { finalize: false })

  const logs = parsed.process.events.filter((event): event is Extract<typeof event, { type: 'script_log' }> => event.type === 'script_log')
  assert.equal(logs.length, 2)
  assert.deepEqual(logs.map(log => [log.toolId, log.scriptRunId, log.dirId]), [
    ['tool-1', 'script-run-1', 'dir-1'],
    ['tool-1', 'script-run-2', 'dir-2'],
  ])
  assert.deepEqual(logs.map(log => log.lines.map(line => line.message)), [
    ['window one started', 'window one finished'],
    ['window two started'],
  ])
  assert.deepEqual(logs.map(log => log.status), ['failed', 'failed'])
})

it('parallel script logs are created in dirIds order before output arrives', () => {
  const parsed = buildProcessFromEvents('message-starting-parallel-script', [
    runEvent(1, {
      type: 'tool_started',
      data: {
        toolName: 'roxy_script_run',
        toolId: 'tool-1',
        target: 'cookie-robot',
        input: { dirIds: ['dir-2', 'dir-1', 'dir-2'] },
      },
    }),
  ], { finalize: false })

  const logs = parsed.process.events.filter(event => event.type === 'script_log')
  assert.deepEqual(logs.map(log => log.dirId), ['dir-2', 'dir-1'])
  assert.deepEqual(logs.map(log => log.lines), [[], []])
  assert.deepEqual(logs.map(log => log.status), ['running', 'running'])
})

it('context compaction is kept as an independent root process event', () => {
  const parsed = buildProcessFromEvents('message-compacted', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'read_file', toolId: 'tool-1', input: {} } }),
    runEvent(2, { type: 'context_compacted', data: { status: 'started', compactedCount: 8 } }),
    runEvent(3, { type: 'context_compacted', data: { status: 'completed', compactedCount: 8, summary: 'summary' } }),
    runEvent(4, { type: 'tool_finished', data: { toolName: 'read_file', toolId: 'tool-1', output: '', status: 'success' } }),
    runEvent(5, { type: 'run_completed', data: {} }),
  ])

  const compacted = parsed.process.events.find(event => event.type === 'context_compacted')
  assert.ok(compacted)
  assert.equal(compacted.compactedCount, 8)
  assert.equal(compacted.title, '上下文已自动压缩')
  assert.equal(compacted.status, 'success')
  assert.equal(compacted.summary, 'summary')
  assert.deepEqual(parsed.process.events.map(event => event.type), ['tool_call', 'context_compacted'])
})

it('context compaction keeps the in-progress copy visible until completion', () => {
  const parsed = buildProcessFromEvents('message-compacting', [
    runEvent(1, { type: 'context_compacted', data: { status: 'started', compactedCount: 8 } }),
  ], { finalize: false })
  const compacted = parsed.process.events[0]
  assert.equal(compacted?.type, 'context_compacted')
  assert.equal(compacted?.title, '正在自动压缩上下文')
  assert.equal(compacted?.status, 'running')
})

it('approval requests are visible as standalone HITL process events', () => {
  const parsed = buildProcessFromEvents('message-hitl', [
    runEvent(1, { type: 'thinking_delta', data: { thinkingId: 'think', text: 'checking' } }),
    runEvent(2, {
      type: 'approval_requested',
      data: {
        approvalId: 'ask-1',
        actionRequests: [],
        reviewConfigs: [],
        requestKind: 'clarification',
        questions: [
          {
            header: '测试范围',
            id: 'test_scope',
            question: '请选择测试范围',
            options: [
              { label: '自动评论', description: '跑一次自动评论测试。' },
              { label: '参数检查', description: '只做参数检查。' },
            ],
          },
          {
            header: '执行方式',
            id: 'execution_mode',
            question: '请选择执行方式',
            options: [
              { label: '安全模式', description: '遇到异常时暂停。' },
              { label: '自动重试', description: '失败后自动重试。' },
            ],
          },
        ],
        prompt: '请选择测试范围',
        controls: [],
      },
    }),
    runEvent(3, { type: 'approval_resolved', data: { approvalId: 'ask-1', decisions: [{ type: 'answer', answer: 'ok' }] } }),
  ], { finalize: false })

  assert.deepEqual(parsed.process.events.map(event => event.type), ['thinking', 'hitl'])
  const hitl = parsed.process.events.find(event => event.type === 'hitl')
  assert.ok(hitl)
  assert.equal(hitl.title, '已询问 2 个问题')
  assert.equal(hitl.prompt, '请选择测试范围')
  assert.equal(hitl.detail, 'ok')
  assert.equal(hitl.status, 'success')
})

it('resolved structured clarification displays each question answer instead of raw JSON', () => {
  const parsed = buildProcessFromEvents('message-hitl-structured', [
    runEvent(1, {
      type: 'approval_requested',
      data: {
        approvalId: 'ask-structured',
        actionRequests: [],
        reviewConfigs: [],
        requestKind: 'clarification',
        prompt: '你平时用 RoxyBrowser 主要是做哪类工作?',
        questions: [
          {
            header: '任务类型',
            id: 'primary_use',
            question: '你希望我接下来优先帮你处理哪类任务?',
            options: [
              { label: '社媒运营', description: '优先处理内容发布和互动。' },
              { label: '数据采集', description: '优先处理信息收集。' },
            ],
          },
          {
            header: '推进方式',
            id: 'today_goal',
            question: '你更喜欢我用什么节奏推进?',
            options: [
              { label: '边做边报', description: '每完成一步同步进展。' },
              { label: '一次完成', description: '尽量完成后再汇报。' },
            ],
          },
          {
            header: '验证深度',
            id: 'experience',
            question: '你希望验证做到什么程度?',
            options: [
              { label: '轻量验证', description: '跑关键路径检查。' },
              { label: '完整验证', description: '覆盖更多边界。' },
            ],
          },
        ],
        controls: [],
      },
    }),
    runEvent(2, {
      type: 'approval_resolved',
      data: {
        approvalId: 'ask-structured',
        decisions: [{
          type: 'answer',
          answer: JSON.stringify({
            today_goal: '边做边报',
            experience: '轻量验证',
          }),
        }],
      },
    }),
  ], { finalize: false })

  const hitl = parsed.process.events.find(event => event.type === 'hitl')
  assert.ok(hitl)
  assert.equal(hitl.title, '已询问 3 个问题')
  assert.equal(hitl.detail, undefined)
  assert.deepEqual(hitl.clarificationAnswers, [
    {
      id: 'primary_use',
      question: '你希望我接下来优先帮你处理哪类任务?',
      answer: '未提供答案',
      recommended: false,
    },
    {
      id: 'today_goal',
      question: '你更喜欢我用什么节奏推进?',
      answer: '边做边报',
      recommended: true,
    },
    {
      id: 'experience',
      question: '你希望验证做到什么程度?',
      answer: '轻量验证',
      recommended: true,
    },
  ])
})

it('pending clarification does not display an unselected option as the answer', () => {
  const parsed = buildProcessFromEvents('message-hitl-pending', [
    runEvent(1, {
      type: 'approval_requested',
      data: {
        approvalId: 'ask-pending',
        actionRequests: [],
        reviewConfigs: [],
        requestKind: 'clarification',
        prompt: '请选择参数',
        controls: [{
          id: 'answer',
          kind: 'choice',
          options: [{ id: 'option-1', label: '跑一次自动评论测试', value: '跑一次自动评论测试' }],
        }],
      },
    }),
  ], { finalize: false })

  const hitl = parsed.process.events.find(event => event.type === 'hitl')
  assert.ok(hitl)
  assert.equal(hitl.status, 'running')
  assert.equal(hitl.detail, undefined)
})

it('skipped clarification does not fall back to the suggested option detail', () => {
  const parsed = buildProcessFromEvents('message-hitl-skip', [
    runEvent(1, {
      type: 'approval_requested',
      data: {
        approvalId: 'ask-skip',
        actionRequests: [],
        reviewConfigs: [],
        requestKind: 'clarification',
        prompt: '请选择参数',
        controls: [{
          id: 'answer',
          kind: 'choice',
          options: [{ id: 'option-1', label: '跑一次自动评论测试', value: '跑一次自动评论测试' }],
        }],
      },
    }),
    runEvent(2, { type: 'approval_resolved', data: { approvalId: 'ask-skip', decisions: [{ type: 'answer', answer: '' }] } }),
  ], { finalize: false })

  const hitl = parsed.process.events.find(event => event.type === 'hitl')
  assert.ok(hitl)
  assert.equal(hitl.detail, '已跳过')
})

it('network retry is a standalone process event and settles after replacement output', () => {
  const parsed = buildProcessFromEvents('message-retry-event', [
    runEvent(1, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 2, maxAttempts: 5, reason: 'http_503' } }),
    runEvent(2, { type: 'content_delta', data: { contentId: 'answer', text: 'recovered' } }),
    runEvent(3, { type: 'run_completed', data: {} }),
  ])

  const retry = parsed.process.events.find(event => event.type === 'retrying')
  assert.ok(retry)
  assert.equal(retry.title, '已重新连接')
  assert.equal(retry.status, 'success')
  assert.deepEqual(parsed.process.events.map(event => event.type), ['retrying', 'final_answer'])
})

it('run completion snapshot replaces the streamed final answer without rendering it twice', () => {
  const parsed = buildProcessFromEvents('message-completed-answer', [
    runEvent(1, { type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'thinking' } }),
    runEvent(2, {
      type: 'thinking_completed',
      data: { thinkingId: 'thinking-1', startTimestamp: 1001, endTimestamp: 1002, durationMs: 1 },
    }),
    runEvent(3, { type: 'content_delta', data: { contentId: 'answer', text: 'hello ' } }),
    runEvent(4, { type: 'content_delta', data: { contentId: 'answer', text: 'world' } }),
    runEvent(5, { type: 'run_completed', data: { finalAnswer: 'hello world' } }),
  ])

  assert.equal(parsed.content, 'hello world')
  assert.deepEqual(parsed.process.events.map(event => event.type), ['thinking', 'final_answer'])
  assert.equal(
    parsed.process.events.filter(event => event.type === 'final_answer')[0]?.content,
    'hello world',
  )
  const thinking = parsed.process.events.find(event => event.type === 'thinking')
  assert.equal(thinking?.title, '已思考 1s')
  assert.equal(thinking?.durationStartedAt, 1001)
  assert.equal(thinking?.durationEndedAt, 1002)
  assert.equal(thinking?.durationMs, 1)
})

it('thinking duration uses frontend event timing until agent completion timing arrives', () => {
  const running = buildProcessFromEvents('message-thinking', [
    runEvent(1, { type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'thinking' } }, 1_000),
  ], { finalize: false })
  assert.equal(running.process.events[0]?.title, '正在思考')
  assert.equal(running.process.events[0]?.durationStartedAt, 1_000)

  const completed = buildProcessFromEvents('message-thinking', [
    runEvent(1, { type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'thinking' } }, 1_000),
    runEvent(2, {
      type: 'thinking_completed',
      data: { thinkingId: 'thinking-1', startTimestamp: 1_010, endTimestamp: 81_010, durationMs: 80_000 },
    }, 81_500),
  ], { finalize: false })
  assert.equal(completed.process.events[0]?.title, '已思考 1m20s')
  assert.equal(completed.process.events[0]?.durationMs, 80_000)
})

it('apply_patch presentation keeps the agent-provided patch type and original path', () => {
  const parsed = buildProcessFromEvents('message-patch', [
    runEvent(1, {
      type: 'tool_started',
      data: {
        toolName: 'apply_patch',
        toolId: 'patch-1',
        input: '*** Begin Patch\n*** Update File: relative/report.ts\n@@\n-old\n+new\n*** End Patch',
        patchType: 'update',
        target: 'relative/report.ts',
      },
    }),
  ], { finalize: false })
  const tool = parsed.process.events[0]
  assert.equal(tool?.type, 'tool_call')
  assert.equal(tool?.patchType, 'update')
  assert.equal(tool?.target, 'relative/report.ts')
  assert.equal(tool?.finished, false)

  const completed = buildProcessFromEvents('message-patch', [
    runEvent(1, {
      type: 'tool_started',
      data: {
        toolName: 'apply_patch',
        toolId: 'patch-1',
        input: '*** Begin Patch\n*** Update File: relative/report.ts\n@@\n-old\n+new\n*** End Patch',
        patchType: 'update',
        target: 'relative/report.ts',
      },
    }),
    runEvent(2, {
      type: 'tool_finished',
      data: { toolName: 'apply_patch', toolId: 'patch-1', output: 'done', status: 'success' },
    }),
  ], { finalize: false })
  const completedTool = completed.process.events[0]
  assert.equal(completedTool?.type, 'tool_call')
  assert.equal(completedTool?.finished, true)
})

it('memory index and directory discovery tool calls stay out of the process timeline', () => {
  // Regression: MEMORY.md maintenance and memory-directory discovery appeared as
  // ordinary filesystem rows even though only durable entry reads and writes are
  // useful progress information for the user.
  // Fixed by: canonical memory-directory prefixes classify internal operations
  // before the shared live/history process adapter creates a visible tool row.
  const memoryDir = '/Users/test/.roxy-agent-dev/memory'
  const indexPatch = [
    '*** Begin Patch',
    `*** Update File: ${memoryDir}/MEMORY.md`,
    '@@',
    '-old',
    '+new',
    '*** End Patch',
  ].join('\n')
  const events = [
    runEvent(1, { type: 'tool_started', data: { toolName: 'read_file', toolId: 'read-index', input: { path: `${memoryDir}/MEMORY.md` } } }),
    runEvent(2, { type: 'tool_finished', data: { toolName: 'read_file', toolId: 'read-index', output: 'index', status: 'success' } }),
    runEvent(3, { type: 'tool_started', data: { toolName: 'ls', toolId: 'list-memory', input: { path: memoryDir } } }),
    runEvent(4, { type: 'tool_finished', data: { toolName: 'ls', toolId: 'list-memory', output: 'entry.md', status: 'success' } }),
    runEvent(5, { type: 'tool_started', data: { toolName: 'glob', toolId: 'glob-memory', input: { cwd: memoryDir, pattern: '*.md' } } }),
    runEvent(6, { type: 'tool_finished', data: { toolName: 'glob', toolId: 'glob-memory', output: 'entry.md', status: 'success' } }),
    runEvent(7, { type: 'tool_started', data: { toolName: 'grep', toolId: 'grep-memory', input: { path: memoryDir, pattern: 'browser' } } }),
    runEvent(8, { type: 'tool_finished', data: { toolName: 'grep', toolId: 'grep-memory', output: 'entry.md', status: 'success' } }),
    runEvent(9, { type: 'tool_started', data: { toolName: 'apply_patch', toolId: 'patch-index', input: indexPatch } }),
    runEvent(10, { type: 'tool_finished', data: { toolName: 'apply_patch', toolId: 'patch-index', output: 'done', status: 'success' } }),
    runEvent(11, { type: 'tool_started', data: { toolName: 'write_file', toolId: 'write-index', input: { path: `${memoryDir}/MEMORY.md`, content: 'index' } } }),
    runEvent(12, { type: 'tool_finished', data: { toolName: 'write_file', toolId: 'write-index', output: 'done', status: 'success' } }),
    runEvent(13, { type: 'tool_started', data: { toolName: 'edit_file', toolId: 'edit-index', input: { path: `${memoryDir}/MEMORY.md`, old_str: 'old', new_str: 'new' } } }),
    runEvent(14, { type: 'tool_finished', data: { toolName: 'edit_file', toolId: 'edit-index', output: 'done', status: 'success' } }),
    runEvent(15, { type: 'tool_started', data: { toolName: 'read_file', toolId: 'read-entry', input: { path: `${memoryDir}/browser-workflow.md` } } }),
    runEvent(16, { type: 'tool_finished', data: { toolName: 'read_file', toolId: 'read-entry', output: 'memory body', status: 'success' } }),
  ]

  const parsed = buildProcessFromEvents('message-memory-internals', events, { finalize: false })
  const tools = parsed.process.events.filter(event => event.type === 'tool_call')

  assert.equal(tools.length, 1)
  assert.equal(tools[0]?.toolName, 'read_file')
  assert.deepEqual(tools[0]?.input, { path: `${memoryDir}/browser-workflow.md` })
})

it('a combined memory entry and index patch remains visible with the original input', () => {
  const memoryDir = '/Users/test/.roxy-agent/memory'
  const patch = [
    '*** Begin Patch',
    `*** Add File: ${memoryDir}/new-memory.md`,
    '+durable fact',
    `*** Update File: ${memoryDir}/MEMORY.md`,
    '@@',
    ' # Roxy Agent Memory Index',
    '+- [New memory](new-memory.md) - Durable fact',
    '*** End Patch',
  ].join('\n')
  const parsed = buildProcessFromEvents('message-memory-entry', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'apply_patch', toolId: 'patch-memory', input: patch } }),
    runEvent(2, { type: 'tool_finished', data: { toolName: 'apply_patch', toolId: 'patch-memory', output: 'done', status: 'success' } }),
  ], { finalize: false })
  const tool = parsed.process.events[0]

  assert.equal(tool?.type, 'tool_call')
  assert.equal(tool?.toolName, 'apply_patch')
  assert.equal(tool?.input, patch)
})

it('repeated retry attempts update one event and mark it failed when exhausted', () => {
  const parsed = buildProcessFromEvents('message-retry-exhausted', [
    runEvent(1, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }),
    runEvent(2, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 2, maxAttempts: 5 } }),
    runEvent(3, { type: 'run_failed', data: { code: 'provider_unavailable', message: 'failed', retryable: true } }),
  ])

  const retries = parsed.process.events.filter(event => event.type === 'retrying')
  assert.equal(retries.length, 1)
  assert.equal(retries[0]?.attempt, 2)
  assert.equal(retries[0]?.title, '网络重试失败')
  assert.equal(retries[0]?.status, 'failed')
})

it('uses the unified model-call id to split repeated content streams', () => {
  const parsed = buildProcessFromEvents('message-model-calls', [
    runEvent(1, { type: 'content_delta', data: { id: 'llm-0', contentId: 'legacy-content', text: 'first ' } }),
    runEvent(2, { type: 'content_delta', data: { id: 'llm-1', contentId: 'legacy-content', text: 'second' } }),
  ], { finalize: false })

  assert.deepEqual(
    parsed.process.events
      .filter(event => event.type === 'content')
      .map(event => [event.id, event.content]),
    [
      ['content-llm-0', 'first '],
      ['content-llm-1', 'second'],
    ],
  )
})

it('script log is visible and running before script output or tool completion', () => {
  const parsed = buildProcessFromEvents('message-running-script', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'roxy_script_run', toolId: 'tool-1', target: 'cookie-robot', input: {} } }),
  ], { finalize: false })

  assert.deepEqual(parsed.process.events.map(event => event.type), ['script_log'])
  assert.equal(parsed.process.events[0]?.title, '运行脚本 cookie-robot')
  assert.equal(parsed.process.events[0]?.status, 'running')
})

it('script log displays only the file name for local absolute script paths', () => {
  const posix = buildProcessFromEvents('message-running-local-script', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'roxy_script_run', toolId: 'tool-1', target: '/Users/anbin/.roxy-agent-dev/library/scripts/xhs-shenzhen-rental-collector.ts', input: {} } }),
  ], { finalize: false })

  assert.equal(posix.process.events[0]?.title, '运行脚本 xhs-shenzhen-rental-collector.ts')

  const windows = buildProcessFromEvents('message-running-windows-script', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'roxy_script_run', toolId: 'tool-1', target: 'C:\\Users\\anbin\\scripts\\collector.ts', input: {} } }),
  ], { finalize: false })

  assert.equal(windows.process.events[0]?.title, '运行脚本 collector.ts')
})

it('agent failure events resolve display message and keep request id', () => {
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

it('agent failure events map raw 402 payloads to insufficient points', () => {
  const parsed = buildProcessFromEvents('message-error-402', [
    runEvent(1, {
      type: 'run_failed',
      data: {
        status: 402,
        message: 'Your account points balance is insufficient',
        requestID: 'req-402',
        error: {
          code: 402,
          message: 'Your account points balance is insufficient',
        },
      },
    }),
  ])

  assert.equal(parsed.status, 'error')
  assert.equal(parsed.content, '您的积分不足，请充值积分后重试。')
  assert.deepEqual(parsed.errorData, {
    code: 'insufficient_points',
    message: 'Your account points balance is insufficient',
    retryable: false,
    requestId: 'req-402',
  })
})

it('cancelled runs do not create user-facing error messages', () => {
  const parsed = buildProcessFromEvents('message-cancelled', [
    runEvent(1, { type: 'run_cancelled', data: { reason: 'user', message: 'User cancelled' } }),
  ])

  assert.equal(parsed.status, 'done')
  assert.equal(parsed.content, '')
  assert.equal(parsed.process.completed, false)
  assert.equal(parsed.process.collapsed, false)
  assert.equal(parsed.errorData, undefined)
})

it('unfinished streams do not promote the last content event or collapse the process', () => {
  const parsed = buildProcessFromEvents('message-unfinished', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'main', text: 'partial answer' } }),
  ], { finalize: false })

  assert.equal(parsed.content, '')
  assert.equal(parsed.status, 'streaming')
  assert.equal(parsed.process.completed, false)
  assert.equal(parsed.process.collapsed, false)
  assert.equal(parsed.process.events.some(event => event.type === 'content' && event.content === 'partial answer'), true)
})

it('keeps failed-attempt fragments visible while a network retry is still pending', () => {
  const parsed = buildProcessFromEvents('message-retrying', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'failed', text: 'partial answer' } }),
    runEvent(2, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }),
  ], { finalize: false })

  assert.equal(parsed.process.events.some(event => event.type === 'content' && event.content === 'partial answer'), true)
})

it('rolls back failed-attempt fragments when a retry produces replacement content', () => {
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

it('keeps incomplete content when the user stops during a pending retry', () => {
  const parsed = buildProcessFromEvents('message-stopped', [
    runEvent(1, { type: 'content_delta', data: { contentId: 'failed', text: 'keep this partial answer' } }),
    runEvent(2, { type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }),
    runEvent(3, { type: 'run_cancelled', data: { reason: 'user' } }),
  ])

  assert.equal(parsed.process.events.some(event => event.type === 'content' && event.content === 'keep this partial answer'), true)
})

it('removes incomplete content when network retries are exhausted', () => {
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

it('agent lifecycle events are rendered as a nested tree with complete child events', () => {
  const parsed = buildProcessFromEvents('message-agent-tree', [
    runEvent(1, { type: 'agent_lifecycle', data: {
      agentPath: '/root',
      agentName: 'root',
      agentType: 'root',
      status: 'running',
    } }),
    runEvent(2, { type: 'agent_lifecycle', data: {
      agentPath: '/root/profile_one',
      parentAgentPath: '/root',
      agentName: 'profile_one',
      agentType: 'browser_worker',
      status: 'running',
    } }),
    runEvent(3, { type: 'thinking_delta', data: { agentPath: '/root/profile_one', thinkingId: 'think', text: 'checking' } }),
    runEvent(4, { type: 'tool_started', data: { agentPath: '/root/profile_one', toolName: 'browser_snapshot', toolId: 'tool', input: { url: 'x' } } }),
    runEvent(5, { type: 'tool_finished', data: { agentPath: '/root/profile_one', toolName: 'browser_snapshot', toolId: 'tool', output: 'done', status: 'success' } }),
    runEvent(6, { type: 'content_delta', data: { agentPath: '/root/profile_one', contentId: 'answer', text: '完成搜索' } }),
    runEvent(7, { type: 'agent_lifecycle', data: {
      agentPath: '/root/profile_one',
      parentAgentPath: '/root',
      agentName: 'profile_one',
      agentType: 'browser_worker',
      status: 'completed',
      report: '完成搜索',
    } }),
  ])

  const root = parsed.process.events.find(event => event.type === 'agent_lifecycle')
  assert.ok(root)
  assert.equal(root?.agentPath, '/root/profile_one')
  assert.deepEqual(root?.events.map(event => event.type), ['thinking', 'tool_call', 'content'])
  assert.equal(root?.events.find(event => event.type === 'tool_call')?.output, 'done')
})

it('agent event ids stay scoped by conversation, run and agent path', () => {
  const parsed = buildProcessFromEvents('message-worker-ids', [
    runEvent(1, { type: 'thinking_delta', data: { agentPath: '/root/one', thinkingId: 'llm-0', text: 'one' } }),
    runEvent(2, { type: 'thinking_delta', data: { agentPath: '/root/two', thinkingId: 'llm-0', text: 'two' } }),
  ], { finalize: false })
  const nodes = parsed.process.events.filter(event => event.type === 'agent_lifecycle')
  assert.equal(nodes.length, 2)
  assert.notEqual(nodes[0]?.events[0]?.id, nodes[1]?.events[0]?.id)
})

it('parallel agent nodes keep independent render revisions', () => {
  const parsed = buildProcessFromEvents('message-worker-revisions', [
    runEvent(1, { type: 'agent_lifecycle', data: { agentPath: '/root/one', parentAgentPath: '/root', agentName: 'one', agentType: 'browser_worker', status: 'running' } }),
    runEvent(2, { type: 'agent_lifecycle', data: { agentPath: '/root/two', parentAgentPath: '/root', agentName: 'two', agentType: 'browser_worker', status: 'running' } }),
    runEvent(3, { type: 'content_delta', data: { agentPath: '/root/one', contentId: 'answer', text: 'one' } }),
    runEvent(4, { type: 'content_delta', data: { agentPath: '/root/two', contentId: 'answer', text: 'two' } }),
  ], { finalize: false })

  const nodes = parsed.process.events.filter(event => event.type === 'agent_lifecycle')
  assert.deepEqual(nodes.map(node => node.renderRevision), [3, 4])
})

it('successful spawn tool rows are merged into their lifecycle groups', () => {
  const parsed = buildProcessFromEvents('message-worker-groups', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'spawn_agent', toolId: 'spawn-one', input: { name: 'one' } } }),
    runEvent(2, { type: 'tool_finished', data: { toolName: 'spawn_agent', toolId: 'spawn-one', output: 'started', status: 'success' } }),
    runEvent(3, { type: 'tool_started', data: { toolName: 'spawn_agent', toolId: 'spawn-two', input: { name: 'two' } } }),
    runEvent(4, { type: 'tool_finished', data: { toolName: 'spawn_agent', toolId: 'spawn-two', output: 'started', status: 'success' } }),
    runEvent(5, { type: 'content_delta', data: { contentId: 'after-spawns', text: '两个任务已经启动' } }),
    runEvent(6, { type: 'agent_lifecycle', data: { agentPath: '/root/one', parentAgentPath: '/root', agentName: 'one', agentType: 'browser_worker', status: 'running' } }),
    runEvent(7, { type: 'agent_lifecycle', data: { agentPath: '/root/two', parentAgentPath: '/root', agentName: 'two', agentType: 'browser_worker', status: 'running' } }),
  ], { finalize: false })

  assert.deepEqual(parsed.process.events.map(event => event.type), ['agent_lifecycle', 'agent_lifecycle', 'content'])
  assert.deepEqual(
    parsed.process.events
      .filter(event => event.type === 'agent_lifecycle')
      .map(event => event.agentName),
    ['one', 'two'],
  )
})

it('spawn tool rows remain visible when no lifecycle group was created', () => {
  const parsed = buildProcessFromEvents('message-worker-spawn-failed', [
    runEvent(1, { type: 'tool_started', data: { toolName: 'spawn_agent', toolId: 'spawn-failed', input: { name: 'failed-worker' } } }),
    runEvent(2, { type: 'tool_finished', data: { toolName: 'spawn_agent', toolId: 'spawn-failed', output: 'failed', status: 'failed' } }),
  ], { finalize: false })

  assert.deepEqual(parsed.process.events.map(event => event.type), ['tool_call'])
  assert.equal(parsed.process.events[0]?.status, 'failed')
})

it('same agent path stays isolated across conversations and runs', () => {
  const parsed = buildProcessFromEvents('message-scoped', [
    scopedRunEvent('conversation-1', 'run-1', 1, { type: 'content_delta', data: { agentPath: '/root/profile_one', contentId: 'answer', text: 'one' } }),
    scopedRunEvent('conversation-2', 'run-2', 2, { type: 'content_delta', data: { agentPath: '/root/profile_one', contentId: 'answer', text: 'two' } }),
  ], { finalize: false })
  const nodes = parsed.process.events.filter(event => event.type === 'agent_lifecycle')
  assert.equal(nodes.length, 2)
  assert.deepEqual(nodes.map(node => node.events.find(event => event.type === 'content')?.content), ['one', 'two'])
})

it('conversation history maps canonical events from the fixed camelCase detail contract', () => {
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
          runEvent(2, { type: 'run_completed', data: { finalAnswer: '' } }),
        ],
        createdAt: 1_753_516_860_000,
      },
    ],
    artifacts: [],
    hasMore: false,
    nextCursor: null,
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

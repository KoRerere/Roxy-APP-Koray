import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it, vi } from 'vitest'
import { projectMessagesFromRollout } from './rolloutHistory'

const testState = vi.hoisted(() => ({ root: '' }))
const getByUpstreamFileId = vi.hoisted(() => vi.fn())

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    sessionDir(conversationId: string) {
      return path.join(testState.root, 'sessions', conversationId)
    },
    sessionRollout(conversationId: string) {
      return path.join(testState.root, 'sessions', conversationId, 'rollout.jsonl')
    },
  },
}))

vi.mock('@/database/conversations', () => ({
  FileRecordStore: { getByUpstreamFileId },
}))

beforeAll(() => {
  testState.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-rollout-history-'))
})

beforeEach(() => {
  getByUpstreamFileId.mockReset()
})

afterAll(() => {
  fs.rmSync(testState.root, { recursive: true, force: true })
})

describe('rollout history projector', () => {
  it('ignores host window usage records when projecting chat messages', () => {
    const conversationId = 'conversation-report-window-usage'
    writeRollout(conversationId, [
      { type: 'user_input', message: { role: 'user', content: '执行任务' }, ts: 1 },
      { type: 'roxy_window_used', dirId: 'profile-1', turnId: 'turn-1', ts: 2 },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 3 },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.equal(messages.filter(message => message.role === 'user').length, 1)
    assert.ok(!JSON.stringify(messages).includes('roxy_window_used'))
    assert.ok(!JSON.stringify(messages).includes('profile-1'))
  })

  it('keeps a prepared user input visible after an interruption and replaces it when runtime persistence completes', () => {
    // Regression: UI 在用户输入持久化前发送 conversation.run.start，过早中断后无法恢复消息。
    // 修复：Agent 在 WebSocket 接收边界预存输入，并与 Runtime 随后写入的正式记录合并。
    const conversationId = 'conversation-prepared-input'
    const prepared = {
      type: 'user_input_prepared',
      turnId: 'message-1',
      message: {
        role: 'user',
        content: 'keep me',
        metadata: { turnId: 'message-1', prepared: true },
      },
      ts: 1000,
    }

    writeRollout(conversationId, [prepared])
    let messages = projectMessagesFromRollout(conversationId)
    assert.equal(messages.length, 2)
    assert.equal(messages[0]?.content, 'keep me')

    writeRollout(conversationId, [
      prepared,
      {
        type: 'user_input',
        message: {
          role: 'user',
          content: 'keep me',
          metadata: { turnId: 'message-1' },
        },
        ts: 1100,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 1200 },
    ])
    messages = projectMessagesFromRollout(conversationId)
    assert.equal(messages.filter(message => message.role === 'user').length, 1)
    assert.equal(messages[0]?.content, 'keep me')
  })

  it('restores attachment cards from visible user-input metadata after reload', () => {
    const conversationId = 'conversation-attachment-history'
    const attachments = [{
      fileId: 'local-image-1',
      fileName: 'image.png',
      mimeType: 'image/png',
      size: 3,
      url: '/api/files/local-image-1',
      localUrl: '/api/files/local-image-1',
      remoteUrl: 'https://oss.example/image.png',
      fileUrl: 'https://oss.example/image.png',
    }]
    writeRollout(conversationId, [
      {
        type: 'user_input',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'describe' }, { type: 'file', fileId: 'file-api-1' }],
          metadata: { attachments },
        },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [{
          type: 'message',
          id: 'answer-1',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'done' }],
        }],
        stopReason: 'end_turn',
        ts: 2000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 2100 },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(messages[0]?.metadata?.attachments, attachments)
    const userEvent = messages[1]?.events?.find(item => item.event.type === 'user_message')?.event
    assert.ok(userEvent?.type === 'user_message')
    assert.deepEqual(userEvent.data.attachments, attachments)
  })

  it('recovers current-version VLM cards from FileBlock and SQLite when metadata is absent', () => {
    const conversationId = 'conversation-legacy-vlm-attachment'
    getByUpstreamFileId.mockReturnValue({
      file_id: 'local-image-1',
      file_name: 'image.png',
      local_path: '/tmp/image.png',
      oss_url: 'https://oss.example/image.png',
      upstream_file_id: 'file-api-1',
      upstream_file_service: 'deepseek',
      mime_type: 'image/png',
      size: 3,
      hash: 'hash',
      source: 'upload',
      created_at: '2026-08-24T00:00:00Z',
      updated_at: '2026-08-24T00:00:00Z',
    })
    writeRollout(conversationId, [
      {
        type: 'user_input',
        message: {
          role: 'user',
          content: [{ type: 'text', text: 'describe' }, { type: 'file', fileId: 'file-api-1' }],
        },
        ts: 1000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 1100 },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(messages[0]?.metadata?.attachments, [{
      fileId: 'local-image-1',
      fileName: 'image.png',
      mimeType: 'image/png',
      size: 3,
      url: '/api/files/local-image-1',
      localUrl: '/api/files/local-image-1',
      remoteUrl: 'https://oss.example/image.png',
      fileUrl: 'https://oss.example/image.png',
    }])
  })

  it('replays a task report tool input and its accepted result', () => {
    const conversationId = 'conversation-task-report-history'
    const report = {
      taskName: '批量养号',
      params: [{
        key: 'browseDuration',
        name: '每个窗口的浏览时长',
        value: 15,
      }],
      windows: [{ dirId: 'profile-1', success: true, failureReason: '' }],
    }
    writeRollout(conversationId, [
      { type: 'user_input', message: { role: 'user', content: '执行养号任务' }, ts: 1000 },
      {
        type: 'assistant_turn',
        items: [{
          type: 'tool_call',
          id: 'report-1',
          callId: 'report-1',
          name: 'roxy_task_report',
          arguments: report,
          toolKind: 'function',
        }],
        stopReason: 'tool_use',
        ts: 2000,
      },
      {
        type: 'tool_result',
        result: { tool_use_id: 'report-1', content: '## Task report result\n\n- status: accepted', is_error: false },
        ts: 2100,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 2200 },
    ])

    const events = projectMessagesFromRollout(conversationId)[1]?.events ?? []
    const started = events.find(item => item.event.type === 'tool_started')?.event
    const finished = events.find(item => item.event.type === 'tool_finished')?.event

    assert.ok(started?.type === 'tool_started')
    assert.deepEqual(started.data.input, report)
    assert.ok(finished?.type === 'tool_finished')
    assert.equal(finished.data.status, 'success')
  })

  it('restores complete script output embedded in the tool result', () => {
    // Regression: replay discarded complete script logs already stored in small tool results.
    // Fixed by: preferring the existing Log output block before resolving a local file.
    const conversationId = 'conversation-inline-script-log-history'
    writeRollout(conversationId, scriptRollout({
      content: [
        'Script completed.',
        '',
        '## Log output',
        '',
        'Complete log (58 bytes; inline limit: 8192 bytes):',
        '',
        '```text',
        '[2026-08-19T08:00:00.000Z] [INFO] inline line',
        '```',
        '',
        '## Log file',
        '',
        `- path: \`${path.join(testState.root, 'missing', 'inline-run.log')}\``,
      ].join('\n'),
      dirIds: ['dir-1'],
    }))

    const scriptEvents = (projectMessagesFromRollout(conversationId)[1]?.events ?? [])
      .filter(item => item.event.type === 'script_output')

    assert.equal(scriptEvents.length, 1)
    const output = scriptEvents[0]?.event
    assert.ok(output?.type === 'script_output')
    assert.equal(output.data.dirId, 'dir-1')
    assert.equal(output.data.level, 'info')
    assert.equal(output.data.message, 'inline line')
    assert.equal(output.data.unavailableReason, undefined)
  })

  it('restores single-window script output from the local log file', () => {
    // Regression: script_output existed only in the live event stream, so reopening a
    // conversation recreated an empty script panel even though the local log still existed.
    // Fixed by: resolving the log path from the durable tool result and reading it during projection.
    const conversationId = 'conversation-script-log-history'
    const logPath = path.join(testState.root, 'workdir', 'test', 'logs', 'run-1.log')
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.writeFileSync(logPath, [
      '[2026-08-19T08:00:00.000Z] [INFO] first line',
      '[2026-08-19T08:00:01.000Z] [WARN] second line',
      '',
    ].join('\n'))
    writeRollout(conversationId, scriptRollout({
      content: `Script completed.\n\n## Log file\n\n- path: \`${logPath}\``,
      dirIds: ['dir-1'],
    }))

    const events = projectMessagesFromRollout(conversationId)[1]?.events ?? []
    const scriptEvents = events.filter(item => item.event.type === 'script_output')

    assert.deepEqual(events.map(item => item.event.type), [
      'run_started',
      'user_message',
      'tool_started',
      'script_output',
      'script_output',
      'tool_finished',
      'run_completed',
    ])
    assert.deepEqual(scriptEvents.map((item) => {
      if (item.event.type !== 'script_output') {
        return undefined
      }
      return [item.event.data.dirId, item.event.data.level, item.event.data.message]
    }), [
      ['dir-1', 'info', 'first line'],
      ['dir-1', 'warn', 'second line'],
    ])
  })

  it('restores multi-window script output from each local log file', () => {
    // Regression: batch tool results kept per-window log paths, but replay ignored them.
    // Fixed by: projecting each Window section into its matching script log stream.
    const conversationId = 'conversation-batch-script-log-history'
    const firstLogPath = path.join(testState.root, 'workdir', 'test', 'logs', 'run-1.log')
    const secondLogPath = path.join(testState.root, 'workdir', 'test', 'logs', 'run-2.log')
    fs.mkdirSync(path.dirname(firstLogPath), { recursive: true })
    fs.writeFileSync(firstLogPath, '[2026-08-19T08:00:00.000Z] [INFO] first window\n')
    fs.writeFileSync(secondLogPath, '[2026-08-19T08:00:01.000Z] [ERROR] second window\n')
    writeRollout(conversationId, scriptRollout({
      content: [
        '## Batch script result',
        '',
        '### Window `dir-1`',
        '- runId: `run-1`',
        '',
        '## Log file',
        '',
        `- path: \`${firstLogPath}\``,
        '',
        '### Window `dir-2`',
        '- runId: `run-2`',
        '',
        '## Log file',
        '',
        `- path: \`${secondLogPath}\``,
      ].join('\n'),
      dirIds: ['dir-1', 'dir-2'],
    }))

    const scriptEvents = (projectMessagesFromRollout(conversationId)[1]?.events ?? [])
      .filter(item => item.event.type === 'script_output')

    assert.deepEqual(scriptEvents.map((item) => {
      if (item.event.type !== 'script_output') {
        return undefined
      }
      return [
        item.event.data.dirId,
        item.event.data.scriptRunId,
        item.event.data.level,
        item.event.data.message,
      ]
    }), [
      ['dir-1', 'run-1', 'info', 'first window'],
      ['dir-2', 'run-2', 'error', 'second window'],
    ])
  })

  it('marks a missing local script log for localized frontend presentation', () => {
    // Regression: a removed local log left an indistinguishable empty script panel on replay.
    // Fixed by: emitting a structured file_missing reason that the frontend localizes.
    const conversationId = 'conversation-missing-script-log-history'
    const missingLogPath = path.join(testState.root, 'missing', 'run-1.log')
    writeRollout(conversationId, scriptRollout({
      content: `Script completed.\n\n## Log file\n\n- path: \`${missingLogPath}\``,
      dirIds: ['dir-1'],
    }))

    const missing = (projectMessagesFromRollout(conversationId)[1]?.events ?? [])
      .find(item => item.event.type === 'script_output')

    assert.ok(missing?.event.type === 'script_output')
    assert.equal(missing.event.data.dirId, 'dir-1')
    assert.equal(missing.event.data.message, '')
    assert.equal(missing.event.data.unavailableReason, 'file_missing')
  })

  it('does not report a missing log when the script result has no log reference', () => {
    const conversationId = 'conversation-script-not-started-history'
    writeRollout(conversationId, scriptRollout({
      content: 'Script "official:test" failed to start: browser unavailable',
      dirIds: ['dir-1'],
    }))

    const scriptEvents = (projectMessagesFromRollout(conversationId)[1]?.events ?? [])
      .filter(item => item.event.type === 'script_output')

    assert.deepEqual(scriptEvents, [])
  })

  it('projects assistant transcript items into frontend run events', () => {
    const conversationId = 'conversation-rollout-history'
    writeRollout(conversationId, [
      {
        type: 'session_start',
        sessionId: conversationId,
        createdAt: 1,
      },
      {
        type: 'user_input',
        message: {
          role: 'user',
          content: '<metadata><os>macOS 26.6</os><cwd>/tmp/work</cwd></metadata>',
          visible: false,
        },
        ts: 900,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'runtime user text' },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'msg-1',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'first rollout answer' }],
          },
          {
            type: 'tool_call',
            id: 'tool-1',
            callId: 'tool-1',
            name: 'search',
            arguments: { query: 'hello' },
            toolKind: 'function',
          },
        ],
        stopReason: 'tool_use',
        ts: 2000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'tool_call',
            id: 'tool-1',
            callId: 'tool-1',
            name: 'search',
            arguments: {},
            toolKind: 'function',
          },
        ],
        stopReason: 'tool_use',
        ts: 3000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'msg-2',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'rollout final answer' }],
          },
          {
            type: 'tool_call',
            id: 'tool-2',
            callId: 'tool-2',
            name: 'apply_patch',
            arguments: '*** Begin Patch\n*** Add File: report.csv\n+value\n*** End Patch',
            toolKind: 'custom',
          },
        ],
        stopReason: 'tool_use',
        ts: 5000,
      },
    ])

    const messages = projectMessagesFromRollout(conversationId, { latestRunId: 'run-rollout-history' })
    assert.deepEqual(
      messages.map((message) => [message.id, message.role, message.content]),
      [
        [`${conversationId}-rollout-user-1`, 'user', 'runtime user text'],
        [`${conversationId}-rollout-assistant-1`, 'assistant', 'rollout final answer'],
      ],
    )
    assert.deepEqual(
      messages[1]?.events?.map((event) => event.event.type),
      ['run_started', 'user_message', 'content_delta', 'tool_started', 'tool_started', 'content_delta', 'tool_started', 'run_completed'],
    )
    assert.deepEqual(
      messages[1]?.events
        ?.filter((event) => event.event.type === 'content_delta')
        .map((event) => (event.event.type === 'content_delta' ? event.event.data.text : '')),
      ['first rollout answer', 'rollout final answer'],
    )
    assert.deepEqual(
      messages[1]?.events?.map((event) => event.timestamp),
      [1000, 1000, 2000, 2000, 3000, 5000, 5000, 5000],
    )
    assert.equal(messages[1]?.events?.[0]?.runId, 'run-rollout-history')
    assert.equal(
      messages.some(message => message.content?.includes('<metadata>')),
      false,
    )
  })

  it('restores delegated subagent lifecycle and child events after reload', () => {
    const conversationId = 'conversation-subagent-history'
    const childSessionId = `${conversationId}:agent:child-one`
    writeRollout(conversationId, [
      { type: 'session_start', sessionId: conversationId, createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'run child' }, ts: 1000 },
      {
        type: 'assistant_turn',
        items: [{
          type: 'tool_call',
          id: 'spawn-one',
          callId: 'spawn-one',
          name: 'spawn_agent',
          arguments: { name: 'child_one', message: 'inspect page' },
          toolKind: 'function',
        }],
        stopReason: 'tool_use',
        ts: 2000,
      },
      { type: 'subagent_delegated', childSessionId, name: 'child_one', ts: 2100 },
      { type: 'tool_result', result: { tool_use_id: 'spawn-one', content: 'started', is_error: false }, ts: 2200 },
      {
        type: 'assistant_turn',
        items: [{ type: 'message', id: 'root-answer', role: 'assistant', content: [{ type: 'output_text', text: 'root done' }] }],
        stopReason: 'end_turn',
        ts: 5000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 5100 },
    ])
    writeRollout(childSessionId, [
      { type: 'session_start', sessionId: childSessionId, createdAt: 2050 },
      { type: 'user_input', message: { role: 'user', content: 'inspect page' }, ts: 2100 },
      {
        type: 'assistant_turn',
        items: [
          { type: 'reasoning', id: 'child-thinking', text: 'checking page', summary: [], visibility: 'full' },
          { type: 'tool_call', id: 'child-tool', callId: 'child-tool', name: 'browser_snapshot', arguments: {}, toolKind: 'function' },
        ],
        stopReason: 'tool_use',
        ts: 3000,
      },
      { type: 'tool_result', result: { tool_use_id: 'child-tool', content: 'snapshot', is_error: false }, ts: 3500 },
      {
        type: 'assistant_turn',
        items: [{ type: 'message', id: 'child-answer', role: 'assistant', content: [{ type: 'output_text', text: 'child done' }] }],
        stopReason: 'end_turn',
        ts: 4000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 4100 },
    ])

    const messages = projectMessagesFromRollout(conversationId, { latestRunId: 'run-subagent-history' })
    const events = messages[1]?.events ?? []
    const lifecycleEvents = events.filter(item => item.event.type === 'agent_lifecycle')
    const childEvents = events.filter((item) => {
      return 'agentPath' in item.event.data && item.event.data.agentPath === '/root/child_one'
    })

    assert.deepEqual(lifecycleEvents.map(item => item.event.type === 'agent_lifecycle' ? item.event.data.status : ''), ['starting', 'completed'])
    assert.deepEqual(childEvents.map(item => item.event.type), [
      'agent_lifecycle',
      'thinking_delta',
      'thinking_completed',
      'tool_started',
      'tool_finished',
      'content_delta',
      'agent_lifecycle',
    ])
  })

  it('keeps nested delegated agents under their parent path and avoids rollout cycles', () => {
    const conversationId = 'conversation-nested-subagent-history'
    const childSessionId = `${conversationId}:agent:child-one`
    const grandchildSessionId = `${conversationId}:agent:grandchild`
    writeRollout(conversationId, [
      { type: 'user_input', message: { role: 'user', content: 'run nested child' }, ts: 1000 },
      { type: 'subagent_delegated', childSessionId, name: 'child_one', ts: 1100 },
      { type: 'turn_completed', ts: 2000 },
    ])
    writeRollout(childSessionId, [
      { type: 'user_input', message: { role: 'user', content: 'run grandchild' }, ts: 1200 },
      { type: 'subagent_delegated', childSessionId: grandchildSessionId, name: 'grandchild', ts: 1300 },
      { type: 'turn_completed', ts: 2000 },
    ])
    writeRollout(grandchildSessionId, [
      { type: 'user_input', message: { role: 'user', content: 'cycle' }, ts: 1400 },
      { type: 'subagent_delegated', childSessionId, name: 'child_one', ts: 1500 },
      { type: 'turn_completed', ts: 2000 },
    ])

    const events = projectMessagesFromRollout(conversationId, { latestRunId: 'run-nested' })[1]?.events ?? []
    const lifecyclePaths = events
      .filter(item => item.event.type === 'agent_lifecycle')
      .map(item => item.event.type === 'agent_lifecycle' ? item.event.data.agentPath : '')
    assert.deepEqual(lifecyclePaths, [
      '/root/child_one',
      '/root/child_one/grandchild',
      '/root/child_one/grandchild',
      '/root/child_one',
    ])
  })

  it('uses terminal rollout facts for aborted turns', () => {
    const conversationId = 'conversation-rollout-aborted'
    writeRollout(conversationId, [
      {
        type: 'session_start',
        sessionId: conversationId,
        createdAt: 1,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'stop midway' },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'partial-answer',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'partial answer' }],
          },
        ],
        stopReason: 'end_turn',
        ts: 2000,
      },
      {
        type: 'turn_aborted',
        reason: 'user',
        message: 'Agent stopped: User cancelled',
        ts: 3000,
      },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(
      messages[1]?.events?.map((event) => event.event.type),
      ['run_started', 'user_message', 'content_delta', 'run_cancelled'],
    )
    assert.equal(messages[1]?.events?.at(-1)?.timestamp, 3000)
    assert.deepEqual(messages[1]?.events?.at(-1)?.event, {
      type: 'run_cancelled',
      data: {
        reason: 'user',
        message: 'Agent stopped: User cancelled',
      },
    })
  })

  it('preserves insufficient-points errors when projecting failed rollout history', () => {
    // Regression: live run_failed events carried insufficient_points and requestId, but
    // reopening the conversation rebuilt failed rollout turns as agent_internal_error.
    // Fixed by: normalizing the persisted terminal error message during history projection.
    const conversationId = 'conversation-rollout-insufficient-points'
    writeRollout(conversationId, [
      {
        type: 'session_start',
        sessionId: conversationId,
        createdAt: 1,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'run script' },
        ts: 1000,
      },
      {
        type: 'turn_error',
        phase: 'turn_failed',
        name: 'APIError',
        message: '402 {"code":"insufficient_points","message":"Your account points balance is insufficient","data":{"source":"local","category":"billing","retryable":false,"request_id":"3eea5fb5-0144-402a-b031-74023bec4b60"},"request_id":"3eea5fb5-0144-402a-b031-74023bec4b60"}',
        ts: 2000,
      },
      {
        type: 'turn_failed',
        message: '402 {"code":"insufficient_points","message":"Your account points balance is insufficient","data":{"source":"local","category":"billing","retryable":false,"request_id":"3eea5fb5-0144-402a-b031-74023bec4b60"},"request_id":"3eea5fb5-0144-402a-b031-74023bec4b60"}',
        ts: 2000,
      },
    ])

    const events = projectMessagesFromRollout(conversationId)[1]?.events ?? []
    const failed = events.at(-1)?.event

    assert.equal(failed?.type, 'run_failed')
    if (failed?.type === 'run_failed') {
      assert.deepEqual(failed.data, {
        code: 'insufficient_points',
        message: 'Your account points balance is insufficient',
        category: 'billing',
        retryable: false,
        source: 'local',
        requestId: '3eea5fb5-0144-402a-b031-74023bec4b60',
        httpStatus: 402,
      })
    }
  })

  it('projects multi-question ask_user calls into clarification HITL events', () => {
    const conversationId = 'conversation-rollout-ask-user'
    writeRollout(conversationId, [
      {
        type: 'user_input',
        message: { role: 'user', content: 'run task' },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'tool_call',
            id: 'ask-1',
            callId: 'ask-1',
            name: 'ask_user',
            arguments: {
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
            },
            toolKind: 'function',
          },
        ],
        stopReason: 'tool_use',
        ts: 2000,
      },
      {
        type: 'tool_result',
        result: {
          type: 'tool_result',
          tool_use_id: 'ask-1',
          content: JSON.stringify({ test_scope: '自动评论', execution_mode: '安全模式' }),
          is_error: false,
        },
        ts: 3000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'answer',
            role: 'assistant',
            content: [{ type: 'output_text', text: '继续执行' }],
          },
        ],
        stopReason: 'end_turn',
        ts: 4000,
      },
      {
        type: 'turn_completed',
        ts: 5000,
      },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(
      messages[1]?.events?.map(event => event.event.type),
      ['run_started', 'user_message', 'tool_started', 'approval_requested', 'tool_finished', 'approval_resolved', 'content_delta', 'run_completed'],
    )

    const requested = messages[1]?.events?.find(event => event.event.type === 'approval_requested')
    assert.equal(requested?.event.type, 'approval_requested')
    if (requested?.event.type === 'approval_requested') {
      assert.equal(requested.event.data.requestKind, 'clarification')
      assert.equal(requested.event.data.prompt, '请选择测试范围')
      assert.deepEqual(requested.event.data.questions, [
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
      ])
    }

    const resolved = messages[1]?.events?.find(event => event.event.type === 'approval_resolved')
    assert.equal(resolved?.event.type, 'approval_resolved')
    if (resolved?.event.type === 'approval_resolved') {
      assert.deepEqual(resolved.event.data.decisions, [
        { type: 'answer', answer: JSON.stringify({ test_scope: '自动评论', execution_mode: '安全模式' }) },
      ])
    }
  })

  it('projects collected artifacts into replayable frontend file events', () => {
    const conversationId = 'conversation-rollout-artifacts'
    writeRollout(conversationId, [
      {
        type: 'session_start',
        sessionId: conversationId,
        createdAt: 1,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'create a csv' },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'artifact-answer',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'created report' }],
          },
        ],
        stopReason: 'end_turn',
        ts: 2000,
      },
      {
        type: 'artifacts_collected',
        artifacts: [
          {
            fileId: 'file-1',
            fileName: 'report.csv',
            size: 1234,
            mimeType: 'text/csv',
            operation: 'create',
            source: 'apply_patch',
            agentPath: '/root',
          },
        ],
        ts: 2500,
      },
      {
        type: 'turn_completed',
        stopReason: 'end_turn',
        ts: 3000,
      },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(
      messages[1]?.events?.map(event => event.event.type),
      ['run_started', 'user_message', 'content_delta', 'artifact_created', 'run_completed'],
    )
    assert.deepEqual(
      messages[1]?.events?.find(event => event.event.type === 'artifact_created'),
      {
        conversationId,
        runId: `history-run-${conversationId}-1`,
        turnId: `${conversationId}-rollout-user-1`,
        assistantMessageId: `${conversationId}-rollout-assistant-1`,
        sequence: 4,
        timestamp: 2500,
        event: {
          type: 'artifact_created',
          data: {
            agentPath: '/root',
            fileId: 'file-1',
            fileName: 'report.csv',
            size: 1234,
            mimeType: 'text/csv',
            operation: 'create',
          },
        },
      },
    )
  })

  it('hydrates a partial assistant reply before an aborted terminal event', () => {
    const conversationId = 'conversation-rollout-partial-abort'
    writeRollout(conversationId, [
      {
        type: 'session_start',
        sessionId: conversationId,
        createdAt: 1,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'keep typing' },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'partial-reply',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'partial reply' }],
          },
        ],
        stopReason: 'end_turn',
        ts: 2000,
      },
      {
        type: 'turn_aborted',
        message: 'Agent stopped: User cancelled',
        ts: 3000,
      },
    ])

    const messages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(
      messages[1]?.events?.map((event) => event.event.type),
      ['run_started', 'user_message', 'content_delta', 'run_cancelled'],
    )
    assert.deepEqual(
      messages[1]?.events
        ?.filter((event) => event.event.type === 'content_delta')
        .map((event) => (event.event.type === 'content_delta' ? event.event.data.text : '')),
      ['partial reply'],
    )
  })

  it('can omit the active non-terminal turn while live websocket events own it', () => {
    const conversationId = 'conversation-rollout-active-turn'
    writeRollout(conversationId, [
      {
        type: 'session_start',
        sessionId: conversationId,
        createdAt: 1,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'finished turn' },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'message',
            id: 'done-answer',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'done' }],
          },
        ],
        stopReason: 'end_turn',
        ts: 2000,
      },
      {
        type: 'turn_completed',
        stopReason: 'end_turn',
        ts: 2100,
      },
      {
        type: 'user_input',
        message: { role: 'user', content: 'active turn' },
        ts: 3000,
      },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'reasoning',
            id: 'active-thinking',
            text: 'thinking',
          },
        ],
        stopReason: 'end_turn',
        ts: 4000,
      },
    ])

    const messages = projectMessagesFromRollout(conversationId, {
      latestRunId: 'run-active',
      latestRunStatus: 'streaming',
      excludeActiveTurn: true,
    })

    assert.deepEqual(
      messages.map(message => [message.role, message.content]),
      [
        ['user', 'finished turn'],
        ['assistant', 'done'],
      ],
    )
    assert.deepEqual(
      messages[1]?.events?.map(event => event.event.type),
      ['run_started', 'user_message', 'content_delta', 'run_completed'],
    )
  })

  it('keeps a task replay isolated when the task conversation later receives chat', () => {
    const conversationId = 'task-conversation-with-follow-up'
    writeRollout(conversationId, [
      {
        type: 'user_input',
        message: {
          role: 'user',
          content: 'scheduled task input',
          metadata: { source: 'task-run', taskLogId: 'task-log-1' },
        },
        ts: 1000,
      },
      {
        type: 'assistant_turn',
        items: [{
          type: 'message',
          id: 'task-answer',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'task answer' }],
        }],
        stopReason: 'end_turn',
        ts: 2000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 2100 },
      {
        type: 'user_input',
        message: { role: 'user', content: 'follow-up chat' },
        ts: 3000,
      },
      {
        type: 'assistant_turn',
        items: [{
          type: 'message',
          id: 'chat-answer',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'chat answer' }],
        }],
        stopReason: 'end_turn',
        ts: 4000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 4100 },
    ])

    const taskMessages = projectMessagesFromRollout(conversationId, {
      source: 'scheduled_task',
      taskLogId: 'task-log-1',
    })
    assert.deepEqual(taskMessages.map(message => [message.role, message.content]), [
      ['user', 'scheduled task input'],
      ['assistant', 'task answer'],
    ])

    const allMessages = projectMessagesFromRollout(conversationId)
    assert.deepEqual(allMessages.map(message => [message.role, message.content]), [
      ['user', 'scheduled task input'],
      ['assistant', 'task answer'],
      ['user', 'follow-up chat'],
      ['assistant', 'chat answer'],
    ])
  })

  it('projects completed web search and open-page items into tool lifecycles', () => {
    const conversationId = 'conversation-web-search-history'
    writeRollout(conversationId, [
      { type: 'user_input', message: { role: 'user', content: 'compare products' }, ts: 1000 },
      {
        type: 'assistant_turn',
        items: [
          {
            type: 'web_search_call',
            id: 'ws-search',
            status: 'completed',
            action: {
              type: 'search',
              queries: ['RoxyBrowser pricing', 'AdsPower pricing', 'ws_call_id=ws-search'],
            },
          },
          {
            type: 'web_search_call',
            id: 'ws-open',
            status: 'completed',
            action: {
              type: 'open_page',
              url: 'https://roxybrowser.cn/pricing#ws_call_id=ws-open',
            },
          },
          {
            type: 'web_search_call',
            id: 'ws-find',
            status: 'completed',
            action: {
              type: 'find_in_page',
              url: 'https://roxybrowser.cn/faqs#ws_call_id=ws-find',
              pattern: '普通浏览器',
            },
          },
          {
            type: 'web_search_call',
            id: 'ws-unknown',
            status: 'completed',
          },
          {
            type: 'message',
            id: 'answer',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'done' }],
          },
        ],
        stopReason: 'end_turn',
        ts: 2000,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 2100 },
    ])

    const messages = projectMessagesFromRollout(conversationId, { latestRunId: 'run-web-search' })
    const toolEvents = messages[1]?.events?.filter((item) => {
      return item.event.type === 'tool_started' || item.event.type === 'tool_finished'
    }) ?? []

    assert.deepEqual(toolEvents.map(item => item.event.type), [
      'tool_started',
      'tool_finished',
      'tool_started',
      'tool_finished',
      'tool_started',
      'tool_finished',
      'tool_started',
      'tool_finished',
    ])
    assert.deepEqual(
      toolEvents.map((item) => {
        if (item.event.type === 'tool_started') {
          return [item.event.data.toolName, item.event.data.toolId, item.event.data.input]
        }
        if (item.event.type === 'tool_finished') {
          return [item.event.data.toolName, item.event.data.toolId, item.event.data.status, item.event.data.output]
        }
        return []
      }),
      [
        ['web_search', 'ws-search', {
          type: 'search',
          queries: ['RoxyBrowser pricing', 'AdsPower pricing', 'ws_call_id=ws-search'],
        }],
        ['web_search', 'ws-search', 'success', null],
        ['web_search', 'ws-open', {
          type: 'open_page',
          url: 'https://roxybrowser.cn/pricing#ws_call_id=ws-open',
        }],
        ['web_search', 'ws-open', 'success', null],
        ['web_search', 'ws-find', {
          type: 'find_in_page',
          url: 'https://roxybrowser.cn/faqs#ws_call_id=ws-find',
          pattern: '普通浏览器',
        }],
        ['web_search', 'ws-find', 'success', null],
        ['web_search', 'ws-unknown', null],
        ['web_search', 'ws-unknown', 'success', null],
      ],
    )
  })
})

function scriptRollout(options: { content: string, dirIds: string[] }): unknown[] {
  return [
    { type: 'user_input', message: { role: 'user', content: 'run script' }, ts: 1000 },
    {
      type: 'assistant_turn',
      items: [{
        type: 'tool_call',
        id: 'tool-script',
        callId: 'tool-script',
        name: 'roxy_script_run',
        arguments: { scriptPath: 'official:test', dirIds: options.dirIds },
        toolKind: 'function',
      }],
      stopReason: 'tool_use',
      ts: 2000,
    },
    {
      type: 'tool_result',
      result: {
        type: 'tool_result',
        tool_use_id: 'tool-script',
        content: options.content,
        is_error: false,
      },
      ts: 3000,
    },
    { type: 'turn_completed', stopReason: 'end_turn', ts: 4000 },
  ]
}

function writeRollout(conversationId: string, events: unknown[]): void {
  const rolloutPath = path.join(testState.root, 'sessions', conversationId, 'rollout.jsonl')
  fs.mkdirSync(path.dirname(rolloutPath), { recursive: true })
  fs.writeFileSync(rolloutPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`)
}

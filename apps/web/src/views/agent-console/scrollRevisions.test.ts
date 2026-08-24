import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- 项目定向测试由 tsx --test 直接运行
import test from 'node:test'
import { buildProcessScrollRevisions } from './scrollRevisions'

test('process scroll revisions only track expanded thinking and grouped events', () => {
  const items = [
    {
      type: 'event',
      event: {
        id: 'thinking-1',
        type: 'thinking',
        content: 'hidden',
        status: 'running',
      },
    },
    {
      type: 'group',
      id: 'group-1',
      events: [
        { id: 'tool-1', type: 'tool_call' },
        { id: 'thinking-2', type: 'thinking', content: 'inside', status: 'running' },
      ],
    },
    {
      type: 'script_logs',
      id: 'script-1',
      events: [
        { id: 'log-1', type: 'script_log', lines: [{ message: 'line' }] },
      ],
    },
  ] as any

  assert.deepEqual(buildProcessScrollRevisions(items, {}), {})

  assert.deepEqual(buildProcessScrollRevisions(items, {
    'thinking-1': true,
    'group-1': true,
    'script-1': true,
  }), {
    'thinking:thinking-1': 'running:6',
    'group-1': '2:thinking-2:6',
    'script-grid:script-1': '1:log-1:1:4',
  })
})

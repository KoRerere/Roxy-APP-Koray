import assert from 'node:assert/strict'
// Keep this file on the lightweight Node test runner used by historyAdapter.test.ts.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import type { AgentProcessEvent } from './types'
import { getProcessGroupPrimaryEvent, groupProcessEvents, splitProcessEventBlocks } from './processEventGrouping'

test('groups consecutive thinking and tool events and uses the latest non-thinking event as the title source', () => {
  const thinking = { id: 'thinking-1', type: 'thinking', title: '思考中', content: '分析任务' } satisfies AgentProcessEvent
  const read = { id: 'tool-1', type: 'tool_call', toolName: 'read_file', target: 'a.ts' } satisfies AgentProcessEvent
  const run = { id: 'tool-2', type: 'tool_call', toolName: 'exec_command', target: 'abc.ts' } satisfies AgentProcessEvent
  const items = groupProcessEvents([thinking, read, run], 'root')

  assert.equal(items.length, 1)
  assert.equal(items[0]?.type, 'group')
  assert.equal(getProcessGroupPrimaryEvent([thinking, read, run]), run)
})

test('keeps a live event group id stable when later events are appended', () => {
  const thinking = { id: 'thinking-1', type: 'thinking', title: '思考中', content: '分析任务' } satisfies AgentProcessEvent
  const read = { id: 'tool-1', type: 'tool_call', toolName: 'read_file', target: 'a.ts' } satisfies AgentProcessEvent
  const run = { id: 'tool-2', type: 'tool_call', toolName: 'exec_command', target: 'abc.ts' } satisfies AgentProcessEvent
  const initialItems = groupProcessEvents([thinking, read], 'root-events')
  const updatedItems = groupProcessEvents([thinking, read, run], 'root-events')
  const initialGroup = initialItems[0]
  const updatedGroup = updatedItems[0]

  assert.equal(initialGroup?.type, 'group')
  assert.equal(updatedGroup?.type, 'group')
  assert.equal(
    initialGroup?.type === 'group' ? initialGroup.id : undefined,
    updatedGroup?.type === 'group' ? updatedGroup.id : undefined,
  )
})

test('keeps a single tool as a standalone non-group item and breaks groups around content', () => {
  const read = { id: 'tool-1', type: 'tool_call', toolName: 'read_file', target: 'a.ts' } satisfies AgentProcessEvent
  const content = { id: 'content-1', type: 'content', content: '阶段结果' } satisfies AgentProcessEvent
  const write = { id: 'tool-2', type: 'tool_call', toolName: 'apply_patch', target: 'b.ts' } satisfies AgentProcessEvent
  const items = groupProcessEvents([read, content, write], 'root')

  assert.deepEqual(items.map(item => item.type), ['event', 'content', 'event'])
})

test('keeps HITL requests outside nearby event groups', () => {
  const thinking = { id: 'thinking-1', type: 'thinking', title: '思考中', content: '分析任务' } satisfies AgentProcessEvent
  const hitl = { id: 'hitl-1', type: 'hitl', title: '正在询问问题', prompt: '请选择参数', status: 'running' } satisfies AgentProcessEvent
  const run = { id: 'tool-1', type: 'tool_call', toolName: 'exec_command', target: 'abc.ts' } satisfies AgentProcessEvent
  const items = groupProcessEvents([thinking, hitl, run], 'root')

  assert.deepEqual(items.map(item => item.type), ['event', 'event', 'event'])
  assert.equal(items[1]?.type === 'event' ? items[1].event.type : undefined, 'hitl')
})

test('keeps each spawn_agent call as its own event instead of grouping parallel spawns', () => {
  const first = { id: 'spawn-1', type: 'tool_call', toolName: 'spawn_agent', input: { name: 'one' } } satisfies AgentProcessEvent
  const second = { id: 'spawn-2', type: 'tool_call', toolName: 'spawn_agent', input: { name: 'two' } } satisfies AgentProcessEvent
  const items = groupProcessEvents([first, second], 'root')

  assert.deepEqual(items.map(item => item.type), ['event', 'event'])
})

test('groups adjacent logs from the same script tool call without merging other script calls', () => {
  const first = { id: 'script-1', type: 'script_log', toolId: 'tool-1', dirId: 'dir-1', lines: [] } satisfies AgentProcessEvent
  const second = { id: 'script-2', type: 'script_log', toolId: 'tool-1', dirId: 'dir-2', lines: [] } satisfies AgentProcessEvent
  const third = { id: 'script-3', type: 'script_log', toolId: 'tool-2', dirId: 'dir-3', lines: [] } satisfies AgentProcessEvent
  const items = groupProcessEvents([first, second, third], 'root')

  assert.deepEqual(items.map(item => item.type), ['script_logs', 'event'])
  assert.deepEqual(items[0]?.type === 'script_logs' ? items[0].events : [], [first, second])
})

test('keeps a single script log in the existing thinking and tool event group', () => {
  const thinking = { id: 'thinking-1', type: 'thinking', title: '思考中', content: '分析任务' } satisfies AgentProcessEvent
  const script = { id: 'script-1', type: 'script_log', toolId: 'tool-1', dirId: 'dir-1', lines: [] } satisfies AgentProcessEvent
  const tool = { id: 'tool-2', type: 'tool_call', toolName: 'read_file' } satisfies AgentProcessEvent
  const items = groupProcessEvents([thinking, script, tool], 'root')

  assert.equal(items.length, 1)
  assert.equal(items[0]?.type, 'group')
})

test('keeps subagent lifecycle entries at their original position between root event blocks', () => {
  const before = { id: 'tool-before', type: 'tool_call', toolName: 'read_file' } satisfies AgentProcessEvent
  const child = {
    id: 'agent-child',
    type: 'agent_lifecycle',
    agentPath: '/root/child',
    agentName: 'child',
    agentType: 'browser_worker',
    lifecycleStatus: 'running',
    events: [],
    children: [],
  } satisfies AgentProcessEvent
  const after = { id: 'tool-after', type: 'tool_call', toolName: 'apply_patch' } satisfies AgentProcessEvent
  const blocks = splitProcessEventBlocks([before, child, after], 'root')

  assert.deepEqual(blocks.map(block => block.type), ['events', 'agent_lifecycle', 'events'])
  assert.equal(blocks[1]?.type === 'agent_lifecycle' ? blocks[1].event : undefined, child)
})

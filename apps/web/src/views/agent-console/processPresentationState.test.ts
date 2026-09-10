import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Agent Console 定向测试使用轻量 Node runner
import { it } from 'node:test'
import type { AgentProcessEvent } from './types'
import { markProcessEventsStopped, retryIconName } from './processPresentationState'

it('stops nested active agent lifecycle presentation after a user cancellation', () => {
  // 回归：停止根 run 只会结束嵌套事件状态，子 agent 生命周期仍显示运行中，导致最后一条过程标签持续高亮。
  // 修复：递归结束事件时，同步把仍活动的子 agent 生命周期标为已取消。
  const events: AgentProcessEvent[] = [{
    id: 'agent-parent',
    type: 'agent_lifecycle',
    agentPath: '/root/parent',
    agentName: 'parent',
    agentType: 'general-purpose',
    lifecycleStatus: 'running',
    status: 'running',
    events: [{
      id: 'tool-1',
      type: 'tool_call',
      toolName: 'read_file',
      status: 'running',
    }],
    children: [{
      id: 'agent-child',
      type: 'agent_lifecycle',
      agentPath: '/root/parent/child',
      agentName: 'child',
      agentType: 'general-purpose',
      lifecycleStatus: 'starting',
      status: 'pending',
      events: [{
        id: 'thinking-1',
        type: 'thinking',
        title: '正在思考',
        content: '',
        status: 'running',
      }],
      children: [],
    }],
  }]

  markProcessEventsStopped(events)

  const parent = events[0]
  assert.ok(parent?.type === 'agent_lifecycle')
  assert.equal(parent.lifecycleStatus, 'cancelled')
  assert.equal(parent.status, 'failed')
  assert.equal(parent.events[0]?.status, 'failed')

  const child = parent.children[0]
  assert.ok(child)
  assert.equal(child.lifecycleStatus, 'cancelled')
  assert.equal(child.status, 'failed')
  assert.equal(child.events[0]?.status, 'failed')
})

it('uses a static full Wi-Fi icon after reconnecting', () => {
  // 回归：重连成功后仍使用循环动画图标。
  // 修复：仅在重试进行中展示动画图标。
  assert.equal(retryIconName('running'), 'base/rx_ic_wifi2')
  assert.equal(retryIconName('success'), 'base/rx_ic_wifi')
})

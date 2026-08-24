import { describe, expect, it, vi } from 'vitest'
import { computed, reactive, watch } from 'vue'

Object.assign(globalThis, { computed, reactive, watch })

vi.stubGlobal('$t', (message: string, values?: Record<string, unknown>) =>
  message.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? `{${key}}`)))

vi.mock('./useAgentChannel', () => ({
  useAgentChannelState: () => ({
    connected: { value: false },
    lastError: { value: undefined },
    profileMonitorSnapshot: { value: undefined },
    taskMonitorSnapshot: { value: undefined },
  }),
}))
const { mapProfileSnapshot } = await import('./useProfileMonitor')

describe('profile monitor mapping', () => {
  it('groups running profiles by owner and keeps idle profiles collapsed separately', () => {
    const groups = mapProfileSnapshot({
      type: 'snapshot',
      data: {
        generatedAt: 10,
        profiles: [
          {
            dirId: 'running-1',
            status: 'running',
            connectedAt: 1,
            updatedAt: 9,
            owner: {
              taskId: 'task-1',
              title: 'Collect report',
              sourceType: 'chat',
              conversationId: 'conversation-1',
              runId: 'run-1',
              startedAt: 2,
            },
            events: [],
          },
          {
            dirId: 'idle-1',
            status: 'idle',
            connectedAt: 1,
            updatedAt: 8,
            idleSince: 7,
            events: [],
          },
        ],
      },
    })

    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      id: 'task-1',
      title: 'Collect report',
      kind: 'running',
      expanded: true,
      tasks: [{ dirId: 'running-1', status: 'running' }],
    })
    expect(groups[1]).toMatchObject({
      id: 'profile-monitor-idle',
      kind: 'idle',
      expanded: false,
      tasks: [{ dirId: 'idle-1', status: 'idle' }],
    })
  })

  it('uses event-list labels for browser operation summaries', () => {
    // Regression: profile monitoring only split raw tool names into words,
    // so browser actions were less readable than the conversation event list.
    // Fixed by: map monitor stages through the shared friendlyToolName helper.
    const groups = mapProfileSnapshot({
      type: 'snapshot',
      data: {
        generatedAt: 10,
        profiles: [{
          dirId: 'running-1',
          status: 'running',
          connectedAt: 1,
          updatedAt: 9,
          owner: {
            taskId: 'task-1',
            title: 'Browse site',
            sourceType: 'chat',
            startedAt: 2,
          },
          events: [
            {
              id: 'navigate',
              stage: 'end',
              toolName: 'mcp_roxybrowser_playwright_chat_1__browser_navigate',
              input: { url: 'https://example.com/private?q=1' },
              success: true,
              timestamp: 8,
            },
            {
              id: 'click',
              stage: 'start',
              toolName: 'mcp_roxybrowser_playwright_chat_1__browser_click',
              input: { element: '登录按钮', text: 'secret' },
              timestamp: 9,
            },
          ],
        }],
      },
    })

    const task = groups[0]?.tasks[0]
    expect(task?.events.map(event => event.summary)).toEqual([
      '已打开网页 example.com',
      '正在点击页面元素 登录按钮',
    ])
    expect(task?.subtitle).toBe('正在点击页面元素 登录按钮')
  })
})

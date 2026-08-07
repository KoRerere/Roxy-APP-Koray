import { afterEach, describe, expect, it } from 'vitest'
import { taskMonitorHub } from '@/core/task-monitor'
import { createBrowserOpsLoggingMiddleware, extractBrowserOpenEntries, normalizeBrowserEndpoint } from './browserOpsLogging'

describe('browserOpsLogging task monitor helpers', () => {
  afterEach(() => {
    taskMonitorHub.clear()
  })

  it('maps each opened browser to its CDP endpoint', () => {
    const result = `**Workspace:** 116613
**Total Requests:** 2
**Success:** 2
**Failed:** 0

✅ **Successfully opened 2 browser(s):**

**Browser 9c9d4d2a11205a44d88ce29817555e79** (PID:15063)
  - CDP WebSocket: \`ws://127.0.0.1:56550/devtools/browser/255aabe9-554b-41dc-bf0a-4b10e497af6c\`

**Browser adce21f09a0972f151ab40fcfdf31902** (PID:15064)
  - CDP WebSocket: \`ws://127.0.0.1:56551/devtools/browser/b8f34a26-0dfa-4505-add2-bdc733d588c6\`
`

    expect(extractBrowserOpenEntries(result)).toEqual([
      {
        dirId: '9c9d4d2a11205a44d88ce29817555e79',
        ws: 'ws://127.0.0.1:56550/devtools/browser/255aabe9-554b-41dc-bf0a-4b10e497af6c',
        browserType: undefined,
      },
      {
        dirId: 'adce21f09a0972f151ab40fcfdf31902',
        ws: 'ws://127.0.0.1:56551/devtools/browser/b8f34a26-0dfa-4505-add2-bdc733d588c6',
        browserType: undefined,
      },
    ])
  })

  it('normalizes endpoints copied from markdown tool results', () => {
    expect(normalizeBrowserEndpoint('`WS://127.0.0.1:56550/devtools/browser/ABC`,')).toBe(
      'ws://127.0.0.1:56550/devtools/browser/ABC',
    )
  })

  it('attaches a browser after roxy_browser_launch succeeds', async () => {
    taskMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Launch browser',
      sourceType: 'chat',
    })
    const middleware = createBrowserOpsLoggingMiddleware({
      taskId: 'task-1',
      conversationId: 'conv-1',
      workerId: 'worker-1',
    }) as any

    await middleware.wrapToolCall(
      {
        toolCall: {
          name: 'roxy_browser_launch',
          args: {
            dirId: 'profile-1',
            browser: 'chrome',
          },
        },
      },
      async () => JSON.stringify({
        browsers: [
          {
            dirId: 'profile-1',
            endpoint: 'ws://127.0.0.1:56550/devtools/browser/abc',
            connected: true,
            pageUrl: 'https://example.com/',
            browserType: 'chrome',
          },
        ],
      }),
    )

    const snapshot = taskMonitorHub.getSnapshot()
    expect(snapshot.data.tasks).toHaveLength(1)
    expect(snapshot.data.tasks[0].browsers[0]).toMatchObject({
      id: 'profile-1',
      dirId: 'profile-1',
      ws: 'ws://127.0.0.1:56550/devtools/browser/abc',
    })
  })
})

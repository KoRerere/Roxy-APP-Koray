import { afterEach, describe, expect, it, vi } from 'vitest'
import { API } from '@/api'
import { env } from '@/config'
import { taskMonitorHub } from './hub'

async function settleAsyncWork(): Promise<void> {
  for (let index = 0; index < 5; index++)
    await Promise.resolve()
}

describe('taskMonitorHub', () => {
  afterEach(() => {
    taskMonitorHub.clear()
    vi.restoreAllMocks()
  })

  it('only exposes tasks after a browser is attached and releases them on finish', () => {
    taskMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Check browser',
      sourceType: 'chat',
      conversationId: 'conv-1',
      runId: 'run-1',
    })

    expect(taskMonitorHub.getSnapshot().data.tasks).toHaveLength(0)

    taskMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
      label: 'dir-1',
      ws: 'ws://localhost/devtools/browser/1',
      browserType: 'chromium',
    })

    let snapshot = taskMonitorHub.getSnapshot()
    expect(snapshot.data.tasks).toHaveLength(1)
    expect(snapshot.data.tasks[0].browsers).toMatchObject([
      {
        id: 'browser-1',
        dirId: 'dir-1',
        ws: 'ws://localhost/devtools/browser/1',
        browserType: 'chromium',
      },
    ])

    taskMonitorHub.recordBrowserEvent({
      taskId: 'task-1',
      browserId: 'browser-1',
      stage: 'end',
      toolName: 'browser_click',
      input: { selector: '#submit' },
      result: 'clicked',
      success: true,
      durationMs: 42,
    })

    snapshot = taskMonitorHub.getSnapshot()
    expect(snapshot.data.tasks[0].browsers[0].events).toMatchObject([
      {
        stage: 'end',
        toolName: 'browser_click',
        input: { selector: '#submit' },
        result: 'clicked',
        success: true,
        durationMs: 42,
      },
    ])

    taskMonitorHub.finishTask('task-1')

    expect(taskMonitorHub.getSnapshot().data.tasks).toHaveLength(0)
  })

  it('removes a completed browser while retaining other active browsers', () => {
    taskMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Batch script',
      sourceType: 'script',
    })
    taskMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
      label: 'dir-1',
    })
    taskMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-2',
      dirId: 'dir-2',
      label: 'dir-2',
    })

    taskMonitorHub.finishBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
    })

    const snapshot = taskMonitorHub.getSnapshot()
    expect(snapshot.data.tasks).toHaveLength(1)
    expect(snapshot.data.tasks[0].browsers).toMatchObject([
      { id: 'browser-2', dirId: 'dir-2' },
    ])
  })

  it('hides a task after its last browser finishes and allows a later browser to reappear', () => {
    taskMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Batch script',
      sourceType: 'script',
    })
    taskMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
      label: 'dir-1',
    })

    taskMonitorHub.applyEvent({
      type: 'browser_finished',
      data: { taskId: 'task-1', dirId: 'dir-1' },
    })
    expect(taskMonitorHub.getSnapshot().data.tasks).toHaveLength(0)

    taskMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-2',
      dirId: 'dir-2',
      label: 'dir-2',
    })
    expect(taskMonitorHub.getSnapshot().data.tasks[0].browsers).toMatchObject([
      { id: 'browser-2', dirId: 'dir-2' },
    ])
  })

  it('hydrates browser details by dirId in the background', async () => {
    const originalServerUrl = env.ROXY_SERVER_URL
    const originalUserToken = env.ROXY_USER_TOKEN
    env.ROXY_SERVER_URL = 'http://localhost:12345'
    env.ROXY_USER_TOKEN = 'token'

    const listWindows = vi.spyOn(API.window, 'userGetWindowInfoListList')
      .mockResolvedValueOnce({
        code: 0,
        msg: 'ok',
        data: {
          total: 2,
          rows: [{ dirId: 'dir-2', windowName: 'MOU-73' }],
        },
      } as any)
      .mockResolvedValueOnce({
        code: 0,
        msg: 'ok',
        data: {
          total: 2,
          rows: [
            {
              dirId: 'dir-1',
              windowName: 'MOU-72',
              windowSortNum: 72,
              lastCountry: 'us',
              platformUserName: 'dance_daily',
              platformUrl: 'https://www.tiktok.com/@dance_daily',
            },
          ],
        },
      } as any)

    try {
      taskMonitorHub.startTask({
        taskId: 'task-1',
        title: 'Check browser',
        sourceType: 'chat',
      })

      taskMonitorHub.attachBrowser({
        taskId: 'task-1',
        browserId: 'browser-1',
        dirId: 'dir-1',
        label: 'dir-1',
      })

      await vi.waitFor(() => {
        expect(taskMonitorHub.getSnapshot().data.tasks[0].browsers[0]).toMatchObject({
          windowName: 'MOU-72',
          windowSortNum: 72,
          platformUrl: 'https://www.tiktok.com/@dance_daily',
          platformUserName: 'dance_daily',
          countryCode: 'US',
        })
      })
      expect(listWindows).toHaveBeenNthCalledWith(1, {
        page_index: 1,
        page_size: 100,
        isDelete: 0,
        orderName: 'createTime',
        orderType: 'desc',
      })
      expect(listWindows).toHaveBeenNthCalledWith(2, {
        page_index: 2,
        page_size: 100,
        isDelete: 0,
        orderName: 'createTime',
        orderType: 'desc',
      })
    }
    finally {
      env.ROXY_SERVER_URL = originalServerUrl
      env.ROXY_USER_TOKEN = originalUserToken
    }
  })

  it('retries browser details after a v1 list miss instead of caching the miss permanently', async () => {
    const originalServerUrl = env.ROXY_SERVER_URL
    const originalUserToken = env.ROXY_USER_TOKEN
    env.ROXY_SERVER_URL = 'http://localhost:12345'
    env.ROXY_USER_TOKEN = 'token'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-31T08:00:00.000Z'))

    const listWindows = vi.spyOn(API.window, 'userGetWindowInfoListList')
      .mockResolvedValueOnce({
        code: 0,
        msg: 'ok',
        data: { total: 0, rows: [] },
      } as any)
      .mockResolvedValueOnce({
        code: 0,
        msg: 'ok',
        data: {
          total: 1,
          rows: [{ dirId: 'dir-1', windowName: 'MOU-72', platformUserName: 'dance_daily' }],
        },
      } as any)

    try {
      taskMonitorHub.startTask({
        taskId: 'task-1',
        title: 'Check browser',
        sourceType: 'chat',
      })
      taskMonitorHub.attachBrowser({
        taskId: 'task-1',
        browserId: 'browser-1',
        dirId: 'dir-1',
        label: 'dir-1',
      })
      await settleAsyncWork()

      expect(listWindows).toHaveBeenCalledTimes(1)
      expect(taskMonitorHub.getSnapshot().data.tasks[0].browsers[0].windowName).toBeUndefined()

      vi.setSystemTime(new Date('2026-07-31T08:00:11.000Z'))
      taskMonitorHub.recordBrowserEvent({
        taskId: 'task-1',
        browserId: 'browser-1',
        dirId: 'dir-1',
        stage: 'end',
        toolName: 'run_script',
        success: true,
      })
      await settleAsyncWork()

      expect(listWindows).toHaveBeenCalledTimes(2)
      expect(taskMonitorHub.getSnapshot().data.tasks[0].browsers[0]).toMatchObject({
        windowName: 'MOU-72',
        platformUserName: 'dance_daily',
      })
    }
    finally {
      vi.useRealTimers()
      env.ROXY_SERVER_URL = originalServerUrl
      env.ROXY_USER_TOKEN = originalUserToken
    }
  })
})

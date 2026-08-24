import { afterEach, describe, expect, it, vi } from 'vitest'
import { API } from '@/api'
import { env } from '@/config'
import { profileMonitorHub } from './hub'

async function settleAsyncWork(): Promise<void> {
  for (let index = 0; index < 5; index++) {
    await Promise.resolve()
  }
}

describe('profileMonitorHub', () => {
  afterEach(() => {
    profileMonitorHub.clear()
    vi.restoreAllMocks()
  })

  it('only exposes tasks after a browser is attached and releases them on finish', () => {
    profileMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Check browser',
      sourceType: 'chat',
      conversationId: 'conv-1',
      runId: 'run-1',
    })

    expect(profileMonitorHub.getSnapshot().data.tasks).toHaveLength(0)

    profileMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
      label: 'dir-1',
      ws: 'ws://localhost/devtools/browser/1',
      browserType: 'chromium',
    })

    let snapshot = profileMonitorHub.getSnapshot()
    expect(snapshot.data.tasks).toHaveLength(1)
    expect(snapshot.data.tasks[0].browsers).toMatchObject([
      {
        id: 'browser-1',
        dirId: 'dir-1',
        ws: 'ws://localhost/devtools/browser/1',
        browserType: 'chromium',
      },
    ])

    profileMonitorHub.recordBrowserEvent({
      taskId: 'task-1',
      browserId: 'browser-1',
      stage: 'end',
      toolName: 'browser_click',
      input: { selector: '#submit' },
      result: 'clicked',
      success: true,
      durationMs: 42,
    })

    snapshot = profileMonitorHub.getSnapshot()
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

    profileMonitorHub.finishTask('task-1')

    expect(profileMonitorHub.getSnapshot().data.tasks).toHaveLength(0)
    expect(profileMonitorHub.getProfileSnapshot().data.profiles).toMatchObject([
      { dirId: 'dir-1', status: 'idle' },
    ])
  })

  it('tracks manually opened profiles and removes only connections that disappear', () => {
    profileMonitorHub.syncConnections([
      {
        dirId: 'manual-1',
        endpoint: 'ws://localhost/devtools/browser/manual-1',
        browserType: 'chromium',
        connectedAt: 10,
        windowName: 'Manual profile',
      },
    ])

    expect(profileMonitorHub.getProfileSnapshot().data.profiles).toMatchObject([
      {
        dirId: 'manual-1',
        status: 'idle',
        endpoint: 'ws://localhost/devtools/browser/manual-1',
        windowName: 'Manual profile',
      },
    ])

    profileMonitorHub.syncConnections([])
    expect(profileMonitorHub.getProfileSnapshot().data.profiles).toEqual([])
  })

  it('removes a completed browser while retaining other active browsers', () => {
    profileMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Batch script',
      sourceType: 'script',
    })
    profileMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
      label: 'dir-1',
    })
    profileMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-2',
      dirId: 'dir-2',
      label: 'dir-2',
    })

    profileMonitorHub.finishBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
    })

    const snapshot = profileMonitorHub.getSnapshot()
    expect(snapshot.data.tasks).toHaveLength(1)
    expect(snapshot.data.tasks[0].browsers).toMatchObject([
      { id: 'browser-2', dirId: 'dir-2' },
    ])
  })

  it('hides a task after its last browser finishes and allows a later browser to reappear', () => {
    profileMonitorHub.startTask({
      taskId: 'task-1',
      title: 'Batch script',
      sourceType: 'script',
    })
    profileMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-1',
      dirId: 'dir-1',
      label: 'dir-1',
    })

    profileMonitorHub.applyEvent({
      type: 'browser_finished',
      data: { taskId: 'task-1', dirId: 'dir-1' },
    })
    expect(profileMonitorHub.getSnapshot().data.tasks).toHaveLength(0)

    profileMonitorHub.attachBrowser({
      taskId: 'task-1',
      browserId: 'browser-2',
      dirId: 'dir-2',
      label: 'dir-2',
    })
    expect(profileMonitorHub.getSnapshot().data.tasks[0].browsers).toMatchObject([
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
      profileMonitorHub.startTask({
        taskId: 'task-1',
        title: 'Check browser',
        sourceType: 'chat',
      })

      profileMonitorHub.attachBrowser({
        taskId: 'task-1',
        browserId: 'browser-1',
        dirId: 'dir-1',
        label: 'dir-1',
      })

      await vi.waitFor(() => {
        expect(profileMonitorHub.getSnapshot().data.tasks[0].browsers[0]).toMatchObject({
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
      profileMonitorHub.startTask({
        taskId: 'task-1',
        title: 'Check browser',
        sourceType: 'chat',
      })
      profileMonitorHub.attachBrowser({
        taskId: 'task-1',
        browserId: 'browser-1',
        dirId: 'dir-1',
        label: 'dir-1',
      })
      await settleAsyncWork()

      expect(listWindows).toHaveBeenCalledTimes(1)
      expect(profileMonitorHub.getSnapshot().data.tasks[0].browsers[0].windowName).toBeUndefined()

      vi.setSystemTime(new Date('2026-07-31T08:00:11.000Z'))
      profileMonitorHub.recordBrowserEvent({
        taskId: 'task-1',
        browserId: 'browser-1',
        dirId: 'dir-1',
        stage: 'end',
        toolName: 'roxy_script_run',
        success: true,
      })
      await settleAsyncWork()

      expect(listWindows).toHaveBeenCalledTimes(2)
      expect(profileMonitorHub.getSnapshot().data.tasks[0].browsers[0]).toMatchObject({
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

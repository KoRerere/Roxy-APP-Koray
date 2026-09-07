import assert from 'node:assert/strict'
import { beforeEach, describe, it, vi } from 'vitest'

const { userGetWindowInfoListList } = vi.hoisted(() => ({
  userGetWindowInfoListList: vi.fn(),
}))

vi.mock('/@/api', () => ({
  API: {
    window: {
      userGetWindowInfoListList,
    },
  },
}))

const {
  clearTaskReportWindowInfoCache,
  fetchTaskReportWindowInfo,
  formatTaskReportWindowNumber,
} = await import('./task-report-window-info')

describe('fetchTaskReportWindowInfo', () => {
  beforeEach(() => {
    clearTaskReportWindowInfoCache()
    userGetWindowInfoListList.mockReset()
  })

  it('queries all requested dirIds once and matches the response locally', async () => {
    userGetWindowInfoListList.mockResolvedValue({
      code: 0,
      data: {
        total: 3,
        rows: [
          {
            dirId: 'window-1',
            windowSortNum: 17,
            workspaceName: 'anbin',
            lastCountry: 'jp',
            country: 'US',
            platformUserName: 'seller@example.com',
          },
          {
            dirId: 'window-2',
            windowSortNum: 29,
            workspaceName: '036 team',
            country: 'sg',
          },
          { dirId: 'unrelated-window', windowSortNum: 90 },
        ],
      },
      msg: '',
    })

    const result = await fetchTaskReportWindowInfo(['window-2', 'window-1', 'window-2'])

    assert.equal(userGetWindowInfoListList.mock.calls.length, 1)
    assert.deepEqual(userGetWindowInfoListList.mock.calls[0]?.[0], {
      page_index: 1,
      page_size: 2,
      dirIds: 'window-2,window-1',
      isDelete: 0,
      orderName: 'createTime',
      orderType: 'desc',
    })
    const request = userGetWindowInfoListList.mock.calls[0]?.[0]
    assert.ok(request)
    assert.equal('dirId' in request, false)
    assert.equal(request.dirIds, 'window-2,window-1')
    assert.deepEqual([...result], [
      ['window-2', { windowSortNum: 29, workspaceName: '036 team', countryCode: 'SG' }],
      ['window-1', { windowSortNum: 17, workspaceName: 'anbin', countryCode: 'JP', platformUserName: 'seller@example.com' }],
    ])
  })

  it('formats the workspace prefix and window number', () => {
    assert.equal(formatTaskReportWindowNumber({ workspaceName: 'anbin', windowSortNum: 113 }), 'ANB-113')
    assert.equal(formatTaskReportWindowNumber({ workspaceName: '036 team', windowSortNum: 145 }), '036-145')
    assert.equal(formatTaskReportWindowNumber({ windowSortNum: 9 }), '9')
  })

  it('shares the full-list cache across report cards', async () => {
    userGetWindowInfoListList.mockResolvedValue({
      code: 0,
      data: {
        total: 2,
        rows: [
          { dirId: 'window-1', windowSortNum: 17 },
          { dirId: 'window-2', windowSortNum: 29 },
        ],
      },
      msg: '',
    })

    await fetchTaskReportWindowInfo(['window-1', 'window-2'])
    const result = await fetchTaskReportWindowInfo(['window-2'])

    assert.equal(userGetWindowInfoListList.mock.calls.length, 1)
    assert.deepEqual([...result], [['window-2', { windowSortNum: 29 }]])
  })

  it('splits more than 50 dirIds into bounded queries', async () => {
    const dirIds = Array.from({ length: 51 }, (_, index) => `window-${index + 1}`)
    userGetWindowInfoListList.mockImplementation(async request => ({
      code: 0,
      data: {
        total: request.page_size,
        rows: request.dirIds.split(',').map((dirId: string, index: number) => ({
          dirId,
          windowSortNum: index + 1,
        })),
      },
      msg: '',
    }))

    const result = await fetchTaskReportWindowInfo(dirIds)

    assert.equal(userGetWindowInfoListList.mock.calls.length, 2)
    assert.deepEqual(userGetWindowInfoListList.mock.calls.map(call => call[0].page_size), [50, 1])
    assert.equal(userGetWindowInfoListList.mock.calls[0]?.[0].dirIds, dirIds.slice(0, 50).join(','))
    assert.equal(userGetWindowInfoListList.mock.calls[1]?.[0].dirIds, dirIds[50])
    assert.equal(result.size, 51)
  })
})

import { setOperationLoading } from '/@/utils'
import { ProxyType } from '/@/enums'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { notifyProxyModuleSpeedTest, persistProfileRowAfterProxySpeedTest } from '/@/views/browser/list/profiles/hooks/useProfileProxy'

import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import { silentUpdateProxy } from '/@/views/browser/list/profiles/components/util'
import { API } from '/@/api'

type ProfileRow = UserGetWindowInfoListListData['data']['rows'][number]

/**
 * 窗口列表测速：并发检测、按行写窗口、按 moduleId 去重写代理模块（与 ProfileInfo 单行菜单共用 persist/notify）
 */
export function useProfileProxySpeedTest() {
  const { testProxy, batchTestShowToast, concurrentProxyTest } = useCheckProxy()
  const [_, onlyErrorToast] = useResponseToast()

  async function runProxySpeedTestForRows(targets: ProfileRow[], options?: Record<string, unknown>) {
    if (!targets.length)
      return
    if (!globalThis.isElectron) {
      return globalThis.electronAPI.send('proxy:detect', {} as any)
    }

    const { operationName, showConcurrentTaskTopBar, silent } = { operationName: 'checkProxy', showConcurrentTaskTopBar: false, silent: false, ...options }

    const tasks = targets.map((item) => {
      setOperationLoading(item, operationName, true)
      return async () => {
        try {
          Reflect.deleteProperty(item, '_checkRes')
          const checkRes = await testProxy(toRaw(item))
          silentUpdateProxy(item, checkRes)
          Reflect.set(item, '_checkRes', checkRes)
          return { item, checkRes }
        }
        finally {
          setOperationLoading(item, operationName, false)
        }
      }
    })

    await concurrentProxyTest({
      tasks,
      showConcurrentTaskTopBar,
      tasksCompleted: async (results: any[], cancelled: boolean) => {
        results.forEach((res, i) => {
          if (res === undefined)
            setOperationLoading(targets[i]!, operationName, false)
        })

        const validResults = results.filter(Boolean)

        if (!cancelled && !silent) {
          batchTestShowToast(validResults.map(p => p.checkRes))
        }

        const moduleDone = new Map<number, any>()
        for (const { item, checkRes } of validResults) {
          if (item.moduleId && item.buyProxyType === ProxyType.resource && !moduleDone.has(item.moduleId)) {
            moduleDone.set(item.moduleId, { id: item.moduleId, ...checkRes })
          }
        }

        if (silent) {
          API.window.userMdfWindowProxyCheckBatchCreate({ proxyList: Array.from(moduleDone.values()) })// 自动检测无日志
        }
        else {
          notifyProxyModuleSpeedTest(Array.from(moduleDone.values()))
        }

        await persistProfileRowAfterProxySpeedTest(results, { onlyErrorToast })
      },
    }).catch((err) => {
      onlyErrorToast(-1, err.message)
      targets.forEach((item) => {
        setOperationLoading(item, operationName, false)
      })
    })
  }

  return { runProxySpeedTestForRows }
}

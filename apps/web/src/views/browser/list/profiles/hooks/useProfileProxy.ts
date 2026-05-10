import { useConfirm } from 'primevue/useconfirm'
import { API } from '/@/api'
import { createDefaultObject, isEmptyValue } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ProfileModifyType, ProfileReqType, ProxyCheckStatus, ProxyType } from '/@/enums'
import type { CheckResult } from '/@/views/agent/hooks'

import { clearProxyKeys, silentUpdateProxy } from '../components/util'

interface ProfileLike {
  id?: number
  dirId?: string | number
  moduleId?: number
  openTime?: string | number | null
  [key: string]: any
}

/** 资源型代理模块测速结果同步（同一 moduleId 可绑定多窗口，批量测速时应对 moduleId 去重后只调一次） */
export function notifyProxyModuleSpeedTest(proxyList: any[]) {
  if (isEmptyValue(proxyList))
    return
  API.proxy.userMdfProxyModuleCreate({ proxyList, requestType: ProfileReqType.SpeedTest })
}

/** 仅写当前窗口行 + silentUpdate；代理模块请用 notifyProxyModuleSpeedTest（批量场景按 moduleId 去重） */
export async function persistProfileRowAfterProxySpeedTest(
  list: { item: ProfileLike, checkRes: CheckResult }[],
  options: { onlyErrorToast: (code: number, msg: string) => void },
): Promise<void> {
  const validList = list.filter(data => data.checkRes.checkStatus === ProxyCheckStatus.success)
  if (validList.length === 0)
    return

  const proxyList = validList.map(data => ({
    id: data.item.id!,
    dirId: data.item.dirId,
    ...data.checkRes,
  }))

  const { code, msg } = await API.window.userMdfWindowProxyCheckBatchCreate({ proxyList, requestType: ProfileReqType.SpeedTest } as any)
  options.onlyErrorToast(code, msg)
}

export function useProfileProxy() {
  const confirm = useConfirm()
  const [, onlyErrorToast] = useResponseToast()

  function buildProxyData(profile: ProfileLike) {
    return {
      id: profile.moduleId,
      ...Object.fromEntries(
        ['host', 'ipType', 'port', 'protocol', 'proxyCategory', 'proxyPassword', 'proxyUserName', 'refreshUrl', 'checkChannel']
          .map(key => [key, profile[key]]),
      ),
    }
  }

  function buildDeleteProxyParams(origin: ProfileLike) {
    const params: Record<string, any> = {
      moduleId: 0, // 为 0 表示解除关联
      proxyCategory: 'noproxy',
      proxyMethod: 'custom',
      buyProxyType: ProxyType.resource,
      checkStatus: ProxyCheckStatus.none,
      ...createDefaultObject(clearProxyKeys, ''),
    }

    if (!origin.openTime) {
      Reflect.set(params, 'lastIp', '')
    }
    else {
      Reflect.deleteProperty(params, 'lastIp')
    }

    return params
  }

  function confirmDeleteProxy(targets: ProfileLike | ProfileLike[]) {
    const datas = ([] as ProfileLike[]).concat(targets)
    const ids = datas.map(item => item.id!)
    const { promise, resolve, reject } = Promise.withResolvers<void>()

    confirm.require({
      header: $t('删除代理 IP'),
      message: $t('您确认要删除代理 IP 吗？'),
      rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
      acceptProps: { label: $t('确认'), severity: 'danger' },
      accept: async () => {
        const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ ids, type: ProfileModifyType.ProxyDelete, requestType: ProfileReqType.DeleteProxy })
        onlyErrorToast(code, msg)
        resolve()
        if (code !== 0)
          return

        datas.forEach((item) => {
          const params = buildDeleteProxyParams(item)
          silentUpdateProxy(item as any, params, ['isEncryptProxy', 'proxyEncryptInfo'])
        })
      },
      reject,
      onHide: reject,
    })

    return promise
  }

  return {
    buildProxyData,
    confirmDeleteProxy,
  }
}

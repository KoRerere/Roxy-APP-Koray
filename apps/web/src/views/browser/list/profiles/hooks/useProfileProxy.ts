import { useConfirm } from 'primevue/useconfirm'

import { API } from '/@/api'
import { createDefaultObject } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ProfileModifyType, ProxyCheckStatus, ProxyType } from '/@/enums'

import { clearProxyKeys, silentUpdateProxy } from '../components/util'

interface ProfileLike {
  id?: number
  dirId?: string | number
  moduleId?: number
  openTime?: string | number | null
  [key: string]: any
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
        const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ ids, type: ProfileModifyType.ProxyDelete })
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

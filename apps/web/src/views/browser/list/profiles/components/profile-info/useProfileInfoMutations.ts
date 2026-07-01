import { h, unref } from 'vue'
import type { MaybeRef } from 'vue'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyQuick from '/@/views/agent/quick.vue'
import { API } from '/@/api'
import { ProfileReqType, ProxyType } from '/@/enums'
import { isLikeFunction } from '/@/utils'
import { silentUpdateProxy } from '../util'

export function useProfileInfoMutations(options: {
  data: MaybeRef<Record<string, any>>
  workspaceName: MaybeRef<string | undefined>
  drawerInstance: ReturnType<typeof import('/@/hooks/useDrawer')['useDrawer']>
  emit: (event: 'refresh') => void
  onlyErrorToast: (code: number, msg: string) => void
}) {
  const { data, workspaceName, drawerInstance, emit, onlyErrorToast } = options

  async function updateProfile(params: any, opts?: Record<string, any>) {
    const { isRefresh, fallback, success } = { isRefresh: false, success: () => { }, fallback: () => { }, ...opts }
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
    onlyErrorToast(code, msg)
    if (code === 0) {
      isLikeFunction(success) && success()
      if (isRefresh) {
        emit('refresh')
      }
    }
    else {
      isLikeFunction(fallback) && fallback()
    }
  }

  function setChooseProxy(formData: any) {
    const { id: moduleId, proxyCategory, protocol, proxyType, isDirect, _checkRes, ...rest } = formData
    const row = unref(data)
    const { id, dirId } = row
    updateProfile({ id, dirId, moduleId, proxyMethod: 'choose', requestType: ProfileReqType.SelectProxy }, {
      success: () => {
        Reflect.deleteProperty(row, '_checkRes')
        if (_checkRes) {
          Reflect.set(row, '_checkRes', _checkRes)
        }
        silentUpdateProxy(row, {
          ...rest,
          moduleId,
          isDirect,
          protocol,
          proxyCategory: proxyCategory || protocol,
          proxyMethod: 'choose',
          buyProxyType: proxyType ?? ProxyType.resource,
        }, isDirect ? [] : ['isEncryptProxy', 'proxyEncryptInfo'])
      },
    })
  }

  async function createProxy(proxyData?: Record<string, any>) {
    const row = unref(data)
    const ws = unref(workspaceName)
    await drawerInstance.showDrawer({
      title: proxyData
        ? $t('为[{workspaceName}-{uid}]编辑代理 IP', { workspaceName: ws, uid: row.windowSortNum })
        : $t('为[{workspaceName}-{uid}]添加代理 IP', { workspaceName: ws, uid: row.windowSortNum }),
      dismissable: false,
      slots: {
        container: () => h(ProxyCreate, {
          data: proxyData,
          onConfirm: (formData: any) => {
            const { id, dirId } = row
            const params = { ...formData, id, dirId, moduleId: 0, proxyMethod: 'custom', requestType: proxyData ? ProfileReqType.EditProxy : ProfileReqType.AddProxy }
            updateProfile(params, {
              success: () => {
                Reflect.deleteProperty(row, '_checkRes')
                silentUpdateProxy(row, params, ['isEncryptProxy', 'proxyEncryptInfo'])
              },
            })
            drawerInstance.hideDrawer()
          },
        }),
      },
    })
  }

  async function openProxyDrawer(proxyData: Record<string, any>) {
    const row = unref(data)
    const ws = unref(workspaceName)
    await drawerInstance.showDrawer({
      title: $t('为[{workspaceName}-{uid}]选择代理 IP', { workspaceName: ws, uid: row.windowSortNum }),
      dismissable: false,
      slots: {
        container: () => h(ProxyQuick, {
          data: proxyData,
          onConfirm: (formData: any) => {
            setChooseProxy(formData)
            drawerInstance.hideDrawer()
          },
        }),
      },
    })
  }

  return {
    updateProfile,
    setChooseProxy,
    createProxy,
    openProxyDrawer,
  }
}

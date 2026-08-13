import { h, unref } from 'vue'
import type { MaybeRef } from 'vue'
import ProxyQuick from '/@/views/agent/quick.vue'
import { API } from '/@/api'
import { ProfileReqType, ProxyType } from '/@/enums'
import { isLikeFunction } from '/@/utils'
import { useProxyFormDrawer } from '/@/views/agent/hooks/useProxyFormDrawer'
import { silentUpdateProxy } from '../util'

export function useProfileInfoMutations(options: {
  data: MaybeRef<Record<string, any>>
  workspaceName: MaybeRef<string | undefined>
  drawerInstance: ReturnType<typeof import('/@/hooks/useDrawer')['useDrawer']>
  emit: (event: 'refresh') => void
  onlyErrorToast: (code: number, msg: string) => void
}) {
  const { data, workspaceName, drawerInstance, emit, onlyErrorToast } = options
  const { showProxyFormDrawer } = useProxyFormDrawer(drawerInstance)
  async function updateProfile(params: any, opts?: Record<string, any>) {
    const { isRefresh, fallback, success } = { isRefresh: false, success: () => { }, fallback: () => { }, ...opts }
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
    onlyErrorToast(code, msg)
    if (code === 0) {
      isLikeFunction(success) && success()
      if (isRefresh) {
        emit('refresh')
      }
      return true
    }

    isLikeFunction(fallback) && fallback()
    return false
  }

  function setChooseProxy(formData: any) {
    const { id: moduleId, proxyCategory, protocol, proxyType, isDirect, _checkRes, ...rest } = formData
    const row = unref(data)
    const { id, dirId } = row
    updateProfile({ id, dirId, moduleId, proxyMethod: 'choose', requestType: ProfileReqType.SelectProxy }, {
      success: () => {
        Reflect.deleteProperty(row, '_checkRes')
        if (_checkRes) {
          Reflect.set(row, '_checkRes', toRaw(_checkRes))
        }
        silentUpdateProxy(row, {
          ...rest,
          moduleId,
          isDirect,
          protocol,
          proxyCategory: proxyCategory || protocol,
          proxyMethod: 'choose',
          buyProxyType: proxyType ?? ProxyType.resource,
        })
      },
    })
  }

  /** 手动添加自定义代理并绑定到当前窗口 */
  function addCustomProxy(formData: Record<string, any>) {
    const row = unref(data)
    const { id, dirId } = row
    const params = { ...formData, id, dirId, moduleId: 0, proxyMethod: 'custom', requestType: ProfileReqType.AddProxy }
    updateProfile(params, {
      success: () => {
        Reflect.deleteProperty(row, '_checkRes')
        silentUpdateProxy(row, params)
      },
    })
  }

  /** 编辑已有代理（仍走单侧抽屉，不使用双开） */
  async function editProxy(proxyData: Record<string, any>) {
    const row = unref(data)
    const ws = unref(workspaceName)
    await showProxyFormDrawer({
      title: $t('为[{workspaceName}-{uid}]编辑代理 IP', { workspaceName: ws, uid: row.windowSortNum }),
      data: proxyData,
      mode: 'proxy',
      onConfirm: async (formData) => {
        const { id, dirId } = row
        const params = { ...formData, id, dirId, moduleId: 0, proxyMethod: 'custom', requestType: ProfileReqType.EditProxy }
        const ok = await updateProfile(params, {
          success: () => {
            Reflect.deleteProperty(row, '_checkRes')
            silentUpdateProxy(row, params)
          },
        })
        if (!ok)
          return false
      },
    })
  }

  async function openProxyDrawer(proxyData: Record<string, any>) {
    const row = unref(data)
    const ws = unref(workspaceName)
    await drawerInstance.showDrawer({
      title: $t('为[{workspaceName}-{uid}]选择代理 IP', { workspaceName: ws, uid: row.windowSortNum }),
      closeOnEscape: false,
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
    addCustomProxy,
    editProxy,
    openProxyDrawer,
  }
}

import { defineAsyncComponent, h, toRaw } from 'vue'
import type { ProxyBindGroup } from '/@/views/browser/list/profiles/components/batch-proxy-bind.vue'
import { API } from '/@/api'
import { useDrawer } from '/@/hooks/useDrawer'
import { usePermission } from '/@/hooks/usePermission'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { LIST_CACHE_NAMESPACE, useListCacheActions } from '/@/stores/listCache'
import { useWorkspaceStore } from '/@/stores/workspace'
import { emitter } from '/@/utils/eventBus'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { ProfileModifyType, ProfileReqType } from '/@/enums'

const ProfileSelect = defineAsyncComponent(() => import('/@/views/account/list/components/profile-select.vue'))
const BatchProxyBind = defineAsyncComponent(() => import('/@/views/browser/list/profiles/components/batch-proxy-bind.vue'))

/** 复用窗口列表的批量配置界面，先选择窗口，再逐个分配代理 IP。 */
export function useProxyPurchaseBinding() {
  const selectionDrawer = useDrawer()
  const bindingDrawer = useDrawer()
  const workspaceStore = useWorkspaceStore()
  const { check } = usePermission()
  const [showToast, onlyErrorToast] = useResponseToast()
  const { invalidateCache } = useListCacheActions()

  async function openProxyPurchaseBinding() {
    if (!check('Profiles_select_proxy')) {
      return
    }

    const profiles = await new Promise<Record<string, any>[]>((resolve) => {
      let selection: Record<string, any>[] = []
      selectionDrawer.showDrawer({
        title: $t('选择窗口'),
        onHide: () => resolve(selection),
        slots: {
          container: () => h(ProfileSelect, {
            cacheKey: 'proxy-purchase-profile-select',
            onConfirm: (rows: Record<string, any>[]) => {
              selection = rows
            },
            onClose: selectionDrawer.hideDrawer,
          }),
        },
      })
    })

    if (!profiles.length) {
      return
    }

    await new Promise<void>((resolve) => {
      bindingDrawer.showDrawer({
        title: $t('批量配置代理 IP'),
        pt: { root: { style: { width: 'min(1360px, calc(100vw - 24px))' } } },
        onHide: resolve,
        slots: {
          container: () => h(BatchProxyBind, {
            profiles,
            workspaceName: getWorkspaceNamePrefix(workspaceStore.currentWorkspace?.workspaceName),
            onConfirm: async (groups: ProxyBindGroup[]) => {
              for (const { proxy, profiles } of groups) {
                const { id, ...proxyData } = toRaw(proxy)
                const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
                  type: ProfileModifyType.ProxySelect,
                  requestType: ProfileReqType.SelectProxy,
                  ids: profiles.map(profile => profile.id),
                  paramList: { ...proxyData, moduleId: id, proxyMethod: 'choose' },
                } as any)
                onlyErrorToast(code, msg)
                if (code !== 0) {
                  return false
                }
                invalidateCache(LIST_CACHE_NAMESPACE.BROWSER_LIST)
                emitter.emit('refreshProfileList')
              }
              showToast(0, $t('保存成功'))
              bindingDrawer.hideDrawer()
              return true
            },
          }),
        },
      })
    })
  }

  return { openProxyPurchaseBinding }
}

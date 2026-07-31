import { h } from 'vue'
import DuplicateProxiesModal from '/@/views/agent/create/components/duplicate-proxies-modal.vue'
import { getColumns } from '/@/views/agent/create/components/columns'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import type { ProxyCreateLabels } from '/@/views/agent/create/proxy-create-mode'
import type { UserAddProxyModuleV2CreatePayload } from '@roxy/backend-api'

export interface SaveProxyModulesOptions {
  labels: ProxyCreateLabels
  /** 透传给创建接口的额外参数（如 workspaceType）；不传时由后端按当前上下文处理 */
  extraParams?: Omit<UserAddProxyModuleV2CreatePayload, 'proxyList'>
  /** 创建成功后的回调；未提供时走默认路由跳转 */
  onSuccess?: () => void | Promise<void>
}

export function useProxyModuleCreate() {
  const router = useRouter()
  const [_, onlyErrorToast] = useResponseToast()
  const [showModal] = useDialog()

  async function saveProxyModules(__proxies: any[], options: SaveProxyModulesOptions) {
    const { labels, extraParams } = options
    const proxies = __proxies.reverse()
    const { code, msg, data } = await API.proxy.userAddProxyModuleV2Create({
      ...extraParams,
      proxyList: proxies,
    })

    if (code === 0) {
      if (options.onSuccess) {
        await options.onSuccess()
      }
      else {
        const query = labels.successRouteName === 'agent-list' ? { name: 'list' } : undefined
        router.replace({ name: labels.successRouteName, query })
      }
      return
    }

    if (code === 101 && data) {
      const isAllExist = proxies.length === data?.length
      const okText = isAllExist ? $t('知道了') : $t('继续并保存')
      const columnKeys = ['protocol', 'host', 'port', 'proxyUserName', 'proxyPassword', 'refreshUrl', 'remark']
      const columns = getColumns(labels).filter(item => columnKeys.includes(item.key as string))
      const dataList = (isAllExist ? proxies : proxies.filter((_item: any, index: number) => data.some((d: any) => d.index === index))).reverse()

      showModal({
        showHeader: false,
        modal: true,
        blockScroll: true,
        slots: {
          container: ({ hideModal }) => h(DuplicateProxiesModal, {
            title: isAllExist ? labels.duplicateTitleAll : labels.duplicateTitlePartial,
            labels,
            columns,
            dataList,
            isAllExist,
            okText,
            onClose: hideModal,
            onCancel: hideModal,
            onConfirm: () => onConfirm(hideModal),
          }),
        },
      })

      async function onConfirm(hideModal: () => Promise<boolean>) {
        if (!isAllExist) {
          const noRepetitiveProxies = proxies.filter((_item: any, index: number) => !data?.some((d: any) => d.index === index)).reverse()
          await saveProxyModules(noRepetitiveProxies, options)
        }
        hideModal()
      }
      return
    }

    onlyErrorToast(code, msg)
  }

  return { saveProxyModules }
}

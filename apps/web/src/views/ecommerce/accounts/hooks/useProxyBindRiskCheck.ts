import { h } from 'vue'
import ProxyBindRiskModal from '/@/views/ecommerce/accounts/components/bind-risk-modal.vue'
import {
  buildBindRiskFormContextFromWindow,
  getWindowPlatformDisplayId,
  isPresentBusinessId,
  PROXY_BIND_RISK_NOT_REMIND_KEY,
  shouldCheckProxyBindRiskForDeviceChange,
} from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import type { BindRiskFormContext } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'

export type ProxyBindRiskCheckResult = 'continue' | 'cancel' | 'reselect'

export interface ProxyBindRiskCheckOptions {
  proxyId: string | number
  displayId?: string | number
  /** 账号窗口 ID（列表绑定场景传入，取账号 id） */
  windowId?: string | number
  formContext: BindRiskFormContext
  /** 设备完整信息，用于绑定前连通性检测；缺省时弹窗内按 proxyId 拉取 */
  deviceProxy?: Record<string, unknown>
}

/** 打开绑定风险弹窗并等待用户操作结果 */
export function useProxyBindRiskCheck() {
  const [showModal] = useDialog()

  function shouldSkipProxyBindRiskCheck() {
    return localStorage.getItem(PROXY_BIND_RISK_NOT_REMIND_KEY) === 'true'
  }

  function openBindRiskModal(
    options: ProxyBindRiskCheckOptions,
    resolve: (result: ProxyBindRiskCheckResult) => void,
  ) {
    showModal({
      showHeader: false,
      modal: true,
      blockScroll: true,
      slots: {
        container: ({ hideModal }) => h(ProxyBindRiskModal, {
          proxyId: String(options.proxyId),
          displayId: String(options.displayId ?? ''),
          windowId: options.windowId,
          formContext: options.formContext,
          deviceProxy: options.deviceProxy,
          onClose: () => {
            hideModal()
            resolve('cancel')
          },
          onReselect: () => {
            hideModal()
            resolve('reselect')
          },
          onContinue: () => {
            hideModal()
            resolve('continue')
          },
        }),
      },
    })
  }

  function checkProxyBindRisk(options: ProxyBindRiskCheckOptions): Promise<ProxyBindRiskCheckResult> {
    if (shouldSkipProxyBindRiskCheck())
      return Promise.resolve('continue')

    return new Promise(resolve => openBindRiskModal(options, resolve))
  }

  /**
   * 列表/表单更换设备前的风险确认，按 displayId 去重后依次弹窗
   */
  async function confirmProxyBindRiskForAccounts(
    accounts: Record<string, unknown>[],
    proxy: Record<string, unknown>,
  ): Promise<ProxyBindRiskCheckResult> {
    const newModuleId = proxy.id
    if (!isPresentBusinessId(newModuleId))
      return 'continue'

    const { data: platformOptions } = await API.platform.userGetPlatformUrlTreeList()
    const options = platformOptions ?? []
    const checksByDisplayId = new Map<string, { formContext: BindRiskFormContext, windowId?: string | number }>()

    for (const row of accounts) {
      if (!shouldCheckProxyBindRiskForDeviceChange(row, newModuleId, options))
        continue

      const displayId = getWindowPlatformDisplayId(row)
      if (!displayId || checksByDisplayId.has(displayId))
        continue

      const windowId = isPresentBusinessId(row.id) ? row.id : undefined
      checksByDisplayId.set(displayId, {
        formContext: buildBindRiskFormContextFromWindow(row, proxy),
        windowId,
      })
    }

    for (const [displayId, { formContext, windowId }] of checksByDisplayId) {
      const result = await checkProxyBindRisk({
        proxyId: newModuleId,
        displayId,
        windowId,
        formContext,
        deviceProxy: proxy,
      })
      if (result !== 'continue')
        return result
    }

    return 'continue'
  }

  return {
    checkProxyBindRisk,
    confirmProxyBindRiskForAccounts,
    shouldSkipProxyBindRiskCheck,
  }
}

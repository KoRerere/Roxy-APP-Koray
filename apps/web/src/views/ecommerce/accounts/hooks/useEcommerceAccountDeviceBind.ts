import { h } from 'vue'
import { API } from '/@/api'
import { ProfileModifyType, ProfileReqType, ProxyType } from '/@/enums'
import { useDrawer } from '/@/hooks/useDrawer'
import { usePermission } from '/@/hooks/usePermission'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { silentUpdateProxy } from '/@/views/browser/list/profiles/components/util'
import { useProfileProxy } from '/@/views/browser/list/profiles/hooks/useProfileProxy'
import DeviceSelectList from '/@/views/ecommerce/devices/device-select-list.vue'
import { isEcommerceBoundDeviceOpenable } from '/@/views/ecommerce/devices/device-operation'
import { useProxyBindRiskCheck } from './useProxyBindRiskCheck'

const DEFAULT_PROXY_METHOD = 'choose'

/** 账号行最小字段，供设备绑定读写 */
export interface EcommerceAccountDeviceBindRow {
  id?: number
  moduleId?: number | string
  proxyCategory?: string
  proxyExpireStatus?: number
  orderStatus?: number
  openLimitStatus?: boolean
  [key: string]: unknown
}

interface DeviceBindPayload {
  apiParamList: Record<string, unknown>
  silentParams: Record<string, unknown>
  openLimitMeta: Parameters<typeof isEcommerceBoundDeviceOpenable>[0]
}

/** 电商账号是否已绑定设备（与列表操作、测速筛选口径一致） */
export function hasBoundEcommerceDevice(row: Pick<EcommerceAccountDeviceBindRow, 'proxyCategory' | 'moduleId'>) {
  return row.proxyCategory !== 'noproxy' && Number(row.moduleId) > 0
}

/** 解析设备选择结果，供 API 提交与本地行同步共用 */
function resolveDeviceBindPayload(
  proxy: Record<string, unknown>,
  proxyMethod = DEFAULT_PROXY_METHOD,
): DeviceBindPayload {
  const { id, ...formData } = proxy
  const {
    protocol,
    proxyCategory,
    proxyType,
    isDirect,
    proxyExpireStatus,
    orderStatus,
    ...rest
  } = formData as Record<string, unknown>

  const resolvedProxyCategory = (proxyCategory || protocol) as string
  const resolvedProxyType = (proxyType ?? proxy.proxyType ?? ProxyType.resource) as ProxyType

  return {
    apiParamList: {
      moduleId: id ?? 0,
      proxyMethod,
      ...formData,
    },
    silentParams: {
      ...rest,
      moduleId: id ?? 0,
      isDirect,
      proxyMethod,
      protocol,
      proxyCategory: resolvedProxyCategory,
      buyProxyType: resolvedProxyType,
    },
    openLimitMeta: {
      moduleId: id as string | number,
      proxyCategory: resolvedProxyCategory,
      proxyExpireStatus: (proxyExpireStatus ?? proxy.proxyExpireStatus) as number | undefined,
      orderStatus: (orderStatus ?? proxy.orderStatus) as number | undefined,
      proxyType: resolvedProxyType,
    },
  }
}

/** 绑定成功后同步账号列表行（含 openLimitStatus） */
export function applyAccountDeviceBindToRow(
  account: EcommerceAccountDeviceBindRow,
  proxy: Record<string, unknown>,
  proxyMethod = DEFAULT_PROXY_METHOD,
) {
  const payload = resolveDeviceBindPayload(proxy, proxyMethod)
  silentUpdateProxy(account, payload.silentParams)
  account.proxyExpireStatus = payload.openLimitMeta.proxyExpireStatus
  account.orderStatus = payload.openLimitMeta.orderStatus
  account.openLimitStatus = isEcommerceBoundDeviceOpenable(payload.openLimitMeta)
}

/** 提交账号设备绑定 API 并同步本地行 */
export async function submitAccountDeviceBind(
  account: EcommerceAccountDeviceBindRow,
  proxy: Record<string, unknown>,
  options: {
    onlyErrorToast: (code: number, msg: string) => void
    proxyMethod?: string
  },
): Promise<boolean> {
  const payload = resolveDeviceBindPayload(proxy, options.proxyMethod)
  const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
    type: ProfileModifyType.ProxySelect,
    requestType: ProfileReqType.SelectProxy,
    ids: [account.id!],
    paramList: payload.apiParamList,
  })
  options.onlyErrorToast(code, msg)
  if (code !== 0)
    return false

  applyAccountDeviceBindToRow(account, proxy, options.proxyMethod)
  return true
}

/** 电商账号设备绑定：抽屉选择、风险检测、提交与行数据同步 */
export function useEcommerceAccountDeviceBind() {
  const drawerInstance = useDrawer()
  const { buildProxyData } = useProfileProxy()
  const { confirmProxyBindRiskForAccounts } = useProxyBindRiskCheck()
  const [, onlyErrorToast] = useResponseToast()
  const { check } = usePermission()

  /** 打开设备选择抽屉并完成绑定 */
  function openAccountDeviceSelectDrawer(
    account: EcommerceAccountDeviceBindRow,
    options: { proxyMethod?: string, onHide?: () => void, onSuccess?: () => void } = {},
  ) {
    const proxyData = buildProxyData(account)
    const moduleId = Number(proxyData.id)
    // 统一数字 id，供 DeviceSelectList 按 dataKey 回显当前绑定设备
    const selectedDevice = moduleId > 0 ? { ...proxyData, id: moduleId } : undefined

    drawerInstance.showDrawer({
      title: $t('选择设备'),
      dismissable: true,
      closeOnEscape: false,
      onHide: options.onHide,
      slots: {
        container: () => h(DeviceSelectList, {
          data: selectedDevice,
          onConfirm: async (proxy: Record<string, unknown>) => {
            const riskResult = await confirmProxyBindRiskForAccounts([account], proxy)
            if (riskResult !== 'continue')
              return

            const ok = await submitAccountDeviceBind(account, proxy, {
              onlyErrorToast,
              proxyMethod: options.proxyMethod,
            })
            if (ok) {
              drawerInstance.hideDrawer()
              options.onSuccess?.()
            }
          },
        }),
      },
    })
  }

  /** 带权限校验的绑定入口（如启动按钮 tooltip） */
  function promptAccountDeviceBind(account: EcommerceAccountDeviceBindRow, hide?: () => void) {
    hide?.()
    if (!check('Profiles_select_proxy')) {
      onlyErrorToast(-1, $t('暂无权限'))
      return
    }
    openAccountDeviceSelectDrawer(account)
  }

  return {
    openAccountDeviceSelectDrawer,
    promptAccountDeviceBind,
  }
}

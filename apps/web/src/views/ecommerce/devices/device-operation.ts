import { getProxyFilterGroups } from '/@/views/agent/shop/components/proxy-filter/useProxyFilter'
import { isProxySpeedTestable } from '/@/views/agent/shop/utils/proxy-speed-testable'
import { canUseLongRenewFirst, formatDiscountOff, getLongRenewDealLabel } from '/@/views/agent/shop/utils/long-renew-first'
import { API } from '/@/api'
import { getDictMap, transformSortOrder } from '/@/utils'
import { ProxyBindStatus, ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums/proxy'
import { usePermission } from '/@/hooks/usePermission'
import { useUserStore } from '/@/stores/user'
import { useDeviceColumns } from './device-columns'
import type { SortOrderNumber } from '/@/utils'
import type { LocationQuery } from 'vue-router'
import type { ProxyFilterGroup, ProxyFilterValues } from '/@/views/agent/shop/components/proxy-filter/useProxyFilter'
import type { UnwrapRowType, UserGetProxyListMergedListData } from '@roxy/backend-api'

/** 设备列表行数据（与代理列表结构一致，便于后续独立演进） */
export interface DeviceItem extends UnwrapRowType<UserGetProxyListMergedListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
  /** 动态 IP 刷新 URL（与 list 对齐，后台列表补充） */
  refreshUrl?: string
  /** 后台将补充，与 ProxyType 对齐，用于测速分支 */
  proxyType?: ProxyType
}

const { check } = usePermission()

/** 设备页隐藏的操作项（后续在此配置需排除的操作） */
export const DEVICE_HIDDEN_OPERATION_NAMES: readonly string[] = []

/** 设备页独有操作项（后续在此扩展） */
export function getDeviceExtraOperations(_data: DeviceItem | DeviceItem[]) {
  return [
    {
      name: 'detail',
      label: $t('详情'),
      icon: 'base/rx_ic_eye',
      tooltip: $t('详情'),
      visible: false,
      quick: true,
    },
  ]
}

/** 从多选中汇总行状态，用于批量操作的 disabled / tooltip 判断 */
function getDeviceRowState(datas: DeviceItem[]) {
  let hasExpired = false
  let isDone = true
  let isResource = true
  let canTest = true
  let canRenew = true
  let canRefresh = true
  let isDirect = false
  let canUpgrade = false

  for (const item of datas) {
    if (item.proxyExpireStatus === ProxyExpireStatus.expired)
      hasExpired = true

    if (item.orderStatus !== ProxyOrderStatus.done)
      isDone = false

    if (item.proxyType !== ProxyType.resource)
      isResource = false

    if (!isProxySpeedTestable(item))
      canTest = false
    if (!item.canRenew)
      canRenew = false
    if (!item.refreshUrl)
      canRefresh = false

    if (item.isDirect)
      isDirect = true

    if (item.canBandwidthUpgrade)
      canUpgrade = true
  }

  return {
    hasExpired,
    isDone,
    isResource,
    canTest,
    canRenew,
    canRefresh,
    isDirect,
    canUpgrade,
  }
}

/** 设备是否可测速（与代理 IP 列表共用口径） */
export function isDeviceTestable(item: DeviceItem): boolean {
  return isProxySpeedTestable(item)
}

/** 从列表中筛出可参与「测试全部」的设备 */
export function filterTestableDevices(datas: DeviceItem[]): DeviceItem[] {
  return datas.filter(isDeviceTestable)
}

/** 绑定设备是否允许打开电商账号（与启动按钮锁定 tooltip 口径一致） */
export function isEcommerceBoundDeviceOpenable(device: {
  moduleId?: string | number
  proxyCategory?: string
  proxyExpireStatus?: ProxyExpireStatus | number
  orderStatus?: ProxyOrderStatus | number
  proxyType?: ProxyType | number
}): boolean {
  const moduleId = Number(device.moduleId)
  if (!moduleId || device.proxyCategory === 'noproxy')
    return false

  if (device.proxyExpireStatus === ProxyExpireStatus.expired)
    return false

  const proxyType = device.proxyType ?? ProxyType.resource
  if (proxyType === ProxyType.buy)
    return device.orderStatus === ProxyOrderStatus.done

  return true
}

/** 设备是否已关联电商账号 */
export function hasDeviceBoundAccounts(device: Pick<DeviceItem, 'bindList'>): boolean {
  return (device.bindList?.length ?? 0) > 0
}

/** 批量设备中是否存在已关联账号的设备 */
export function hasAnyDeviceBoundAccounts(devices: Pick<DeviceItem, 'bindList'> | Pick<DeviceItem, 'bindList'>[]): boolean {
  return ([] as Pick<DeviceItem, 'bindList'>[]).concat(devices).some(hasDeviceBoundAccounts)
}

/** 设备列表行操作（独立副本，便于电商场景定制） */
export function getDeviceOperation(data: DeviceItem | DeviceItem[]) {
  const rows = ([] as DeviceItem[]).concat(data)
  const {
    hasExpired,
    // isDone,
    isResource,
    canTest,
    canRenew,
    // canRefresh,
    // isDirect,
    // canUpgrade,
  } = getDeviceRowState(rows)

  const hidden = new Set(DEVICE_HIDDEN_OPERATION_NAMES)
  // 勾选任意一条可享即可出标，不要求整批都能续费；折扣跟账户最低长续档走，避免写死 7 折
  const longRenewOff = rows.some(canUseLongRenewFirst)
    ? Number(useUserStore().userPayInfo.proxyRenewMinDiscount ?? 0) || 0
    : 0
  const longRenewDealLabel = getLongRenewDealLabel(longRenewOff)
  const longRenewDiscountBadge = longRenewOff > 0
    ? formatDiscountOff(longRenewOff)
    : ''

  const operations = [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: check('Proxy_List_edit'),
      tooltip: $t('编辑'),
      disabled: !isResource,
    },
    {
      name: 'test',
      label: $t('测试设备'),
      icon: 'base/rx_ic_speed_test',
      tooltip: $t('测试设备'),
      disabled: !canTest,
      power: check('Proxy_List_speed_test'),
      multiple: true,
      multipleProps: {
        name: 'G1',
        showLabel: true,
      },
    },
    // {
    //   name: 'refresh',
    //   label: $t('刷新设备'),
    //   icon: 'base/rx_ic_refresh',
    //   power: check('Proxy_List_refresh_proxy'),
    //   tooltip: $t('刷新设备'),
    //   disabled: isDirect || !canRefresh,
    //   disabledTooltip: !canRefresh ? $t('未配置刷新URL') : undefined,
    // },
    {
      name: 'renew',
      label: $t('续费'),
      icon: 'base/rx_ic_renew2',
      tooltip: $t('续费'),
      power: check('Cost_Center_all'),
      disabled: !canRenew,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G3',
        showLabel: true,
      },
      ...(longRenewDealLabel
        ? {
            suffixIcon: 'base/fire',
            suffixIconSize: 14,
            suffixLabel: longRenewDealLabel,
            suffixLabelClass: 'text-3 font-[DingTalk_JinBuTi] text-[#f53838] whitespace-nowrap',
            discountBadge: longRenewDiscountBadge,
          }
        : {}),
    },
    // {
    //   name: 'upgrade',
    //   label: $t('升级'),
    //   icon: 'base/rx_ic_double_up',
    //   power: check('Cost_Center_all'),
    //   disabled: hasExpired || !isDone || !canUpgrade,
    // },
    {
      name: 'remark',
      label: $t('添加备注'),
      icon: 'base/rx_ic_doc_add',
      power: check('Proxy_List_notes'),
    },
    {
      separator: true,
      power: check('Proxy_List_delete'),
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      power: check('Proxy_List_delete'),
      tooltip: $t('删除'),
      disabled: !hasExpired,
      multiple: true,
      multipleProps: {
        disabledTooltip: $t('已购设备无法进行此操作'),
        name: 'G4',
        showLabel: true,
      },
    },
  ].filter(item => !item.name || !hidden.has(item.name))

  return [
    ...operations,
    ...getDeviceExtraOperations(data),
  ]
}

/** 选择器场景仅保留测速操作，并作为快捷按钮展示 */
export function getDeviceSelectOperation(data: DeviceItem | DeviceItem[]) {
  return getDeviceOperation(data)
    .filter(item => item.name === 'test')
    .map(item => ({ ...item, quick: true }))
}

export async function deviceTableRequest(params: any) {
  return API.proxy.userGetProxyListMergedList(params)
}

export async function getDeviceCustomFilters() {
  const [$dict_map, { data: country }] = await Promise.all([
    getDictMap(),
    API.proxy.userGetProxyAllCountriesList({}),
  ])

  return [
    {
      type: 'Checkbox',
      label: $t('国家/地区'),
      name: 'proxyLastCountry',
      search: true,
      searchPlaceholder: $t('搜索国家/地区'),
      searchKeys: ['alias'],
      getOptions: () => {
        return (country || []).map((item: any) => ({
          parentName: 'proxyLastCountry',
          value: item.value,
          label: item.label,
          alias: `${item.label}/${item.value}`,
        }))
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      type: 'Checkbox',
      label: $t('设备类型'),
      name: 'proxyProtocol',
      getOptions: () => {
        return ($dict_map.protocol || []).map((item: any) => ({
          parentName: 'proxyProtocol',
          value: item.value,
          label: item.label,
        }))
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      type: 'text',
      label: $t('设备'),
      name: 'proxyHost',
    },
    {
      type: 'text',
      label: $t('备注'),
      name: 'proxyRemark',
    },
  ]
}

export async function getDeviceSorts() {
  const columns = toRaw(useDeviceColumns().columns.value)
  const { data } = await API.proxy.userGetProxyTableSortOrderList()

  const onChange = (data: any) => {
    const params: Record<string, any> = {}
    if (data.sortField && columns.some(item => item.key === data.sortField && item.sortable)) {
      params.orderName = data.sortField
      params.orderType = transformSortOrder(data.sortOrder as SortOrderNumber)
    }
    API.proxy.userSaveProxyTableSortOrderCreate(params as any)
  }

  const isSorField = columns.find(item => item.key === data?.orderName && item.sortable)

  return {
    data: {
      sortField: isSorField ? data?.orderName : undefined,
      sortOrder: transformSortOrder(data?.orderType ?? 'desc'),
    },
    onChange,
  }
}

export function getDeviceAdvancedSearch() {
  return [
    {
      key: 'proxyHost',
      label: $t('设备'),
      icon: 'base/rx_ic_internet',
      syntax: 'host::',
    },
    {
      key: 'proxyLastCountry',
      label: $t('国家/地区'),
      icon: 'base/rx_ic_earth',
      syntax: 'region::',
    },
    {
      key: 'username',
      label: $t('用户名'),
      icon: 'base/rx_ic_user_sm',
      syntax: 'name::',
    },
    {
      key: 'proxyRemark',
      label: $t('备注'),
      icon: 'base/rx_ic_doc_article',
      syntax: 'note::',
    },
    {
      key: 'proxyProvider',
      label: $t('服务商'),
      icon: 'base/rx_ic_browser_proxy',
      syntax: 'provider::',
    },
  ]
}

/** 设备页筛选分组：将「已关联窗口」替换为电商语境下的「已关联账号」 */
export function getDeviceFilterGroups(): ProxyFilterGroup[] {
  return getProxyFilterGroups().map(group =>
    group.key === 'proxyBindStatus'
      ? { ...group, label: $t('已关联账号') }
      : group,
  )
}

/** 从路由 query 解析设备列表 ProxyFilter 初始值 */
export function getDeviceListFilterFromRoute(query: LocationQuery): Partial<ProxyFilterValues> {
  const values: Partial<ProxyFilterValues> = {}
  if (query.expireStatus != null && query.expireStatus !== '')
    values.proxyExpireStatus = Number(query.expireStatus)
  if (query.bindStatus != null && query.bindStatus !== '')
    values.proxyBindStatus = Number(query.bindStatus) as ProxyBindStatus
  return values
}

/**
 * 跳转设备列表并筛选「已过期 + 已关联」
 * 传入 deviceId 时附带 action=renew，供设备页自动打开续费弹窗
 */
export function buildExpiredBoundDeviceListRoute(deviceId?: string | number) {
  const hasDeviceId = deviceId != null && Number(deviceId) > 0
  return {
    name: 'ecommerce-device-list' as const,
    query: {
      expireStatus: ProxyExpireStatus.expired,
      bindStatus: ProxyBindStatus.Bound,
      ...(hasDeviceId
        ? { action: 'renew', deviceId: String(deviceId) }
        : {}),
      _t: Date.now(),
    },
  }
}

import Qrcode from '/@/views/agent/shop/components/proxy-qrcode.vue'
import { isProxySpeedTestable } from '/@/views/agent/shop/utils/proxy-speed-testable'
import { canShowProxyQrcode, isDirectExportBlocked } from '/@/views/agent/shop/utils/proxy-download-kyc-gate'
import { canUseLongRenewFirst, formatDiscountOff, getLongRenewDealLabel } from '/@/views/agent/shop/utils/long-renew-first'
import { API } from '/@/api'
import { getDictMap, transformSortOrder } from '/@/utils'
import { ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums/proxy'
import { usePermission } from '/@/hooks/usePermission'
import { useUserStore } from '/@/stores/user'
import { useColumns } from './columns'
import type { SortOrderNumber } from '/@/utils'
import type { UnwrapRowType, UserGetProxyListMergedListData } from '@roxy/backend-api'

export interface ProxyItem extends UnwrapRowType<UserGetProxyListMergedListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
  /** 动态 IP 刷新 URL（与 list 对齐，后台列表补充） */
  refreshUrl?: string
  /** 后台将补充，与 ProxyType 对齐，用于测速分支 */
  proxyType?: ProxyType
}

const { check } = usePermission()

function getRowState(datas: ProxyItem[]) {
  let hasExpired = false
  let hasPending = false
  let hasRefunded = false
  let isDone = true
  let isResource = true
  let isGift = false
  let canTest = true
  let canRenew = true
  let canRefresh = true
  let isDirect = false
  let blockDirectExport = false
  let canUpgrade = false

  for (const item of datas) {
    if (item.proxyExpireStatus === ProxyExpireStatus.expired) {
      hasExpired = true
    }

    if (item.orderStatus === ProxyOrderStatus.pending) {
      hasPending = true
    }
    if (item.orderStatus === ProxyOrderStatus.refunded) {
      hasRefunded = true
    }
    if (item.orderStatus !== ProxyOrderStatus.done) {
      isDone = false
    }

    if (item.proxyType !== ProxyType.resource) {
      isResource = false
    }

    if (!item.proxyProviderId && !item.renewalTime && item.proxyType === ProxyType.buy) {
      isGift = true
    }

    if (!isProxySpeedTestable(item)) {
      canTest = false
    }
    if (!item.canRenew) {
      canRenew = false
    }
    if (!item.refreshUrl) {
      canRefresh = false
    }

    if (item.isDirect) {
      isDirect = true
    }
    if (isDirectExportBlocked(item)) {
      blockDirectExport = true
    }

    if (item.canBandwidthUpgrade) {
      canUpgrade = true
    }
  }

  return {
    hasExpired,
    hasPending,
    hasRefunded,
    isDone,
    isResource,
    isGift,
    canTest,
    canRenew,
    canRefresh,
    isDirect,
    blockDirectExport,
    canUpgrade,
  }
}

export function tableOperation(data: ProxyItem | ProxyItem[]) {
  const rows = ([] as ProxyItem[]).concat(data)
  const rowData = rows[0]!
  const {
    hasExpired,
    hasPending,
    hasRefunded,
    isDone,
    isResource,
    isGift,
    canTest,
    canRenew,
    canRefresh,
    isDirect,
    blockDirectExport,
    canUpgrade,
  } = getRowState(rows)

  const canShowQrcode = canShowProxyQrcode(rowData)
  // 与「测试全部」筛选口径一致：导入过期仍可测，不能仅凭 hasExpired 禁用
  // 勾选任意一条可享即可出标，不要求整批都能续费
  const longRenewOff = rows.some(canUseLongRenewFirst)
    ? Number(useUserStore().userPayInfo.proxyRenewMinDiscount ?? 0) || 0
    : 0
  const longRenewDealLabel = getLongRenewDealLabel(longRenewOff)
  const longRenewDiscountBadge = longRenewOff > 0
    ? formatDiscountOff(longRenewOff)
    : ''

  return [
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
      label: $t('测试代理 IP'),
      icon: 'base/rx_ic_speed_test',
      tooltip: $t('测试代理 IP'),
      disabled: !canTest,
      power: check('Proxy_List_speed_test'),
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G1',
        showLabel: true,
      },
    },
    {
      name: 'refresh',
      label: $t('刷新代理 IP'),
      icon: 'base/rx_ic_refresh',
      power: check('Proxy_List_refresh_proxy'),
      tooltip: $t('刷新代理 IP'),
      disabled: hasExpired || hasPending || hasRefunded || isGift || isDirect || !canRefresh,
      disabledTooltip: !canRefresh ? $t('未配置刷新URL') : undefined,
    },
    {
      name: 'download',
      label: $t('下载'),
      icon: 'base/rx_ic_download',
      tooltip: $t('下载'),
      power: check('Proxy_Store_download_proxy_info'),
      disabled: hasExpired || hasPending || hasRefunded || isGift || blockDirectExport,
      multiple: true,
      multipleProps: {
        disabledTooltip: isGift ? $t('官方赠送的代理 IP 无法下载') : undefined,
        name: 'G2',
        showLabel: true,
      },
    },
    {
      name: 'qrcode',
      label: $t('扫码导出'),
      icon: 'base/rx_ic_qrcode',
      power: check('Proxy_Store_download_proxy_info'),
      disabled: hasExpired || hasPending || hasRefunded || isGift || blockDirectExport,
      hideSubmenuIcon: !canShowQrcode,
      ...(canShowQrcode
        ? {
            items: [
              {
                name: 'qrcodePanel',
                render: () => h(Qrcode, { data: rowData, mode: 'panel' }),
              },
            ],
          }
        : {}),
    },
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
    {
      name: 'upgrade',
      label: $t('升级'),
      icon: 'base/rx_ic_double_up',
      power: check('Cost_Center_all'),
      disabled: hasExpired || !isDone || !canUpgrade,
    },
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
      disabled: !isResource && !hasExpired,
      multiple: true,
      multipleProps: {
        disabledTooltip: $t('已购代理 IP 无法进行此操作'),
        name: 'G4',
        showLabel: true,
      },
    },
  ]
}

export async function tableRequest(params: any) {
  return API.proxy.userGetProxyListMergedList(params)
}

export async function getCustomFilters() {
  const [$dict_map, { data: country }, { data: provider }] = await Promise.all([
    getDictMap(),
    API.proxy.userGetProxyAllCountriesList({}),
    API.proxy.userGetProxyProvidersTypeList(),
  ])

  const inputs = [
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
      label: $t('代理 IP 类型'),
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
      label: $t('代理 IP 主机'),
      name: 'proxyHost',
    },
    {
      type: 'text',
      label: $t('备注'),
      name: 'proxyRemark',
    },
    {
      type: 'Checkbox',
      label: $t('服务商'),
      name: 'proxyProvider',
      getOptions: () => {
        return ['PrivateProxy', 'RoxyBrowser'].map(label => ({
          parentName: 'proxyProvider',
          label,
          value: label,
        }))
      },
      formatValue: (input: any) => {
        return input.value?.map((item: any) => item.value)
      },
    },
    {
      type: 'switchGroup',
      name: 'providerType',
      label: $t('供应商类型'),
      options: provider.map(label => ({ label, value: label, text: label })),
    },
    {
      type: 'switchGroup',
      name: 'proxyAutoRenew',
      label: $t('自动续费'),
      options: [
        {
          label: $t('自动续费-开启'),
          value: '1',
          text: $t('开启'),
        },
        {
          label: $t('自动续费-关闭'),
          value: '0',
          text: $t('关闭'),
        },
      ],
    },
  ]

  return inputs
}

export async function getSorts(options?: { getColumnState?: typeof useColumns }) {
  const resolveColumns = options?.getColumnState ?? useColumns
  const columns = toRaw(resolveColumns().columns.value)
  const { data } = await API.proxy.userGetProxyTableSortOrderList()

  const onChange = (data: any) => {
    const params: Record<string, any> = {}
    if (data.sortField && columns.some(item => item.key === data.sortField && item.sortable)) {
      params.orderName = data.sortField
      params.orderType = transformSortOrder(data.sortOrder as SortOrderNumber)
    }
    API.proxy.userSaveProxyTableSortOrderCreate(params as any)
  }

  // 需要处理旧字段，如果字段已经不在我们新版的设计中，那么这个字段就不能传到接口中去
  const isSorField = columns.find(item => item.key === data?.orderName && item.sortable)

  return {
    data: {
      sortField: isSorField ? data?.orderName : undefined,
      sortOrder: transformSortOrder(data?.orderType ?? 'desc'),
    },
    onChange,
  }
}

export function getAdvancedSearch() {
  return [
    {
      key: 'proxyHost',
      label: $t('代理 IP'),
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

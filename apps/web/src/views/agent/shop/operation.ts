import type { UnwrapRowType, UserGetUserBuyProxyListListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { getDictMap, transformSortOrder, type SortOrderNumber } from '/@/utils'
import { ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums/proxy'
import { useRoleStore } from '/@/stores/role'
import { useColumns } from './columns'

const { isEditor, isOwner } = storeToRefs(useRoleStore())
export interface ProxyItem extends UnwrapRowType<UserGetUserBuyProxyListListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
}

export function tableOperation(data?: ProxyItem | ProxyItem[]) {
  const datas = ([] as ProxyItem[]).concat(data ?? [])
  const hasExpired = datas.some(item => item?.proxyExpireStatus === ProxyExpireStatus.expired)
  const hasPending = datas.some(item => item.orderStatus === ProxyOrderStatus.pending)
  const hasRefunded = datas.some(item => item.orderStatus === ProxyOrderStatus.refunded)

  const isDone = datas.every(item => item.orderStatus === ProxyOrderStatus.done)
  const isGift = datas.some(item => !item.proxyProviderId && !item.renewalTime)

  return [
    {
      name: 'test',
      label: $t('测试'),
      icon: 'base/rx_ic_speed_test',
      tooltip: $t('测试'),
      disabled: hasExpired || hasPending || hasRefunded,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G1',
        showLabel: true,
      },
    },
    {
      name: 'download',
      label: $t('下载'),
      icon: 'base/rx_ic_download',
      tooltip: $t('下载'),
      disabled: hasExpired || hasPending || hasRefunded || isEditor.value || isGift,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G2',
        showLabel: true,
      },
    },
    {
      name: 'renew',
      label: $t('续费'),
      icon: 'base/rx_ic_renew2',
      tooltip: $t('续费'),
      disabled: hasExpired || !isDone || !isOwner.value,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'G3',
        showLabel: true,
      },
    },
    {
      name: 'remark',
      label: $t('添加备注'),
      icon: 'base/rx_ic_doc_add',
    }
  ]
}

export async function tableRequest(params: any) {
  return API.proxy.userGetUserBuyProxyListList(params)
}

export async function getCustomFilters() {
  const $dict_map = await getDictMap()
  const { data: country } = await API.proxy.userGetProxyAllCountriesList({ queryType: ProxyType.buy.toString() })

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
      label: $t('代理类型'),
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
      label: $t('代理主机'),
      name: 'proxyHost',
    },
    {
      type: 'text',
      label: $t('备注'),
      name: 'proxyRemark',
    },
  ]

  return inputs
}

export async function getSorts() {
  const columns = toRaw(useColumns().columns.value)
  const { data } = await API.proxy.userGetProxyTableSortOrderList()

  const onChange = (data: any) => {
    const params: Record<string, any> = {};
    if (data.sortField && columns.find(item => item.key === data.sortField && item.sortable)) {
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

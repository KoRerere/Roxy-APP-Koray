import type { UnwrapRowType, UserGetProxyModuleListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { getDictMap } from '/@/utils'

export interface ProxyItem extends UnwrapRowType<UserGetProxyModuleListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
}

export function tableOperation(data?: ProxyItem) {
  const role = useRoleStore()

  return [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: !role.isViewer,
      quick: true,
    },
    {
      name: 'test',
      label: $t('测试'),
      icon: 'base/rx_ic_speed_test',
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'one',
      },
    },
    {
      name: 'refresh',
      label: $t('刷新代理'),
      icon: 'base/rx_ic_refresh',
      quick: true,
      disabled: !data?.refreshUrl,
      disabledTooltip: $t('未配置刷新URL'),
    },
    {
      name: 'remark',
      label: $t('添加备注'),
      icon: 'base/rx_ic_doc_add',
      power: !role.isViewer,
    },
    {
      separator: true,
    },
    {
      name: 'delete',
      label: $t('删除'),
      icon: 'base/rx_ic_bin_1',
      power: !role.isViewer,
      quick: true,
      multiple: true,
      multipleProps: {
        name: 'one',
      },
    },
  ]
}

export async function tableRequest(params: any) {
  return API.proxy.userGetProxyModuleList(params)
}

export async function getCustomFilters() {
  const $dict_map = await getDictMap()

  const inputs = [
    {
      type: 'Checkbox',
      label: $t('国家 / 地区'),
      name: 'lastCountry',
      getOptions: () => {
        return ($dict_map.country || []).map((item: any) => ({
          parentName: 'lastCountry',
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
      label: $t('代理 ID'),
      name: 'id',
    },
    {
      type: 'Checkbox',
      label: $t('代理类型'),
      name: 'protocol',
      getOptions: () => {
        return ($dict_map.protocol || []).map((item: any) => ({
          parentName: 'protocol',
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
      name: 'host',
    },
    {
      type: 'text',
      label: $t('备注'),
      name: 'remark',
    },
  ]

  return inputs
}

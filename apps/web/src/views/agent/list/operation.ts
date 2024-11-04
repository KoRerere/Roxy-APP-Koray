import type { UnwrapRowType, UserGetProxyModuleListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'

export interface ProxyItem extends UnwrapRowType<UserGetProxyModuleListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
}

export function tableOperation(_data?: ProxyItem | ProxyItem[]) {
  const role = useRoleStore()

  return [
    {
      name: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_edit',
      power: !role.isViewer,
    },
    {
      name: 'test',
      label: $t('测试'),
      icon: 'base/rx_ic_speed_test',
      quick: true,
      multiple: true,
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
    },
  ]
}

export async function tableRequest(params: any) {
  return API.proxy.userGetProxyModuleList(params)
}

export function getCustomFilters() {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

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
    // {
    //   separator: true,
    // },
    // {
    //   type: 'date',
    //   label: $t('#Create time'),
    //   name: 'createTime',
    //   items: [
    //     {
    //       placeholder: `${$t('#Please Enter The')} ${$t('#start time')}`,
    //       name: 'startDate',
    //       maxDate: new Date(),
    //       formatValue: (self: any) => {
    //         return self.value && format(self.value, 'yyyy-MM-dd')
    //       },
    //     },
    //     {
    //       placeholder: `${$t('#Please Enter The')} ${$t('#end time')}`,
    //       name: 'endDate',
    //       maxDate: new Date(),
    //       formatValue: (self: any) => {
    //         return self.value && format(self.value, 'yyyy-MM-dd')
    //       },
    //     },
    //   ],
    // },
  ]

  return inputs
}

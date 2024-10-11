import type { UnwrapRowType, UserGetProxyModuleListData } from '@roxy/backend-api'
import { format } from 'date-fns'
import { API } from '/@/api'
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
      label: '编辑',
      icon: 'base/rx_ic_edit',
      power: !role.isViewer,
    },
    {
      name: 'test',
      label: '测速',
      icon: 'base/rx_ic_speed_test',
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
  console.log('🚀 ~ getCustomFilters ~ $dict_map:', $dict_map)

  const inputs = [
    {
      type: 'text',
      name: 'id',
      label: 'ID',
    },
    {
      type: 'Checkbox',
      label: 'Type',
      name: 'protocol',
      options: ($dict_map.protocol || []).map((item: any) => ({
        parentName: 'protocol',
        value: item.value,
        label: item.label,
      })),
    },
    {
      type: 'text',
      label: 'Info/IP Range',
      name: 'host',
    },
    {
      type: 'text',
      label: 'Notes',
      name: 'remark',
    },
    {
      type: 'text',
      label: 'Related profiles',
      name: 'windowId',
    },
    {
      type: 'Checkbox',
      label: 'Country/Region',
      name: 'lastCountry',
      options: ($dict_map.country || []).map((item: any) => ({
        parentName: 'lastCountry',
        value: item.value,
        label: item.label,
      })),
    },
    {
      type: 'radio',
      name: 'checkStatus',
      label: 'Check Status',
      options: [
        {
          label: 'Test success',
          value: '1',
        },
        {
          label: 'Test fail',
          value: '2',
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'date',
      name: 'createTime',
      label: 'Create time',
      items: [
        {
          placeholder: 'Start time',
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: 'End time',
          name: 'endDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
  ]

  return inputs
}

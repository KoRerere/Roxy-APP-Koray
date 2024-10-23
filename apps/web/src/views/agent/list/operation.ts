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
      label: $t('Edit'),
      icon: 'base/rx_ic_edit',
      power: !role.isViewer,
    },
    {
      name: 'test',
      label: $t('Test'),
      icon: 'base/rx_ic_speed_test',
      quick: true,
      multiple: true,
    },
    {
      name: 'delete',
      label: $t('Delete'),
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
      type: 'text',
      label: $t('ID'),
      name: 'id',
    },
    {
      type: 'Checkbox',
      label: $t('Type'),
      name: 'protocol',
      getOptions: () => {
        return ($dict_map.protocol || []).map((item: any) => ({
          parentName: 'protocol',
          value: item.value,
          label: item.label,
        }))
      },
    },
    {
      type: 'text',
      label: $t('Info/IP Range'),
      name: 'host',
    },
    {
      type: 'text',
      label: $t('Notes'),
      name: 'remark',
    },
    {
      type: 'text',
      label: $t('Related profiles'),
      name: 'windowId',
    },
    {
      type: 'Checkbox',
      label: $t('Country/Region'),
      name: 'lastCountry',
      getOptions: () => {
        return ($dict_map.country || []).map((item: any) => ({
          parentName: 'lastCountry',
          value: item.value,
          label: item.label,
        }))
      },
    },
    {
      type: 'switchGroup',
      label: $t('Check Status'),
      name: 'checkStatus',
      options: [
        {
          label: $t('Test success'),
          value: '1',
        },
        {
          label: $t('Test fail'),
          value: '2',
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'date',
      label: $t('Create time'),
      name: 'createTime',
      items: [
        {
          placeholder: `${$t('Please Enter The')} ${$t('start time')}`,
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: `${$t('Please Enter The')} ${$t('end time')}`,
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

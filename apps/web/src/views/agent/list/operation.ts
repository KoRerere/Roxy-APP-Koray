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

export async function getCustomFilters(params: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  const inputs = [
    {
      type: 'text',
      name: 'windowName',
      label: '窗口名称',
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'number',
      label: '窗口序号',
      name: 'sortNums',
      icon: 'base/rx_ic_id',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: '操作系统',
      name: 'osList',
      icon: 'base/rx_ic_laptop',
      options: ($dict_map.os || []).map((item: any) => ({
        parentName: 'osList',
        value: item.value,
        label: item.label,
      })),
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      name: 'openStatus',
      label: '窗口状态',
      options: [
        {
          icon: 'base/rx_ic_browsers_line',
          label: '窗口打开',
          value: true,
        },
        {
          icon: 'base/rx_ic_browsers_line',
          label: '窗口关闭',
          value: false,
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'switch',
      name: 'isOften',
      label: '窗口收藏',
      icon: 'base/rx_ic_bookmark',
    },
    {
      type: 'textarea',
      label: '窗口备注',
      name: 'windowRemark',
      icon: 'base/rx_ic_doc_article',
    },
    {
      separator: true,
    },
    {
      type: 'text',
      label: '关联代理ID',
      name: 'proxyIds',
      placeholder: '多个代理ID逗号分隔',
      icon: 'base/rx_ic_internet',
    },
    {
      type: 'Checkbox',
      name: 'proxyProtocoList',
      label: '代理协议',
      icon: 'base/rx_ic_internet_pin',
      options: ($dict_map.protocol || []).map((item: any) => ({
        parentName: 'proxyProtocoList',
        value: item.value,
        label: item.label,
      })),
    },
    {
      type: 'radio',
      name: 'proxyTestStatus',
      label: '检测状态',
      options: [
        {
          icon: 'base/rx_ic_internet_check',
          label: '检测成功的代理',
          value: '1',
        },
        {
          icon: 'base/rx_ic_internet_error',
          label: '检测失败的代理',
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
      label: '窗口创建时间',
      icon: 'base/rx_ic_calendar',
      items: [
        {
          placeholder: '请选择开始时间',
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: '请选择结束时间',
          name: 'endDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
  ].map((input: any) => {
    if (input.type === 'date') {
      input.value = params.startDate && params.endDate ? [params.startDate, params.endDate].join('~') : undefined
      input.items.forEach((it: any) => it.value = params[it.name])
    }
    else if (!input.separator) {
      input.value = params[input.name]
    }
    return input
  })

  return inputs
}

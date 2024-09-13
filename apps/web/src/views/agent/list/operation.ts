import type { UnwrapRowType, UserGetProxyModuleListData } from '@roxy/backend-api'
import { API } from '/@/api'

export interface ProxyItem extends UnwrapRowType<UserGetProxyModuleListData> {
  loadingOperationMap: {
    [key: string]: boolean
  }
}

export function tableOperation(_data: ProxyItem | ProxyItem[]) {
  // const datas = ([] as ProxyItem[]).concat(_data)
  return [
    {
      name: 'edit',
      label: '编辑',
      icon: 'base/rx_ic_edit',
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

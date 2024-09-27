import type { UnwrapRowType, UserGetProxyModuleListData } from '@roxy/backend-api'
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

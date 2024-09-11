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
      icon: 'mdi mdi-pencil-box-outline',
    },
    // {
    //   name: 'refresh',
    //   label: '刷新',
    //   icon: 'mdi mdi-refresh',
    //   quick: true,
    //   multiple: true,
    //   disabled: datas.some(item => !item.refreshUrl),
    //   disabledTips: '缺少刷新地址',
    // },
    {
      name: 'test',
      label: '测速',
      icon: 'mdi mdi-wifi',
      quick: true,
      multiple: true,
    },
  ]
}

export async function tableRequest(params: any) {
  return API.proxy.userGetProxyModuleList(params)
}

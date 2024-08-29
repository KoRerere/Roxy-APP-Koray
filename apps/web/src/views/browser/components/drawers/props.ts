export type DrawerType = 'proxyList' | 'proxyForm' | 'accountList' | 'accountCreate'

export const drawerProps = {
  type: {
    type: String as PropType<DrawerType>,
    default: 'proxyList'
  }
} as const

export interface proxyCreate {
  host: string
  ipType: string
  port: string
  proxyCategory: string
  proxyPassword: string
  proxyUserName: string
  refreshUrl: string
}

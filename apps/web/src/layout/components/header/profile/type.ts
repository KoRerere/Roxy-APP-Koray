import type { UserGetUserConfigListData } from '@roxy/backend-api'
import type { JSX } from 'vue/jsx-runtime'

export type UserConfig = UserGetUserConfigListData['data']

export interface Items {
  label?: string
  text?: string | (() => JSX.Element)
  name?: string
  value?: any
  oldValue?: any
  classes?: string
  props?: any
  component?: any
  afterComponent?: any
  hide?: ((item: Items, items: Items[]) => boolean)
  formatValue?: (item: Items) => any
  vaildator?: (item: Items) => boolean
}
export interface List {
  subtitle?: string
  items: Items[]
}
export interface SettingsModule {
  title: string
  description: string
  list: List[]
}
